/*!
 * ppd-parser.js - parser for PostScript Printer Description (PPD) files
 * Works in browsers (window.PPD) and Node (require).
 *
 * const ppd = PPD.parse(text);
 * ppd.attributes.ModelName          -> "HP LaserJet"
 * ppd.options.PageSize              -> [{name, text, value}, ...]
 * ppd.ui                            -> [{keyword, text, type, group, default, options, order}]
 * ppd.constraints                   -> [{a:{keyword,option}, b:{keyword,option}}]
 * PPD.getInvocation(ppd, 'PageSize', 'A4')
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PPD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Decode <48656C6C6F> hex substrings (used in translation strings) as UTF-8 (latin1 fallback)
  function decodeHex(s) {
    if (!s || s.indexOf('<') < 0) return s;
    return s.replace(/<([0-9A-Fa-f\s]*)>/g, function (m, hex) {
      hex = hex.replace(/\s+/g, '');
      if (!hex || hex.length % 2) return m;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) { return String.fromCharCode.apply(null, bytes); }
    });
  }

  // "(Foo Bar)" -> "Foo Bar"  (PostScript string literal as used by *Product etc.)
  function unwrapPS(s) {
    if (typeof s !== 'string') return s;
    const m = /^\s*\((.*)\)\s*$/s.exec(s);
    return m ? m[1] : s;
  }

  // Split "Name/Translation" -> [name, translation]
  function splitTrans(v) {
    const i = v.indexOf('/');
    return i < 0 ? [v.trim(), null] : [v.slice(0, i).trim(), decodeHex(v.slice(i + 1).trim())];
  }

  // Lexer: yields one logical statement per "*Keyword [Option][/Translation]: value"
  function* statements(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimStart();
      if (line[0] !== '*' || line[1] === '%') continue;     // blank / comment

      const startLine = i + 1;
      const colon = line.indexOf(':');
      const head = (colon < 0 ? line.slice(1) : line.slice(1, colon)).trim();
      let rest = colon < 0 ? '' : line.slice(colon + 1).trim();

      let value, quoted = false;
      if (rest[0] === '"') {                                  // quoted value, may span lines
        quoted = true;
        let buf = rest.slice(1);
        let end = buf.indexOf('"');
        while (end < 0 && i + 1 < lines.length) {
          buf += '\n' + lines[++i];
          end = buf.indexOf('"');
        }
        value = end < 0 ? buf : buf.slice(0, end);
      } else {
        value = rest;
      }

      let key, option = null, translation = null;
      const m = /^([^\s\/]+)(?:\s+([^\s\/]+))?(?:\/(.*))?$/.exec(head);
      if (m) {
        key = m[1];
        option = m[2] !== undefined ? m[2] : null;
        translation = m[3] !== undefined ? decodeHex(m[3].trim()) : null;
      } else {                                                // lenient fallback
        const sp = head.search(/\s/);
        key = sp < 0 ? head : head.slice(0, sp);
        option = sp < 0 ? null : head.slice(sp).trim();
      }
      if (key === 'End') continue;                            // *End terminator
      yield { key, option, text: translation, value, quoted, line: startLine };
    }
  }

  function parseConstraint(value, nonUI) {
    const parts = [];
    for (const tok of value.trim().split(/\s+/)) {
      if (tok[0] === '*') parts.push({ keyword: tok.slice(1), option: null });
      else if (parts.length) parts[parts.length - 1].option = tok;
    }
    return { a: parts[0] || null, b: parts[1] || null, nonUI: !!nonUI };
  }

  function addAttr(attrs, key, value) {
    if (!(key in attrs)) attrs[key] = value;
    else if (Array.isArray(attrs[key])) attrs[key].push(value);
    else attrs[key] = [attrs[key], value];
  }

  function parse(text) {
    const out = {
      format: null,          // PPD spec version from *PPD-Adobe
      attributes: {},        // *Key: value   (repeated keys become arrays)
      options: {},           // *Key Option/Text: value
      ui: [],                // *OpenUI ... *CloseUI blocks
      constraints: [],       // *UIConstraints / *NonUIConstraints
      orderDependencies: [], // *OrderDependency
      includes: [],          // *Include
      groups: []             // flat list of group paths seen
    };
    const groupStack = [];

    for (const s of statements(text)) {
      switch (s.key) {
        case 'PPD-Adobe':
          out.format = s.value;
          addAttr(out.attributes, s.key, s.value);
          break;

        case 'OpenGroup':
        case 'OpenSubGroup': {
          const [name, tr] = splitTrans(s.value);
          groupStack.push({ name, text: tr || name });
          out.groups.push(groupStack.map(g => g.name).join('/'));
          break;
        }
        case 'CloseGroup':
        case 'CloseSubGroup':
          groupStack.pop();
          break;

        case 'OpenUI':
        case 'JCLOpenUI': {
          if (!s.option) break;
          const keyword = s.option.replace(/^\*/, '');
          out.ui.push({
            keyword,
            text: s.text || keyword,
            type: s.value.trim(),                // PickOne | PickMany | Boolean
            jcl: s.key === 'JCLOpenUI',
            group: groupStack.map(g => g.name).join('/') || null,
            default: undefined,
            order: null,
            options: []
          });
          break;
        }
        case 'CloseUI':
        case 'JCLCloseUI':
          break;

        case 'UIConstraints':
        case 'NonUIConstraints':
          out.constraints.push(parseConstraint(s.value, s.key === 'NonUIConstraints'));
          break;

        case 'OrderDependency': {
          const t = s.value.trim().split(/\s+/);
          out.orderDependencies.push({
            order: parseFloat(t[0]),
            section: t[1],
            keyword: (t[2] || '').replace(/^\*/, ''),
            option: t[3] || null
          });
          break;
        }

        case 'Include':
          out.includes.push(s.value);
          break;

        default:
          if (s.option !== null) {
            (out.options[s.key] = out.options[s.key] || []).push({
              name: s.option,
              text: s.text || s.option,
              value: s.value
            });
          } else {
            addAttr(out.attributes, s.key, s.value);
          }
      }
    }

    // Link UI entries with their options, defaults and ordering
    for (const ui of out.ui) {
      ui.options = out.options[ui.keyword] || [];
      const def = out.attributes['Default' + ui.keyword];
      ui.default = Array.isArray(def) ? def[def.length - 1] : def;
      const dep = out.orderDependencies.find(d => d.keyword === ui.keyword);
      if (dep) ui.order = { order: dep.order, section: dep.section };
    }
    return out;
  }

  // PostScript/PJL code to send for a given keyword + option (falls back to the default option)
  function getInvocation(ppd, keyword, option) {
    const list = ppd.options[keyword] || [];
    const name = option != null ? option : ppd.attributes['Default' + keyword];
    const hit = list.find(o => o.name === name);
    return hit ? hit.value : null;
  }

  // Is option `option` of `keyword` forbidden by the chosen settings? (selection: {PageSize:'A4', ...})
  function isConflicting(ppd, selection) {
    const hits = [];
    const match = (p) => p && selection[p.keyword] !== undefined &&
      (p.option === null || selection[p.keyword] === p.option);
    for (const c of ppd.constraints) if (match(c.a) && match(c.b)) hits.push(c);
    return hits;
  }

  return { parse, getInvocation, isConflicting, decodeHex, unwrapPS };
});
