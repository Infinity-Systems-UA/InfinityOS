/**
 * FODT (Flat OpenDocument Text) <-> HTML
 * Supported tags: p, h1-h6, ul, ol, li, b, i, u, s, br
 *
 *   fodtToHtml(fodtString)  -> HTML string
 *   htmlToFodt(htmlString)  -> complete FODT document string
 *
 * Works in the browser (DOMParser). In Node, pass a DOMParser as the 2nd argument
 * (e.g. new (require('jsdom').JSDOM)('').window.DOMParser).
 */
function fodtToHtml(fodt, DOMParserImpl) {
  const Parser = DOMParserImpl || DOMParser;

  if (typeof fodt !== 'string') {
    console.log(fodt)
    throw new TypeError('fodtToHtml expects a string, got ' + (fodt === null ? 'null' : typeof fodt));
  }
  fodt = fodt.replace(/^\uFEFF/, '').trim(); // BOM / whitespace before <?xml breaks the parser
  if (!fodt) return '<p><br></p>';           // empty input = empty document

  const doc = new Parser().parseFromString(fodt, 'application/xml');
  const perr = doc.getElementsByTagName('parsererror')[0];
  if (perr) {
    throw new Error('Invalid FODT: ' + perr.textContent.trim().replace(/\s+/g, ' ').slice(0, 300));
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kids = el => Array.from(el.childNodes).filter(n => n.nodeType === 1);

  // ---------- Styles ----------
  const styles = {};     // name -> { parent, own: {b,i,u,s} }
  const listStyles = {}; // name -> element

  for (const st of Array.from(doc.getElementsByTagName('style:style'))) {
    const name = st.getAttribute('style:name');
    if (!name) continue;
    const own = {};
    for (const c of kids(st)) {
      if (c.nodeName !== 'style:text-properties') continue;
      const w = c.getAttribute('fo:font-weight');
      if (w) own.b = w === 'bold' || parseInt(w, 10) >= 600;
      const it = c.getAttribute('fo:font-style');
      if (it) own.i = it === 'italic' || it === 'oblique';
      const u = c.getAttribute('style:text-underline-style');
      if (u) own.u = u !== 'none';
      const s = c.getAttribute('style:text-line-through-style');
      if (s) own.s = s !== 'none';
    }
        styles[name] = {
      parent: st.getAttribute('style:parent-style-name'),
      own,
      align: (kids(st).find(c => c.nodeName === 'style:paragraph-properties')
               ?.getAttribute('fo:text-align')) || null,
    };
  }

  for (const ls of Array.from(doc.getElementsByTagName('text:list-style'))) {
    listStyles[ls.getAttribute('style:name')] = ls;
  }

  function styleFmt(name, depth = 0) {
    const st = styles[name];
    if (!st || depth > 20) return {};
    return { ...styleFmt(st.parent, depth + 1), ...st.own };
  }

  function styleAlign(name, depth = 0) {
    const st = styles[name];
    if (!st || depth > 20) return null;
    return st.align || styleAlign(st.parent, depth + 1);
  }
  const alignAttr = name => {
    const a = { center: 'center', end: 'right', right: 'right', justify: 'justify' }[styleAlign(name)];
    return a ? ` style="text-align:${a}"` : '';
  };

  // ---------- Inline content ----------
  function flatten(node, fmt, runs) {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType === 3) {
        runs.push({ html: esc(c.nodeValue), fmt });
        continue;
      }
      if (c.nodeType !== 1) continue;
      switch (c.nodeName) {
        case 'text:span':
          flatten(c, { ...fmt, ...styleFmt(c.getAttribute('text:style-name')) }, runs);
          break;
        case 'text:s':
          runs.push({ html: '&nbsp;'.repeat(parseInt(c.getAttribute('text:c') || '1', 10)), fmt });
          break;
        case 'text:tab':
          runs.push({ html: '&emsp;', fmt });
          break;
        case 'text:line-break':
          runs.push({ html: '<br>', fmt: {} });
          break;
        case 'office:annotation':
        case 'text:note':
          break;
        default: // text:a, text:bookmark-ref, etc. -> keep the text
          flatten(c, fmt, runs);
      }
    }
  }

  const fmtKey = f => (f.b ? 'b' : '') + (f.i ? 'i' : '') + (f.u ? 'u' : '') + (f.s ? 's' : '');

  function wrap(html, f) {
    if (f.s) html = `<s>${html}</s>`;
    if (f.u) html = `<u>${html}</u>`;
    if (f.i) html = `<i>${html}</i>`;
    if (f.b) html = `<b>${html}</b>`;
    return html;
  }

  function inline(el, baseFmt) {
    const runs = [];
    flatten(el, baseFmt, runs);
    // merge adjacent runs with identical formatting
    const merged = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && fmtKey(last.fmt) === fmtKey(r.fmt)) last.html += r.html;
      else merged.push({ html: r.html, fmt: r.fmt });
    }
    return merged.map(r => wrap(r.html, r.fmt)).join('');
  }

  // ---------- Blocks ----------
  function isOrdered(styleName, level) {
    const ls = listStyles[styleName];
    if (!ls) return false;
    const lvl = kids(ls).find(c => c.getAttribute('text:level') === String(level));
    return !!lvl && lvl.nodeName === 'text:list-level-style-number';
  }

  function heading(el) {
    const n = Math.min(6, Math.max(1, parseInt(el.getAttribute('text:outline-level') || '1', 10) || 1));
    return `<h${n}${alignAttr(el.getAttribute('text:style-name'))}>${inline(el, {})}</h${n}>`;
  }

  function paragraph(el) {
    const sn = el.getAttribute('text:style-name');
    const html = inline(el, styleFmt(sn));
    return `<p${alignAttr(sn)}>${html || '<br>'}</p>`;
  }


  function list(el, inheritedStyle, level) {
    const styleName = el.getAttribute('text:style-name') || inheritedStyle;
    const tag = isOrdered(styleName, level) ? 'ol' : 'ul';
    let out = `<${tag}>`;
    for (const item of kids(el)) {
      if (item.nodeName !== 'text:list-item' && item.nodeName !== 'text:list-header') continue;
      let li = '';
      let first = true;
      let liAttr = '';
      for (const ch of kids(item)) {
        if (ch.nodeName === 'text:p' && first) {
          liAttr = alignAttr(ch.getAttribute('text:style-name'));
          li += inline(ch, styleFmt(ch.getAttribute('text:style-name')));
        } else if (ch.nodeName === 'text:p') {
          liAttr = alignAttr(ch.getAttribute('text:style-name'));
          li += paragraph(ch, styleFmt(ch.getAttribute('text:style-name')));
        } else if (ch.nodeName === 'text:h') {
          liAttr = alignAttr(ch.getAttribute('text:style-name'));
          li += heading(ch, styleFmt(ch.getAttribute('text:style-name')));
        } else if (ch.nodeName === 'text:list') {
          liAttr = alignAttr(ch.getAttribute('text:style-name'));
          li += list(ch, styleName, level + 1);
        }
        first = false;
      }
        out += `<li${liAttr}>${li}</li>`;
    }
    return out + `</${tag}>`;
  }

  function blocks(node) {
    let out = '';
    for (const c of kids(node)) {
      switch (c.nodeName) {
        case 'text:h': out += heading(c); break;
        case 'text:p': out += paragraph(c); break;
        case 'text:list': out += list(c, null, 1); break;
        default: out += blocks(c); // text:section, table cells, etc.
      }
    }
    return out;
  }

  const body = doc.getElementsByTagName('office:text')[0];
  return (body && blocks(body)) || '<p><br></p>';
}

/**
 * HTML -> FODT (full standalone document)
 * Input: p, h1-h6, ul, ol, li, b/strong, i/em, u/ins, s/strike/del, br.
 * Other containers (div, section, ...) are walked through; other inline tags keep their text.
 */
function htmlToFodt(html, DOMParserImpl) {
  try{

      const alignOf = el => {
    let a = (el.style && el.style.textAlign) || el.getAttribute('align') || '';
    return { center: 'center', right: 'end', end: 'end', justify: 'justify' }[a.toLowerCase()] || null;
  };
  const pstyles = new Map();
  const pStyle = (parent, align) => {
    if (!align) return parent;
    const name = `P_${parent}_${align}`;
    pstyles.set(name, { parent, align });
    return name;
  };

  const Parser = DOMParserImpl || DOMParser;
  const doc = new Parser().parseFromString(html, 'text/html');
  const root = doc.body || doc.documentElement;

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const SKIP = /^(script|style|head|template|title|meta|link)$/;
  const CONTAINER = /^(div|section|article|header|footer|main|nav|aside|blockquote|pre|li|table|thead|tbody|tfoot|tr|td|th)$/;
  const STD = 'Standard';
  const usedTextStyles = new Set();

  // ---------- Inline ----------
  function walk(node, fmt, out) {
    if (node.nodeType === 3) { out.push({ text: node.nodeValue, fmt }); return; }
    if (node.nodeType !== 1) return;
    const t = node.nodeName.toLowerCase();
    if (SKIP.test(t)) return;
    if (t === 'br') { out.push({ br: true }); return; }
    const f = {
      b: fmt.b || t === 'b' || t === 'strong',
      i: fmt.i || t === 'i' || t === 'em',
      u: fmt.u || t === 'u' || t === 'ins',
      s: fmt.s || t === 's' || t === 'strike' || t === 'del',
    };
    for (const c of Array.from(node.childNodes)) walk(c, f, out);
  }

  const fmtKey = f => (f.b ? 'b' : '') + (f.i ? 'i' : '') + (f.u ? 'u' : '') + (f.s ? 's' : '');

  function inlineXml(nodes) {
    const segs = [];
    for (const n of nodes) walk(n, {}, segs);

    // HTML whitespace collapsing (nbsp is kept on purpose)
    for (const s of segs) if (!s.br) s.text = s.text.replace(/[ \t\r\n\f]+/g, ' ');

    // drop leading spaces at line starts and doubled spaces across tag boundaries
    let prevSpace = true;
    for (const s of segs) {
      if (s.br) { prevSpace = true; continue; }
      if (prevSpace && s.text.startsWith(' ')) s.text = s.text.slice(1);
      if (s.text) prevSpace = s.text.endsWith(' ');
    }
    // drop trailing spaces before a line break / end of paragraph
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].br || !segs[i].text.endsWith(' ')) continue;
      let j = i + 1;
      while (j < segs.length && !segs[j].br && !segs[j].text) j++;
      if (j >= segs.length || segs[j].br) segs[i].text = segs[i].text.slice(0, -1);
    }

    // merge neighbours with identical formatting
    const merged = [];
    for (const s of segs) {
      if (!s.br && !s.text) continue;
      const k = s.br ? '' : fmtKey(s.fmt);
      const last = merged[merged.length - 1];
      if (!s.br && last && !last.br && last.k === k) last.text += s.text;
      else merged.push(s.br ? { br: true } : { text: s.text, k });
    }
    if (merged.length === 0 || (merged.length === 1 && merged[0].br)) return '';

    // ODF whitespace: first space literal, extra ones as <text:s/>
    let sp = true; // a literal space here would be swallowed by ODF
    const enc = text => {
      let out = '';
      for (const part of text.split(/([ \u00A0]+|\u2003)/)) {
        if (!part) continue;
        if (part === '\u2003') { out += '<text:tab/>'; sp = false; }
        else if (/^[ \u00A0]+$/.test(part)) {
          const n = part.length;
          out += sp ? `<text:s text:c="${n}"/>` : ' ' + (n > 1 ? `<text:s text:c="${n - 1}"/>` : '');
          sp = true;
        } else { out += esc(part); sp = false; }
      }
      return out;
    };

    return merged.map(s => {
      if (s.br) { sp = true; return '<text:line-break/>'; }
      const x = enc(s.text);
      if (!s.k) return x;
      usedTextStyles.add(s.k);
      return `<text:span text:style-name="T_${s.k}">${x}</text:span>`;
    }).join('');
  }

  // ---------- Blocks ----------
  const para = (nodes, align) => {
    const x = inlineXml(nodes);
    const sn = pStyle(STD, align);
    return x ? `<text:p text:style-name="${sn}">${x}</text:p>` : `<text:p text:style-name="${sn}"/>`;
  };
  const heading = (el, n, inh) =>
    `<text:h text:style-name="${pStyle(`Heading_20_${n}`, alignOf(el) || inh)}" text:outline-level="${n}">${inlineXml(Array.from(el.childNodes))}</text:h>`;

  function list(el, type, inh) {
    let out = `<text:list text:style-name="${type === 'ol' ? 'L_ol' : 'L_ul'}">`;
    for (const li of Array.from(el.childNodes)) {
      if (li.nodeType !== 1) continue;
      const t = li.nodeName.toLowerCase();
      if (t === 'ul' || t === 'ol') out += `<text:list-item>${list(li, t, inh)}</text:list-item>`;
      else if (t === 'li') out += `<text:list-item>${blocks(li, alignOf(li) || inh) || `<text:p text:style-name="${STD}"/>`}</text:list-item>`;
    }
    return out + '</text:list>';
  }

  function blocks(parent, inh = null) {
    inh = alignOf(parent) || inh;
    let out = '';
    let buf = [];
    const flush = () => {
      const real = buf.some(n => n.nodeType === 3 ? /\S/.test(n.nodeValue) : !SKIP.test(n.nodeName.toLowerCase()));
      if (real) out += para(buf, inh);
      buf = [];
    };
    for (const c of Array.from(parent.childNodes)) {
      const t = c.nodeType === 1 ? c.nodeName.toLowerCase() : '';
      if (/^h[1-6]$/.test(t)) { flush(); out += heading(c, +t[1], inh); }
      else if (t === 'p') { flush(); out += para(Array.from(c.childNodes), alignOf(c) || inh); }
      else if (t === 'ul' || t === 'ol') { flush(); out += list(c, t, inh); }
      else if (CONTAINER.test(t)) { flush(); out += blocks(c, inh); }
      else buf.push(c);
    }
    flush();
    return out;
  }

  const body = blocks(root);

  // ---------- Styles ----------
  const textProps = k => [
    k.includes('b') && 'fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"',
    k.includes('i') && 'fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"',
    k.includes('u') && 'style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"',
    k.includes('s') && 'style:text-line-through-style="solid" style:text-line-through-type="single"',
  ].filter(Boolean).join(' ');

  const autoTextStyles = Array.from(usedTextStyles).map(k =>
    `<style:style style:name="T_${k}" style:family="text"><style:text-properties ${textProps(k)}/></style:style>`
  ).join('');
    const autoParaStyles = Array.from(pstyles, ([name, { parent, align }]) =>
    `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${parent}">` +
    `<style:paragraph-properties fo:text-align="${align}"/></style:style>`
  ).join('');

  const listStyle = (name, ordered) => {
    let lv = '';
    for (let l = 1; l <= 10; l++) {
      const ml = (0.635 * (l + 1)).toFixed(3) + 'cm';
      const align = `<style:list-level-properties text:list-level-position-and-space-mode="label-alignment">` +
        `<style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${ml}" fo:text-indent="-0.635cm" fo:margin-left="${ml}"/>` +
        `</style:list-level-properties>`;
      lv += ordered
        ? `<text:list-level-style-number text:level="${l}" style:num-suffix="." style:num-format="1">${align}</text:list-level-style-number>`
        : `<text:list-level-style-bullet text:level="${l}" text:bullet-char="${['•', '◦', '▪'][(l - 1) % 3]}">${align}</text:list-level-style-bullet>`;
    }
    return `<text:list-style style:name="${name}">${lv}</text:list-style>`;
  };

  const sizes = [18, 16, 14, 12, 11, 10];
  const headingStyles = sizes.map((pt, i) =>
    `<style:style style:name="Heading_20_${i + 1}" style:display-name="Heading ${i + 1}" style:family="paragraph" ` +
    `style:parent-style-name="Heading" style:next-style-name="${STD}" style:default-outline-level="${i + 1}" style:class="text">` +
    `<style:text-properties fo:font-size="${pt}pt" fo:font-weight="bold"/></style:style>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:font-face-decls>
<style:font-face style:name="Liberation Serif" svg:font-family="'Liberation Serif'" style:font-family-generic="roman" style:font-pitch="variable"/>
<style:font-face style:name="Liberation Sans" svg:font-family="'Liberation Sans'" style:font-family-generic="swiss" style:font-pitch="variable"/>
</office:font-face-decls>
<office:styles>
<style:style style:name="${STD}" style:family="paragraph" style:class="text"><style:text-properties style:font-name="Liberation Serif" fo:font-size="12pt"/></style:style>
<style:style style:name="Heading" style:family="paragraph" style:parent-style-name="${STD}" style:next-style-name="${STD}" style:class="text"><style:paragraph-properties fo:margin-top="0.423cm" fo:margin-bottom="0.212cm" fo:keep-with-next="always"/><style:text-properties style:font-name="Liberation Sans"/></style:style>
${headingStyles}
</office:styles>
<office:automatic-styles>
${autoParaStyles}
${autoTextStyles}
${listStyle('L_ul', false)}
${listStyle('L_ol', true)}
</office:automatic-styles>
<office:body>
<office:text>
${body || `<text:p text:style-name="${STD}"/>`}
</office:text>
</office:body>
</office:document>
`;

}catch (e){
  console.error(e.message)
}}

if (typeof module !== 'undefined') module.exports = { fodtToHtml, htmlToFodt };