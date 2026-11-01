/**
 * dolDocToHtml(input, options?) -> HTML string
 *
 * input    : string (Unicode) | Uint8Array | ArrayBuffer (raw TempleOS bytes, decoded as CP437)
 *
 * options  : {
 *   cols: 80,              // virtual screen width, used by $CM$ and right/center math
 *   allowHtml: false,      // allow $HC,"..."$ raw HTML (unsafe with untrusted input)
 *   style: true,           // prepend a <style> block
 *   wrapper: true,         // wrap output in <div class="dd">
 *   className: 'dd',
 *   resolveLink: (type, target, info) => url | null,
 *   resolveSprite: (bi, label, args) => htmlString | null,
 *
 *   // ---- interactive UI ----
 *   target: HTMLElement,   // if set: output is rendered into it AND events are wired (delegated)
 *   values: {},            // data binding for DA / CB / LS / CY. Read on render, written on change.
 *   lists: { NAME: [...] },// define-lists for LS / CY (items: string | {label, value})
 *   resolveList: (name, info) => array | null,
 *   onAction: (act, event) => any | Promise,   // BT / MA / MD / MU clicks (act.side: 'left' | 'right')
 *   onChange: (key, value, info, event) => void // DA / CB / LS / CY changes
 * }
 *
 * Binding key for DA / CB / LS / CY: KEY= or NAME= arg, else the label text without trailing ':'
 * (for DA: the text before the % format in A="..."), else "#<element id>".
 * Values: DA -> string|number, CB -> boolean, LS/CY -> selected index.
 *
 * DOM events fired on `target` (bubbling CustomEvents): dd-action, dd-result, dd-change, dd-error.
 * Without `target` you get a plain string; every interactive element carries data-dd-act / data-dd-bind
 * plus a JSON data-dd-info attribute, so you can wire it yourself.
 *
 * Supported: $$ escape, TX CR/NL/SR TA PB CL PT CM ID FG BG BD <COLORNAME> UL IV BK SY WW HL
 * (HolyC highlighting), TR (tree -> <details>), LK, MA, MD, MU, BT, CB, LS, CY, DA, AN, SP/IB, HC,
 * element flags (+CX +RX +UL +IV +BK +BD ...), named args exposed as data-dd-*.
 * Unknown commands are ignored.
 */
function dolDocToHtml(input, options) {
  const opt = Object.assign({
    cols: 80,
    allowHtml: false,
    style: true,
    wrapper: true,
    className: 'dd',
    resolveLink: null,
    resolveSprite: null,
    resolveList: null,
    lists: null,
    values: null,
    target: null,
    onAction: null,
    onChange: null,
  }, options);
  const vals = opt.values && typeof opt.values === 'object' ? opt.values : {};

  const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';
  const NAMES = ['BLACK', 'BLUE', 'GREEN', 'CYAN', 'RED', 'PURPLE', 'BROWN', 'LTGRAY', 'DKGRAY', 'LTBLUE', 'LTGREEN', 'LTCYAN', 'LTRED', 'LTPURPLE', 'YELLOW', 'WHITE'];
  const PAL = ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA', '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'];
  const KW = new Set('if else for while do switch case default break continue return goto try catch throw sizeof offset lastclass public extern import _extern _import static interrupt haserrcode argpop noargpop reg noreg nostkchk lock asm class union TRUE FALSE NULL ON OFF'.split(' '));
  const TY = new Set('U0 I0 U8 I8 U16 I16 U32 I32 U64 I64 F64 Bool'.split(' '));
  const RANGE = { U8: [0, 255], I8: [-128, 127], U16: [0, 65535], I16: [-32768, 32767], U32: [0, 4294967295], I32: [-2147483648, 2147483647], U64: [0, null], I64: [null, null], F64: [null, null] };

  // ---------- input decoding ----------
  let s;
  if (typeof input === 'string') s = input;
  else {
    const b = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    s = '';
    for (let k = 0; k < b.length; k++) s += b[k] < 128 ? String.fromCharCode(b[k]) : CP437[b[k] - 128];
  }
  s = s.replace(/\r\n?/g, '\n').replace(/\0+/g, '');

  // ---------- helpers ----------
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const color = v => {
    if (v == null || v === '') return null;
    if (/^\d+$/.test(v)) return +v < 16 ? +v : null;
    const k = NAMES.indexOf(String(v).toUpperCase());
    return k < 0 ? null : k;
  };
  const unq = v => {
    v = String(v).trim();
    if (v[0] !== '"') return v;
    let r = '';
    for (let k = 1; k < v.length; k++) {
      const c = v[k];
      if (c === '"') break;
      if (c === '\\') {
        const n = v[++k];
        r += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'd' ? '$' : (n === 'r' || n === '0') ? '' : (n == null ? '' : n);
      } else if (c === '$' && v[k + 1] === '$') { r += '$'; k++; }
      else r += c;
    }
    return r;
  };
  const splitArgs = str => {
    const r = []; let cur = '', q = false, d = 0;
    for (let k = 0; k < str.length; k++) {
      const c = str[k];
      if (q) {
        cur += c;
        if (c === '\\') cur += str[++k] || '';
        else if (c === '"') q = false;
        else if (c === '$' && str[k + 1] === '$') cur += str[++k];
      }
      else if (c === '"') { q = true; cur += c; }
      else if ('([{'.indexOf(c) >= 0) { d++; cur += c; }
      else if (')]}'.indexOf(c) >= 0) { d--; cur += c; }
      else if (c === ',' && d <= 0) { r.push(cur); cur = ''; }
      else cur += c;
    }
    r.push(cur);
    return r;
  };
  const readTag = i => {
    let q = false, j = i;
    for (; j < s.length; j++) {
      const c = s[j];
      if (q) {
        if (c === '\\') j++;
        else if (c === '"') q = false;
        else if (c === '$') { if (s[j + 1] === '$') j++; else break; }
      } else if (c === '"') q = true;
      else if (c === '$') break;
    }
    return j;
  };
  const getList = (name, info) => {
    let l = null;
    if (typeof opt.resolveList === 'function') l = opt.resolveList(name, info);
    if (!l && opt.lists) l = opt.lists[name];
    return Array.isArray(l) ? l.map(x => (x && typeof x === 'object') ? { label: String(x.label), value: x.value } : { label: String(x) }) : null;
  };

  // ---------- output state ----------
  const out = [];
  const trees = [];
  const st = { fg: null, bg: null, bdc: null, ul: false, iv: false, bk: false, sy: 0, ww: true, hl: false };
  let col = 0, lineStart = true, indent = 0, skipNL = false, hlBuf = '', uid = 0;

  const wrap = (html, o) => {
    const e = o ? Object.assign({}, st, o) : st;
    let fg = e.fg, bg = e.bg;
    if (e.iv) { const f = fg == null ? 0 : fg, b = bg == null ? 15 : bg; fg = b; bg = f; }
    const css = [], cls = [];
    if (fg != null) css.push('color:' + PAL[fg]);
    if (bg != null) css.push('background:' + PAL[bg]);
    if (e.ul) css.push('text-decoration:underline');
    if (e.sy) css.push('vertical-align:' + (e.sy > 0 ? 'super' : 'sub'), 'font-size:75%');
    if (!e.ww) css.push('white-space:pre');
    if (e.bd) css.push('border:1px solid ' + PAL[e.bdc == null ? 0 : e.bdc]);
    if (e.bk) cls.push('dd-bk');
    if (o && o.cls) cls.push(o.cls);
    if (!css.length && !cls.length) return html;
    return '<span' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + (css.length ? ' style="' + css.join(';') + '"' : '') + '>' + html + '</span>';
  };

  const text = (raw, o) => {
    if (skipNL && raw) { skipNL = false; if (raw[0] === '\n') raw = raw.slice(1); }
    raw.split('\n').forEach((seg, i) => {
      if (i) { out.push('\n'); col = 0; lineStart = true; }
      if (seg === '') return;
      if (lineStart) { if (indent > 0) { out.push(' '.repeat(indent)); col = indent; } lineStart = false; }
      out.push(wrap(esc(seg), o));
      col += seg.length;
    });
  };

  const el = (html, len) => {
    skipNL = false;
    if (lineStart) { if (indent > 0) { out.push(' '.repeat(indent)); col = indent; } lineStart = false; }
    out.push(html);
    col += len || 0;
  };

  const block = html => { out.push(html); col = 0; lineStart = true; skipNL = true; };

  const flushHl = () => {
    if (!hlBuf) return;
    const b = hlBuf; hlBuf = '';
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?)|(#\s*\w+)|(\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_]\w*)/g;
    let last = 0, m;
    while ((m = re.exec(b))) {
      if (m.index > last) text(b.slice(last, m.index));
      const c = m[1] ? 'dd-cm' : m[2] ? 'dd-st' : m[3] ? 'dd-pp' : m[4] ? 'dd-nm' : KW.has(m[5]) ? 'dd-kw' : TY.has(m[5]) ? 'dd-ty' : '';
      text(m[0], c ? { cls: c } : undefined);
      last = re.lastIndex;
    }
    if (last < b.length) text(b.slice(last));
  };

  const plain = raw => { if (st.hl) hlBuf += raw; else text(raw); };

  const eo = (p, m) => {
    const o = {};
    ['UL', 'IV', 'BK'].forEach(k => { if (p.has(k)) o[k.toLowerCase()] = true; if (m.has(k)) o[k.toLowerCase()] = false; });
    if (p.has('BD')) o.bd = true;
    return o;
  };

  // ---------- tag handler ----------
  const tag = t => {
    flushHl();
    const parts = splitArgs(t);
    const m = /^([A-Za-z0-9_]+)((?:[+\-][A-Za-z0-9_]+)*)$/.exec((parts.shift() || '').trim());
    if (!m) return;
    const name = m[1].toUpperCase();
    const plus = new Set(), minus = new Set();
    m[2].replace(/([+\-])([A-Za-z0-9_]+)/g, (_, sg, f) => (sg === '+' ? plus : minus).add(f.toUpperCase()));
    const pos = [], named = {};
    for (const p of parts) {
      const nm = /^([A-Za-z_]\w*)\s*=\s*([\s\S]*)$/.exec(p.trim());
      if (nm) named[nm[1].toUpperCase()] = unq(nm[2]); else pos.push(unq(p));
    }
    const o = eo(plus, minus);
    const label = pos[0] == null ? '' : pos[0];
    const data = Object.keys(named).map(k => ' data-dd-' + k.toLowerCase() + '="' + esc(named[k]) + '"').join('');
    const lr = {
      left: named.LM != null ? named.LM : named.LE != null ? named.LE : null,
      right: named.RM != null ? named.RM : named.RE != null ? named.RE : null,
    };
    const mkInfo = (kind, extra) => Object.assign({ id: ++uid, type: kind, label, args: named, flags: Array.from(plus) }, extra);
    const keyOf = (txt, info) => named.KEY || named.NAME || String(txt).replace(/[:\s]+$/, '').trim() || '#' + info.id;
    const attr = (kind, info, which) => ' data-dd-' + which + '="' + esc(kind) + '" data-dd-info="' + esc(JSON.stringify(info)) + '"';

    switch (name) {
      case 'TX':
        if (plus.has('CX') || plus.has('RX')) block('<div style="text-align:' + (plus.has('CX') ? 'center' : 'right') + '">' + wrap(esc(label), o) + '</div>');
        else text(label, o);
        break;
      case 'CR': case 'NL': case 'SR': skipNL = false; text('\n'); break;
      case 'TA': skipNL = false; text('\t'); break;
      case 'PB': block('<hr class="dd-pb">'); break;
      case 'CL': out.length = 0; trees.length = 0; col = 0; lineStart = true; skipNL = false; break;
      case 'PT': break;
      case 'CM': {
        const x = num(pos[0]), y = num(pos[1]), base = col;
        if (y > 0) { skipNL = false; for (let k = 0; k < Math.min(y, 200); k++) out.push('\n'); col = 0; lineStart = true; }
        const tgt = plus.has('LX') ? x : plus.has('RX') ? opt.cols - x : plus.has('CX') ? (opt.cols >> 1) + x : base + x;
        if (tgt > col) { out.push(' '.repeat(Math.min(tgt - col, 1000))); col = tgt; lineStart = false; }
        break;
      }
      case 'ID': {
        const wasLS = lineStart;
        indent = Math.max(0, indent + num(pos[0]));
        let closed = false;
        while (trees.length && indent <= trees[trees.length - 1]) { out.push('</details>'); trees.pop(); closed = true; }
        if (closed) { col = 0; lineStart = true; if (!wasLS) skipNL = true; }
        break;
      }
      case 'FG': st.fg = color(pos[0]); break;
      case 'BG': st.bg = color(pos[0]); break;
      case 'BD': st.bdc = color(pos[0]); break;
      case 'UL': st.ul = !!num(pos[0]); break;
      case 'IV': st.iv = !!num(pos[0]); break;
      case 'BK': st.bk = !!num(pos[0]); break;
      case 'SY': st.sy = num(pos[0]); break;
      case 'WW': st.ww = pos.length ? !!num(pos[0]) : true; break;
      case 'HL': st.hl = pos.length ? !!num(pos[0]) : false; break;
      case 'TR': {
        const open = !plus.has('C');
        out.push('<details' + (open ? ' open' : '') + '><summary class="dd-tr"' + data + '>' + esc(' '.repeat(indent)) + wrap(esc(label), o) + '</summary>');
        trees.push(indent); col = 0; lineStart = true; skipNL = true;
        break;
      }
      case 'LK': {
        let a = named.A != null ? named.A : pos[1];
        let shown = label;
        const hasA = a != null;
        if (!hasA) a = label;
        const lm = /^([A-Za-z]{2}):([\s\S]*)$/.exec(a);
        const type = lm ? lm[1].toUpperCase() : /^https?:\/\//i.test(a) ? 'URL' : '';
        const target = lm ? lm[2] : a;
        if (!hasA && lm) shown = target;
        let href = type === 'URL' ? a : '#dd-' + (type.toLowerCase() || 'link') + ':' + encodeURI(target);
        if (typeof opt.resolveLink === 'function') { const r = opt.resolveLink(type, target, { label: shown, args: named, flags: plus }); if (r) href = r; }
        el('<a href="' + esc(href) + '" class="dd-lk" data-dd-type="' + esc(type) + '" data-dd-target="' + esc(target) + '" data-dd-flags="' + esc(Array.from(plus).join(' ')) + '"' +
          (named.T ? ' title="' + esc(named.T) + '"' : '') + (type === 'URL' ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
          wrap(esc(shown), o) + '</a>', shown.length);
        break;
      }
      case 'BT': case 'MA': case 'MD': case 'MU': {
        const info = mkInfo(name, Object.assign({ popup: plus.has('PU'), exit: plus.has('X') }, lr));
        const a = attr(name, info, 'act') + data;
        if (name === 'BT') el('<button type="button" class="dd-bt"' + a + '>' + wrap(esc(label), o) + '</button>', label.length + 2);
        else el('<a href="#" role="button" class="dd-ma"' + a + '>' + wrap(esc(label), o) + '</a>', label.length);
        break;
      }
      case 'CB': {
        const info = mkInfo('CB', lr);
        info.key = keyOf(label, info);
        const on = !!vals[info.key];
        el('<label class="dd-cb"><input type="checkbox"' + (on ? ' checked' : '') + attr('CB', info, 'bind') + data + '> ' + wrap(esc(label), o) + '</label>', label.length + 4);
        break;
      }
      case 'LS': case 'CY': {
        const info = mkInfo(name, lr);
        info.key = keyOf(label, info);
        const lname = named.D || named.LIST || named.LST || null;
        info.list = lname;
        const items = lname ? getList(lname, info) : null;
        if (!items || !items.length) { el('<span class="dd-ls"' + data + '>' + wrap(esc(label), o) + '</span>', label.length); break; }
        let cur = Math.trunc(Number(vals[info.key]));
        if (!(cur >= 0 && cur < items.length)) cur = 0;
        info.items = items.map(x => x.label);
        if (name === 'LS') {
          const options = items.map((x, k) => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('');
          el((label ? wrap(esc(label), o) + ' ' : '') + '<select class="dd-ls"' + attr('LS', info, 'bind') + data + '>' + options + '</select>', label.length + 10);
        } else {
          el('<button type="button" class="dd-cy"' + attr('CY', info, 'bind') + ' data-dd-index="' + cur + '">' + wrap(esc(items[cur].label), o) + '</button>', items[cur].label.length + 2);
        }
        break;
      }
      case 'DA': {
        const n = Math.max(1, Math.min(200, num(pos[0]) || 16));
        const fm = /^([\s\S]*?)%[-+ #0-9.*]*(?:ll|l|h|z)?([diuxXfeEgGscp])([\s\S]*)$/.exec(named.A || '');
        const pre = fm ? fm[1] : (named.A || ''), spec = fm ? fm[2] : 's', post = fm ? fm[3] : '';
        const rt = (named.RT || '').toUpperCase();
        const isFloat = rt === 'F64' || (!rt && 'feEgG'.indexOf(spec) >= 0);
        const isInt = !isFloat && (Object.prototype.hasOwnProperty.call(RANGE, rt) || (!rt && 'diu'.indexOf(spec) >= 0));
        const isNum = isFloat || isInt;
        const rg = RANGE[rt] || [null, null];
        const info = mkInfo('DA', { numeric: isNum, float: isFloat, rt: rt || null });
        info.key = keyOf(pre, info);
        const v = vals[info.key];
        el(wrap(esc(pre), o) +
          '<input class="dd-da" type="' + (isNum ? 'number' : 'text') + '"' +
          (isNum ? ' step="' + (isFloat ? 'any' : '1') + '"' + (rg[0] != null ? ' min="' + rg[0] + '"' : '') + (rg[1] != null ? ' max="' + rg[1] + '"' : '') : '') +
          ' style="width:' + (n + 2) + 'ch" value="' + esc(v == null ? '' : v) + '"' + attr('DA', info, 'bind') + data + '>' +
          wrap(esc(post), o), pre.length + n + post.length);
        break;
      }
      case 'AN':
        el('<a class="dd-an" id="dd-an-' + esc(named.A || label) + '">' + wrap(esc(label), o) + '</a>', label.length);
        break;
      case 'SP': case 'IB': {
        const custom = typeof opt.resolveSprite === 'function' ? opt.resolveSprite(named.BI, label, named) : null;
        if (typeof custom === 'string') el(custom, 0);
        else el('<span class="dd-sp"' + data + ' title="sprite">' + esc(label || '[sprite]') + '</span>', (label || '[sprite]').length);
        break;
      }
      case 'HC':
        el(opt.allowHtml ? label : esc(label), 0);
        break;
      default: {
        const k = NAMES.indexOf(name);
        if (k >= 0) st.fg = k;
      }
    }
  };

  // ---------- main loop ----------
  let i = 0;
  while (i < s.length) {
    const d = s.indexOf('$', i);
    if (d < 0) { plain(s.slice(i)); break; }
    if (d > i) plain(s.slice(i, d));
    if (s[d + 1] === '$') { plain('$'); i = d + 2; continue; }
    const e = readTag(d + 1);
    if (e >= s.length) { plain(s.slice(d)); break; }
    tag(s.slice(d + 1, e));
    i = e + 1;
  }
  flushHl();
  while (trees.length) { out.push('</details>'); trees.pop(); }

  // ---------- assemble ----------
  const html = out.join('');
  let result = html;
  if (opt.wrapper) {
    const c = '.' + opt.className;
    const css =
      c + '{white-space:pre-wrap;overflow-wrap:anywhere;tab-size:8;font:16px/1.15 "Courier New",Consolas,monospace;background:#fff;color:#000;padding:8px}' +
      c + ' a{color:#AA0000;text-decoration:none}' + c + ' a:hover{text-decoration:underline}' +
      c + ' .dd-tr{color:#AA00AA;cursor:pointer}' +
      c + ' .dd-bt,' + c + ' .dd-cy,' + c + ' select,' + c + ' input.dd-da{font:inherit}' +
      c + ' .dd-cy{cursor:pointer}' +
      c + ' .dd-kw{color:#0000AA}' + c + ' .dd-ty{color:#00AAAA}' + c + ' .dd-cm{color:#00AA00}' +
      c + ' .dd-st{color:#AA5500}' + c + ' .dd-pp{color:#AA00AA}' + c + ' .dd-nm{color:#AA0000}' +
      c + ' .dd-sp{color:#555}' + c + ' .dd-pb{border:0;border-top:1px dashed #aaa;margin:0}' +
      c + ' .dd-bk{animation:dd-bk 1s steps(1) infinite}@keyframes dd-bk{50%{opacity:0}}';
    result = (opt.style ? '<style>' + css + '</style>' : '') + '<div class="' + esc(opt.className) + '">' + html + '</div>';
  }

  // ---------- optional live wiring ----------
  const T = opt.target;
  if (T && typeof T.addEventListener === 'function') {
    if (T.__ddOff) T.__ddOff();
    T.innerHTML = result;
    const emit = (type, detail) => { if (typeof CustomEvent === 'function') T.dispatchEvent(new CustomEvent(type, { detail: detail, bubbles: true })); };
    const readInfo = n => { try { return JSON.parse(n.getAttribute('data-dd-info')); } catch (e) { return null; } };
    const find = (ev, sel) => { const n = ev.target && ev.target.closest ? ev.target.closest(sel) : null; return n && T.contains(n) ? n : null; };
    const setVal = (info, v, ev) => {
      vals[info.key] = v;
      emit('dd-change', { key: info.key, value: v, info: info });
      if (typeof opt.onChange === 'function') opt.onChange(info.key, v, info, ev);
    };
    const fire = (node, side, ev) => {
      const info = readInfo(node);
      if (!info) return;
      const act = Object.assign({}, info, { side: side, expr: side === 'right' ? info.right : info.left });
      emit('dd-action', act);
      if (typeof opt.onAction !== 'function') return;
      Promise.resolve().then(() => opt.onAction(act, ev)).then(v => {
        if (v === undefined) return;
        node.setAttribute('data-dd-value', String(v));
        emit('dd-result', { id: info.id, type: info.type, value: v });
      }).catch(err => emit('dd-error', { id: info.id, error: err }));
    };
    const onClick = ev => {
      const cy = find(ev, '[data-dd-bind="CY"]');
      if (cy) {
        const info = readInfo(cy);
        if (info && info.items && info.items.length) {
          const n = (Number(cy.getAttribute('data-dd-index')) + 1) % info.items.length;
          cy.setAttribute('data-dd-index', n);
          cy.textContent = info.items[n];
          setVal(info, n, ev);
        }
        return;
      }
      const a = find(ev, '[data-dd-act]');
      if (a) { ev.preventDefault(); fire(a, 'left', ev); }
    };
    const onCtx = ev => {
      const a = find(ev, '[data-dd-act]');
      if (!a) return;
      const info = readInfo(a);
      if (info && info.right != null) { ev.preventDefault(); fire(a, 'right', ev); }
    };
    const onChange = ev => {
      const n = find(ev, '[data-dd-bind]');
      if (!n) return;
      const info = readInfo(n);
      if (!info) return;
      const k = n.getAttribute('data-dd-bind');
      let v;
      if (k === 'CB') v = n.checked;
      else if (k === 'LS') v = n.selectedIndex;
      else if (k === 'DA') v = info.numeric ? (n.value === '' ? null : Number(n.value)) : n.value;
      else return;
      setVal(info, v, ev);
    };
    T.addEventListener('click', onClick);
    T.addEventListener('contextmenu', onCtx);
    T.addEventListener('change', onChange);
    T.__ddOff = () => {
      T.removeEventListener('click', onClick);
      T.removeEventListener('contextmenu', onCtx);
      T.removeEventListener('change', onChange);
      T.__ddOff = null;
    };
  }

  return result;
}

if (typeof module !== 'undefined') module.exports = dolDocToHtml;