/*
 * Biçimsel karşılaştırma için normalleştirme.
 * Metin, anlamı korunarak standart bir biçime çevrilir; böylece yalnızca gerçek veri farkları görünür.
 *
 * JSON: anahtarlar sıralanır, girinti 2 boşluk. Sayılar yazıldığı gibi korunur
 *       (JSON.parse büyük sayıları yuvarladığı için kendi ayrıştırıcımız var).
 * XML:  öznitelikler sıralanır, girinti 2 boşluk, yalnızca boşluktan oluşan metinler atılır.
 *       Element sırası XML'de anlamlı olduğundan korunur.
 */
(function (root) {
  'use strict';

  // Hata: { code, line, col } — arayüz mesajı dile göre üretir.
  function FormatError(code, src, pos) {
    const pre = src.slice(0, pos);
    const line = pre.split('\n').length;
    const col = pos - pre.lastIndexOf('\n');
    const e = new Error(code);
    e.code = code; e.line = line; e.col = col;
    return e;
  }

  /* ---------- JSON ---------- */

  const NUM_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const ESC = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

  function parseJSON(src) {
    let i = src.charCodeAt(0) === 0xFEFF ? 1 : 0;
    const n = src.length;
    const fail = () => { throw FormatError('json', src, i); };

    function ws() {
      while (i < n) {
        const c = src.charCodeAt(i);
        if (c === 32 || c === 9 || c === 10 || c === 13) i++; else break;
      }
    }

    function str() {
      i++; // açılış tırnağı
      let out = '', start = i;
      for (;;) {
        if (i >= n) fail();
        const c = src.charCodeAt(i);
        if (c === 34) { out += src.slice(start, i); i++; return out; }
        if (c < 32) fail();
        if (c === 92) {
          out += src.slice(start, i);
          const e = src[i + 1];
          if (e === 'u') {
            const hex = src.slice(i + 2, i + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
            out += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else if (e in ESC) {
            out += ESC[e];
            i += 2;
          } else fail();
          start = i;
          continue;
        }
        i++;
      }
    }

    function value() {
      ws();
      const c = src[i];
      if (c === '{') {
        i++;
        const obj = new Map();
        ws();
        if (src[i] === '}') { i++; return { t: 'o', v: obj }; }
        for (;;) {
          ws();
          if (src[i] !== '"') fail();
          const k = str();
          ws();
          if (src[i] !== ':') fail();
          i++;
          obj.set(k, value());
          ws();
          if (src[i] === ',') { i++; continue; }
          if (src[i] === '}') { i++; return { t: 'o', v: obj }; }
          fail();
        }
      }
      if (c === '[') {
        i++;
        const arr = [];
        ws();
        if (src[i] === ']') { i++; return { t: 'a', v: arr }; }
        for (;;) {
          arr.push(value());
          ws();
          if (src[i] === ',') { i++; continue; }
          if (src[i] === ']') { i++; return { t: 'a', v: arr }; }
          fail();
        }
      }
      if (c === '"') return { t: 's', v: str() };
      for (const lit of ['true', 'false', 'null']) {
        if (src.startsWith(lit, i)) { i += lit.length; return { t: 'l', v: lit }; }
      }
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src);
      if (m) { i += m[0].length; return { t: 'n', v: m[0] }; }
      fail();
    }

    const v = value();
    ws();
    if (i < n) fail();
    return v;
  }

  function printJSON(node, ind) {
    switch (node.t) {
      case 's': return JSON.stringify(node.v);
      case 'n': case 'l': return node.v;
      case 'a': {
        if (!node.v.length) return '[]';
        const pad = ind + '  ';
        return '[\n' + node.v.map(x => pad + printJSON(x, pad)).join(',\n') + '\n' + ind + ']';
      }
      case 'o': {
        if (!node.v.size) return '{}';
        const pad = ind + '  ';
        const keys = Array.from(node.v.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        return '{\n' + keys.map(k => pad + JSON.stringify(k) + ': ' + printJSON(node.v.get(k), pad)).join(',\n') + '\n' + ind + '}';
      }
    }
  }

  function formatJSON(text) {
    if (text.trim() === '') return '';
    return printJSON(parseJSON(text), '');
  }

  /* ---------- XML (tarayıcının DOMParser'ı ile) ---------- */

  const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

  function formatXML(text) {
    if (text.trim() === '') return '';
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const perr = doc.getElementsByTagName('parsererror')[0];
    if (perr) {
      // Tarayıcılar konumu mesajın içinde verir: "line 3 at column 5" / "Line Number 3, Column 5"
      const m = /line(?: number)?\s*(\d+)[^\d]+(\d+)/i.exec(perr.textContent || '');
      const e = new Error('xml');
      e.code = 'xml';
      if (m) { e.line = Number(m[1]); e.col = Number(m[2]); }
      throw e;
    }

    const out = [];
    function walk(node, ind) {
      switch (node.nodeType) {
        case 1: { // element
          const attrs = Array.from(node.attributes)
            .map(a => [a.name, a.value])
            .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
            .map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
          const kids = Array.from(node.childNodes).filter(c => !(c.nodeType === 3 && c.nodeValue.trim() === ''));
          const open = `<${node.nodeName}${attrs}`;
          if (!kids.length) { out.push(`${ind}${open}/>`); return; }
          if (kids.length === 1 && kids[0].nodeType === 3) {
            out.push(`${ind}${open}>${escText(kids[0].nodeValue.trim())}</${node.nodeName}>`);
            return;
          }
          out.push(`${ind}${open}>`);
          for (const c of kids) walk(c, ind + '  ');
          out.push(`${ind}</${node.nodeName}>`);
          return;
        }
        case 3: out.push(ind + escText(node.nodeValue.trim())); return;
        case 4: out.push(`${ind}<![CDATA[${node.nodeValue}]]>`); return;
        case 7: out.push(`${ind}<?${node.target} ${node.data}?>`); return;
        case 8: out.push(`${ind}<!--${node.nodeValue}-->`); return;
        case 10: out.push(`<!DOCTYPE ${node.name}>`); return;
      }
    }
    for (const c of Array.from(doc.childNodes)) walk(c, '');
    return out.join('\n');
  }

  function normalize(text, format) {
    if (format === 'json') return formatJSON(text);
    if (format === 'xml') return formatXML(text);
    return text;
  }

  const api = { normalize, formatJSON, formatXML, parseJSON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Formatter = api;
})(typeof self !== 'undefined' ? self : this);
