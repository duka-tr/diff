'use strict';
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Ayarlar (yalnızca tercihler; metinler asla saklanmaz) ---------- */
  const PREF_KEY = 'dc.prefs';
  // Site ayarları (config.js). Dosya yoksa varsayılanlar kullanılır.
  const CFG = window.APP_CONFIG || {};
  const defaults = {
    lang: 'tr', format: 'text', whitespace: 'none', ignoreCase: false, turkishCase: false, ignoreBlank: false,
    inline: 'word', view: 'split', hide: false, context: 5,
  };
  for (const k of ['lang', 'view', 'hide', 'context']) if (CFG[k] !== undefined) defaults[k] = CFG[k];
  // Kullanıcının kendi seçtiği tercihler, sunucu varsayılanlarından önceliklidir.
  let prefs = { ...defaults };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (_) {}
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (_) {} };

  /* ---------- Dil ---------- */
  function t(key, vars) {
    if ((key === 'title' || key === 'tagline' || key === 'footer') && CFG[key]) return CFG[key];
    const dict = I18N[prefs.lang] || I18N.tr;
    let s = dict[key] ?? I18N.tr[key] ?? key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  const fmt = (n) => n.toLocaleString(prefs.lang === 'tr' ? 'tr-TR' : 'en-US');

  function applyLang() {
    document.documentElement.lang = prefs.lang;
    document.title = t('title');
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === prefs.lang));
    updateCounts();
    if (state.result) render();
  }

  /* ---------- Elemanlar ---------- */
  const leftEl = $('#leftText'), rightEl = $('#rightText');
  const resultEl = $('#result'), wrapEl = $('#diffWrap');
  const optFormat = $('#optFormat');
  const optWs = $('#optWhitespace'), optCase = $('#optCase'), optTurkish = $('#optTurkish'), optBlank = $('#optBlank');
  const optInline = $('#optInline'), optHide = $('#optHide'), optContext = $('#optContext');

  const state = {
    result: null,       // worker'dan gelen sonuç
    expanded: new Set(), // açılmış gizli blokların başlangıç indeksleri
    blockStarts: [],    // her değişiklik bloğunun ilk satır indeksi
    current: -1,        // seçili blok
    stale: false,
    reqId: 0,
  };

  /* ---------- Worker ---------- */
  const worker = new Worker('worker.js?v=__V__');
  worker.onmessage = (e) => {
    const { id, result, error } = e.data;
    if (id !== state.reqId) return; // eski istek
    if (error) {
      wrapEl.innerHTML = `<div class="msg">${esc(t('error', { msg: error }))}</div>`;
      return;
    }
    result.format = state.reqFormat;
    state.result = result;
    state.expanded.clear();
    state.current = -1;
    setStale(false);
    render();
  };

  function currentOpts() {
    return {
      whitespace: prefs.whitespace,
      ignoreCase: prefs.ignoreCase,
      turkishCase: prefs.turkishCase,
      ignoreBlank: prefs.ignoreBlank,
      inline: prefs.inline,
    };
  }

  function runCompare(scroll) {
    let left = leftEl.value, right = rightEl.value;
    resultEl.hidden = false;
    state.ran = true;
    if (left === '' && right === '') {
      state.result = null;
      $('#stats').innerHTML = '';
      wrapEl.innerHTML = `<div class="msg">${esc(t('empty'))}</div>`;
      updateNav();
      return;
    }
    const format = prefs.format;
    if (format !== 'text') {
      const fmtName = format.toUpperCase();
      let side = 'left';
      try {
        left = Formatter.normalize(left, format);
        side = 'right';
        right = Formatter.normalize(right, format);
      } catch (err) {
        state.reqId++; // bekleyen bir sonucu geçersiz kıl
        state.result = null;
        $('#stats').innerHTML = '';
        setStale(false);
        const pos = err.line ? t('formatPos', { line: err.line, col: err.col }) : '';
        const sideName = t(side === 'left' ? 'left' : 'right');
        wrapEl.innerHTML = `<div class="msg error">${esc(t('formatError', { side: prefs.lang === 'tr' ? sideName : sideName.toLowerCase(), fmt: fmtName, pos }))}</div>`;
        updateNav();
        if (scroll) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    state.reqFormat = format;
    const id = ++state.reqId;
    if (!state.result) wrapEl.innerHTML = `<div class="msg">${esc(t('computing'))}</div>`;
    worker.postMessage({ id, left, right, opts: currentOpts() });
    if (scroll) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Görüntüleme ---------- */
  function esc(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function codeHtml(text, segs) {
    if (text == null) return '';
    if (!segs) return esc(text);
    let h = '';
    for (const [s, changed] of segs) h += changed ? `<mark>${esc(s)}</mark>` : esc(s);
    return h;
  }

  const isChange = (r) => r.type === 'mod' || r.type === 'del' || r.type === 'ins';

  // Görünür öğeler listesi: { row: i } veya { gap: [start, end) }
  function buildItems(rows) {
    const items = [];
    if (!prefs.hide) {
      for (let i = 0; i < rows.length; i++) items.push(i);
      return items;
    }
    const ctx = prefs.context;
    const n = rows.length;
    const keep = new Uint8Array(n);
    let last = -Infinity;
    for (let i = 0; i < n; i++) {
      if (isChange(rows[i])) last = i;
      if (i - last <= ctx) keep[i] = 1;
    }
    last = Infinity;
    for (let i = n - 1; i >= 0; i--) {
      if (isChange(rows[i])) last = i;
      if (last - i <= ctx) keep[i] = 1;
    }
    for (let i = 0; i < n;) {
      if (keep[i]) { items.push(i); i++; continue; }
      let j = i;
      while (j < n && !keep[j]) j++;
      // Tek bir satırı gizlemek yerine göstermek daha okunur.
      if (j - i < 2 || state.expanded.has(i)) for (let k = i; k < j; k++) items.push(k);
      else items.push({ gap: [i, j] });
      i = j;
    }
    return items;
  }

  function gapRow(g, cols) {
    return `<tr class="gap"><td colspan="${cols}"><button type="button" data-gap="${g[0]}">${esc(t('hiddenLines', { n: fmt(g[1] - g[0]) }))}</button></td></tr>`;
  }

  function renderSplit(rows, items) {
    let h = '<table class="diff split"><colgroup><col class="ln"><col><col class="ln"><col></colgroup><tbody>';
    for (const it of items) {
      if (typeof it === 'object') { h += gapRow(it.gap, 4); continue; }
      const r = rows[it];
      let ca = '', cb = '';
      switch (r.type) {
        case 'mod': ca = 'del'; cb = 'ins'; break;
        case 'del': ca = 'del'; cb = 'empty'; break;
        case 'ins': ca = 'empty'; cb = 'ins'; break;
        case 'skip':
          ca = r.aNo == null ? 'empty' : 'muted';
          cb = r.bNo == null ? 'empty' : 'muted';
          break;
      }
      h += `<tr data-i="${it}"><td class="ln">${r.aNo ?? ''}</td><td class="code a ${ca}">${codeHtml(r.aText, r.aSegs)}</td>` +
           `<td class="ln">${r.bNo ?? ''}</td><td class="code b ${cb}">${codeHtml(r.bText, r.bSegs)}</td></tr>`;
    }
    return h + '</tbody></table>';
  }

  function renderUnified(rows, items) {
    let h = '<table class="diff unified"><colgroup><col class="ln"><col class="ln"><col class="sign"><col></colgroup><tbody>';
    const line = (i, cls, a, b, sign, html) =>
      `<tr data-i="${i}" class="${cls}"><td class="ln">${a ?? ''}</td><td class="ln">${b ?? ''}</td><td class="sign">${sign}</td><td class="code">${html}</td></tr>`;
    for (const it of items) {
      if (typeof it === 'object') { h += gapRow(it.gap, 4); continue; }
      const r = rows[it];
      switch (r.type) {
        case 'equal': h += line(it, '', r.aNo, r.bNo, '', codeHtml(r.bText)); break;
        case 'skip': h += line(it, 'u-skip', r.aNo, r.bNo, '', codeHtml(r.aText ?? r.bText)); break;
        case 'del': h += line(it, 'u-del', r.aNo, null, '−', codeHtml(r.aText)); break;
        case 'ins': h += line(it, 'u-ins', null, r.bNo, '+', codeHtml(r.bText)); break;
        case 'mod':
          h += line(it, 'u-del', r.aNo, null, '−', codeHtml(r.aText, r.aSegs));
          h += line(it, 'u-ins', null, r.bNo, '+', codeHtml(r.bText, r.bSegs));
          break;
      }
    }
    return h + '</tbody></table>';
  }

  function renderStats(res) {
    const s = res.stats;
    const el = $('#stats');
    if (s.blocks === 0) {
      const ignoring = res.format !== 'text' || prefs.whitespace !== 'none' || prefs.ignoreCase || prefs.ignoreBlank;
      el.innerHTML = `<span class="same">${esc(t(ignoring ? 'identicalIgnored' : 'identical'))}</span>`;
    } else {
      el.innerHTML =
        `<span class="rem">−${esc(t('statRemoved', { n: fmt(s.removed) }))}</span>` +
        `<span class="add">+${esc(t('statAdded', { n: fmt(s.added) }))}</span>` +
        `<span class="blk">${esc(t('statBlocks', { n: fmt(s.blocks) }))}</span>`;
    }
    if (res.format !== 'text') {
      const f = res.format.toUpperCase();
      el.innerHTML += `<span class="fmt-note" title="${esc(t('fmtNoteHint', { fmt: f }))}">${esc(t('fmtNote', { fmt: f }))} ⓘ</span>`;
    }
  }

  function render() {
    const res = state.result;
    if (!res) return;
    renderStats(res);
    const rows = res.rows;

    state.blockStarts = [];
    let prevBlock = -1;
    for (let i = 0; i < rows.length; i++) {
      const b = rows[i].block;
      if (b !== undefined && b !== prevBlock) { state.blockStarts.push(i); prevBlock = b; }
    }

    const items = buildItems(rows);
    wrapEl.innerHTML = rows.length === 0 ? '' :
      (prefs.view === 'unified' ? renderUnified(rows, items) : renderSplit(rows, items));
    updateNav();
    if (state.current >= 0) markCurrent(false);
  }

  /* ---------- Değişiklikler arası gezinme ---------- */
  function updateNav() {
    const n = state.blockStarts.length;
    $('#prevBtn').disabled = n === 0;
    $('#nextBtn').disabled = n === 0;
    $('#navPos').textContent = n === 0 ? '' : `${state.current >= 0 ? state.current + 1 : '–'} / ${n}`;
  }

  function markCurrent(scroll) {
    $$('tr.current', wrapEl).forEach(tr => tr.classList.remove('current'));
    const rows = state.result.rows;
    const start = state.blockStarts[state.current];
    const block = rows[start].block;
    let first = null;
    for (let i = start; i < rows.length && (rows[i].block === block || rows[i].type === 'skip'); i++) {
      if (rows[i].type === 'skip') continue;
      $$(`tr[data-i="${i}"]`, wrapEl).forEach(tr => { tr.classList.add('current'); first = first || tr; });
    }
    if (scroll && first) {
      const barH = $('.result-bar').offsetHeight;
      const y = first.getBoundingClientRect().top + window.scrollY - barH - 60;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    updateNav();
  }

  function go(dir) {
    const n = state.blockStarts.length;
    if (!n) return;
    if (state.current < 0) state.current = dir > 0 ? 0 : n - 1;
    else state.current = (state.current + dir + n) % n;
    markCurrent(true);
  }

  /* ---------- Yardımcı arayüz ---------- */
  function countLines(s) {
    if (s === '') return 0;
    let n = 1;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
    if (s.endsWith('\n')) n--;
    return n;
  }
  function updateCounts() {
    $('#leftCount').textContent = leftEl.value ? t('lines', { n: fmt(countLines(leftEl.value)) }) : '';
    $('#rightCount').textContent = rightEl.value ? t('lines', { n: fmt(countLines(rightEl.value)) }) : '';
  }

  function setStale(v) {
    state.stale = v;
    $('#staleNote').hidden = !v;
  }

  function syncControls() {
    optFormat.value = prefs.format;
    optWs.value = prefs.whitespace;
    optCase.checked = prefs.ignoreCase;
    optTurkish.checked = prefs.turkishCase;
    optTurkish.disabled = !prefs.ignoreCase;
    $('#turkishWrap').classList.toggle('disabled', !prefs.ignoreCase);
    optBlank.checked = prefs.ignoreBlank;
    optInline.value = prefs.inline;
    optHide.checked = prefs.hide;
    optContext.value = String(prefs.context);
    $('#contextWrap').classList.toggle('disabled', !prefs.hide);
    optContext.disabled = !prefs.hide;
    $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === prefs.view));
  }

  // İçerik tamamen değiştiğinde imleci ve görünümü metnin başına al
  // (uzun son satır yüzünden kutunun sağa kaymasını önler).
  function caretToStart(el) {
    el.setSelectionRange(0, 0);
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }

  function readFile(file, target) {
    const fr = new FileReader();
    fr.onload = () => {
      target.value = fr.result;
      target.dispatchEvent(new Event('input'));
      caretToStart(target);
    };
    fr.onerror = () => alert(t('fileError'));
    fr.readAsText(file);
  }

  /* ---------- Olaylar ---------- */
  $('#compareBtn').addEventListener('click', () => runCompare(true));

  $('#swapBtn').addEventListener('click', () => {
    const tmp = leftEl.value;
    leftEl.value = rightEl.value;
    rightEl.value = tmp;
    updateCounts();
    if (state.result) runCompare(false);
  });

  [leftEl, rightEl].forEach(el => {
    let replacing = false;
    el.addEventListener('paste', () => {
      replacing = el.value === '' || (el.selectionStart === 0 && el.selectionEnd === el.value.length);
    });
    el.addEventListener('input', (e) => {
      updateCounts();
      if (state.result) setStale(true);
      if (replacing && e.inputType === 'insertFromPaste') caretToStart(el);
      replacing = false;
    });
    const pane = el.closest('.pane');
    pane.addEventListener('dragover', (e) => { e.preventDefault(); pane.classList.add('dragover'); });
    pane.addEventListener('dragleave', (e) => { if (!pane.contains(e.relatedTarget)) pane.classList.remove('dragover'); });
    pane.addEventListener('drop', (e) => {
      pane.classList.remove('dragover');
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) { e.preventDefault(); readFile(f, el); }
    });
  });

  $$('[data-file]').forEach(inp => inp.addEventListener('change', () => {
    if (inp.files[0]) readFile(inp.files[0], inp.dataset.file === 'left' ? leftEl : rightEl);
    inp.value = '';
  }));

  $$('[data-clear]').forEach(b => b.addEventListener('click', () => {
    const el = b.dataset.clear === 'left' ? leftEl : rightEl;
    el.value = '';
    el.dispatchEvent(new Event('input'));
    el.focus();
  }));

  // Karşılaştırma seçenekleri: sonuç varsa otomatik yeniden hesapla.
  function onCompareOpt(key, value) {
    prefs[key] = value;
    savePrefs();
    syncControls();
    if (state.ran) runCompare(false);
  }
  optFormat.addEventListener('change', () => onCompareOpt('format', optFormat.value));
  optWs.addEventListener('change', () => onCompareOpt('whitespace', optWs.value));
  optCase.addEventListener('change', () => onCompareOpt('ignoreCase', optCase.checked));
  optTurkish.addEventListener('change', () => onCompareOpt('turkishCase', optTurkish.checked));
  optBlank.addEventListener('change', () => onCompareOpt('ignoreBlank', optBlank.checked));
  optInline.addEventListener('change', () => onCompareOpt('inline', optInline.value));

  // Görünüm seçenekleri: yalnızca yeniden çiz.
  function onViewOpt(key, value) {
    prefs[key] = value;
    savePrefs();
    syncControls();
    render();
  }
  optHide.addEventListener('change', () => { state.expanded.clear(); onViewOpt('hide', optHide.checked); });
  optContext.addEventListener('change', () => { state.expanded.clear(); onViewOpt('context', Number(optContext.value)); });
  $$('[data-view]').forEach(b => b.addEventListener('click', () => onViewOpt('view', b.dataset.view)));

  wrapEl.addEventListener('click', (e) => {
    const g = e.target.closest('[data-gap]');
    if (g) { state.expanded.add(Number(g.dataset.gap)); render(); }
  });

  // Yan yana görünümde seçimi tek sütunla sınırla.
  wrapEl.addEventListener('mousedown', (e) => {
    const table = e.target.closest('table.split');
    if (!table) return;
    const cell = e.target.closest('td.code');
    table.classList.remove('sel-a', 'sel-b');
    if (cell) table.classList.add(cell.classList.contains('a') ? 'sel-a' : 'sel-b');
  });

  $('#prevBtn').addEventListener('click', () => go(-1));
  $('#nextBtn').addEventListener('click', () => go(1));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCompare(true); }
    else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
  });

  $$('[data-lang]').forEach(b => b.addEventListener('click', () => {
    prefs.lang = b.dataset.lang;
    savePrefs();
    applyLang();
  }));

  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
    try { localStorage.setItem('dc.theme', root.dataset.theme); } catch (_) {}
  });

  /* ---------- Başlangıç ---------- */
  syncControls();
  applyLang();
})();
