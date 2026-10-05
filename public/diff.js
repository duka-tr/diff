/*
 * Diff motoru — bağımlılıksız.
 * Myers O(ND) algoritması, doğrusal bellekli "middle snake" bölme yaklaşımıyla
 * (diff-match-patch'teki bisect mantığının tamsayı dizilerine uyarlanmış hali).
 * Hem Web Worker içinde (importScripts) hem Node'da (testler) çalışır.
 */
(function (root) {
  'use strict';

  const EQ = 0, DEL = 1, INS = 2;

  // a, b: tamsayı dizileri. Dönüş: [op, adet, op, adet, ...] düz dizi.
  function diffSeq(a, b, deadline) {
    const out = [];

    function push(op, n) {
      if (!n) return;
      const L = out.length;
      if (L && out[L - 2] === op) out[L - 1] += n;
      else out.push(op, n);
    }

    function bisect(aLo, aHi, bLo, bHi) {
      const n = aHi - aLo, m = bHi - bLo;
      const maxD = Math.ceil((n + m) / 2);
      const off = maxD, len = 2 * maxD + 2;
      const v1 = new Int32Array(len).fill(-1);
      const v2 = new Int32Array(len).fill(-1);
      v1[off + 1] = 0;
      v2[off + 1] = 0;
      const delta = n - m;
      const front = (delta & 1) !== 0;
      let k1s = 0, k1e = 0, k2s = 0, k2e = 0;

      for (let d = 0; d < maxD; d++) {
        if (deadline && (d & 31) === 0 && Date.now() > deadline) return null;

        for (let k1 = -d + k1s; k1 <= d - k1e; k1 += 2) {
          const k1o = off + k1;
          let x1 = (k1 === -d || (k1 !== d && v1[k1o - 1] < v1[k1o + 1]))
            ? v1[k1o + 1] : v1[k1o - 1] + 1;
          let y1 = x1 - k1;
          while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) { x1++; y1++; }
          v1[k1o] = x1;
          if (x1 > n) k1e += 2;
          else if (y1 > m) k1s += 2;
          else if (front) {
            const k2o = off + delta - k1;
            if (k2o >= 0 && k2o < len && v2[k2o] !== -1) {
              if (x1 >= n - v2[k2o]) return [aLo + x1, bLo + y1];
            }
          }
        }

        for (let k2 = -d + k2s; k2 <= d - k2e; k2 += 2) {
          const k2o = off + k2;
          let x2 = (k2 === -d || (k2 !== d && v2[k2o - 1] < v2[k2o + 1]))
            ? v2[k2o + 1] : v2[k2o - 1] + 1;
          let y2 = x2 - k2;
          while (x2 < n && y2 < m && a[aHi - 1 - x2] === b[bHi - 1 - y2]) { x2++; y2++; }
          v2[k2o] = x2;
          if (x2 > n) k2e += 2;
          else if (y2 > m) k2s += 2;
          else if (!front) {
            const k1o = off + delta - k2;
            if (k1o >= 0 && k1o < len && v1[k1o] !== -1) {
              const x1 = v1[k1o];
              const y1 = off + x1 - k1o;
              if (x1 >= n - x2) return [aLo + x1, bLo + y1];
            }
          }
        }
      }
      return null;
    }

    function rec(aLo, aHi, bLo, bHi) {
      let p = 0;
      while (aLo + p < aHi && bLo + p < bHi && a[aLo + p] === b[bLo + p]) p++;
      push(EQ, p);
      aLo += p; bLo += p;

      let s = 0;
      while (aHi - s > aLo && bHi - s > bLo && a[aHi - 1 - s] === b[bHi - 1 - s]) s++;
      aHi -= s; bHi -= s;

      if (aLo === aHi) push(INS, bHi - bLo);
      else if (bLo === bHi) push(DEL, aHi - aLo);
      else {
        const sp = bisect(aLo, aHi, bLo, bHi);
        if (sp) {
          rec(aLo, sp[0], bLo, sp[1]);
          rec(sp[0], aHi, sp[1], bHi);
        } else {
          push(DEL, aHi - aLo);
          push(INS, bHi - bLo);
        }
      }
      push(EQ, s);
    }

    rec(0, a.length, 0, b.length);
    return out;
  }

  /* ---------- Metin yardımcıları ---------- */

  function splitLines(text) {
    if (text === '') return [];
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  // Büyük/küçük harf katlama.
  // turkishCase açık: Türkçe kurallar (I↔ı, İ↔i) — "SATIR" = "satır", "kır" ≠ "kir", ama "FILE" ≠ "file".
  // turkishCase kapalı: I/ı/İ/i aynı kabul edilir — hem Türkçe hem İngilizce metinde eşleşir, "kır" = "kir".
  function fold(s, opts) {
    if (opts.turkishCase) return s.toLocaleLowerCase('tr');
    return s.toLowerCase().replace(/i̇/g, 'i').replace(/ı/g, 'i');
  }

  function normalizeLine(s, opts) {
    if (opts.whitespace === 'trim') s = s.trim();
    else if (opts.whitespace === 'all') s = s.replace(/\s+/g, '');
    if (opts.ignoreCase) s = fold(s, opts);
    return s;
  }

  function isBlank(s) {
    return s.trim() === '';
  }

  function Interner() {
    const map = new Map();
    return function (key) {
      let id = map.get(key);
      if (id === undefined) { id = map.size; map.set(key, id); }
      return id;
    };
  }

  /* ---------- Satır içi (kelime / karakter) fark ---------- */

  const WORD_RE = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
  const MAX_INLINE_TOKENS = 5000;

  function tokenize(s, mode) {
    return mode === 'char' ? Array.from(s) : (s.match(WORD_RE) || []);
  }

  function normToken(t, opts) {
    if (opts.whitespace !== 'none' && /^\s+$/.test(t)) return opts.whitespace === 'all' ? '' : ' ';
    return opts.ignoreCase ? fold(t, opts) : t;
  }

  // Dönüş: { a: [[metin, değişti], ...], b: [...] } veya null (vurgulamaya değmez)
  function inlineDiff(aText, bText, opts) {
    const ta = tokenize(aText, opts.inline);
    const tb = tokenize(bText, opts.inline);
    if (ta.length > MAX_INLINE_TOKENS || tb.length > MAX_INLINE_TOKENS) return null;

    const intern = Interner();
    const sa = ta.map(t => intern(normToken(t, opts)));
    const sb = tb.map(t => intern(normToken(t, opts)));
    const ops = diffSeq(sa, sb, Date.now() + 150);

    const segA = [], segB = [];
    const add = (segs, text, changed) => {
      if (!text) return;
      const L = segs.length;
      if (L && segs[L - 1][1] === changed) segs[L - 1][0] += text;
      else segs.push([text, changed]);
    };

    let i = 0, j = 0, same = 0;
    for (let k = 0; k < ops.length; k += 2) {
      const op = ops[k], n = ops[k + 1];
      if (op === EQ) {
        for (let c = 0; c < n; c++) {
          same += ta[i].length;
          add(segA, ta[i++], false);
          add(segB, tb[j++], false);
        }
      } else if (op === DEL) {
        for (let c = 0; c < n; c++) add(segA, ta[i++], true);
      } else {
        for (let c = 0; c < n; c++) add(segB, tb[j++], true);
      }
    }

    // Satırlar birbirine çok az benziyorsa parça parça boyamak okunurluğu bozar.
    const longest = Math.max(aText.length, bText.length);
    if (longest > 0 && same / longest < 0.3) return null;
    return { a: segA, b: segB };
  }

  /* ---------- Ana karşılaştırma ---------- */

  /*
   * opts: { whitespace: 'none'|'trim'|'all', ignoreCase, turkishCase, ignoreBlank, inline: 'word'|'char'|'off' }
   * Satır tipleri:
   *   equal — iki tarafta aynı (yok sayılan farklar hariç)
   *   mod   — değişmiş satır çifti (satır içi vurgu olabilir)
   *   del   — yalnızca solda
   *   ins   — yalnızca sağda
   *   skip  — "boş satırları yok say" ile karşılaştırma dışı kalan boş satır
   */
  function compare(leftText, rightText, opts) {
    const A = splitLines(leftText);
    const B = splitLines(rightText);
    const intern = Interner();

    const idxA = [], seqA = [], idxB = [], seqB = [];
    for (let i = 0; i < A.length; i++) {
      if (opts.ignoreBlank && isBlank(A[i])) continue;
      idxA.push(i); seqA.push(intern(normalizeLine(A[i], opts)));
    }
    for (let i = 0; i < B.length; i++) {
      if (opts.ignoreBlank && isBlank(B[i])) continue;
      idxB.push(i); seqB.push(intern(normalizeLine(B[i], opts)));
    }

    const ops = diffSeq(seqA, seqB, Date.now() + 10000);
    const rows = [];
    let pa = 0, pb = 0; // ham satır imleçleri
    let x = 0, y = 0;   // filtrelenmiş dizi imleçleri
    let added = 0, removed = 0, blocks = 0;

    // Atlanan boş satırları (varsa) sırayla döker.
    function flushSkips(toA, toB) {
      const sa = [], sb = [];
      while (pa < toA) sa.push(pa++);
      while (pb < toB) sb.push(pb++);
      const n = Math.max(sa.length, sb.length);
      for (let k = 0; k < n; k++) {
        const ia = sa[k], ib = sb[k];
        rows.push({
          type: 'skip',
          aNo: ia === undefined ? null : ia + 1,
          bNo: ib === undefined ? null : ib + 1,
          aText: ia === undefined ? null : A[ia],
          bText: ib === undefined ? null : B[ib],
        });
      }
    }

    for (let k = 0; k < ops.length;) {
      if (ops[k] === EQ) {
        const n = ops[k + 1];
        for (let c = 0; c < n; c++, x++, y++) {
          flushSkips(idxA[x], idxB[y]);
          rows.push({ type: 'equal', aNo: pa + 1, bNo: pb + 1, aText: A[pa], bText: B[pb] });
          pa++; pb++;
        }
        k += 2;
        continue;
      }

      // Ardışık DEL/INS koşularını tek bir değişiklik bloğunda topla.
      let nd = 0, ni = 0;
      while (k < ops.length && ops[k] !== EQ) {
        if (ops[k] === DEL) nd += ops[k + 1]; else ni += ops[k + 1];
        k += 2;
      }
      const dels = idxA.slice(x, x + nd);
      const inss = idxB.slice(y, y + ni);
      x += nd; y += ni;

      const block = blocks++;
      removed += nd;
      added += ni;

      // Atlanan boş satırlar ham sıralarına göre araya girer.
      const pairs = Math.min(nd, ni);
      for (let c = 0; c < pairs; c++) {
        flushSkips(dels[c], inss[c]);
        const aT = A[dels[c]], bT = B[inss[c]];
        const row = { type: 'mod', block, aNo: dels[c] + 1, bNo: inss[c] + 1, aText: aT, bText: bT };
        if (opts.inline !== 'off') {
          const seg = inlineDiff(aT, bT, opts);
          if (seg) { row.aSegs = seg.a; row.bSegs = seg.b; }
        }
        rows.push(row);
        pa = dels[c] + 1; pb = inss[c] + 1;
      }
      for (let c = pairs; c < nd; c++) {
        flushSkips(dels[c], pb);
        rows.push({ type: 'del', block, aNo: dels[c] + 1, bNo: null, aText: A[dels[c]], bText: null });
        pa = dels[c] + 1;
      }
      for (let c = pairs; c < ni; c++) {
        flushSkips(pa, inss[c]);
        rows.push({ type: 'ins', block, aNo: null, bNo: inss[c] + 1, aText: null, bText: B[inss[c]] });
        pb = inss[c] + 1;
      }
    }
    flushSkips(A.length, B.length);

    return {
      rows,
      stats: { added, removed, blocks, leftLines: A.length, rightLines: B.length },
    };
  }

  const api = { diffSeq, compare, splitLines, inlineDiff, EQ, DEL, INS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DiffEngine = api;
})(typeof self !== 'undefined' ? self : this);
