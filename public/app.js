'use strict';
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Settings (preferences only; texts are never stored) ---------- */
  const PREF_KEY = 'dc.prefs';
  const THEME_KEY = 'dc.theme';
  const CFG = window.APP_CONFIG || {};
  const LANGS = Object.keys(I18N);

  // Allowed values per option; anything else (bad config, stale storage) falls back to the default.
  const CHOICES = {
    format: ['text', 'json', 'xml'],
    whitespace: ['none', 'trim', 'all'],
    inline: ['word', 'char', 'off'],
    view: ['split', 'unified'],
    lang: LANGS,
  };
  const BOOLS = ['ignoreCase', 'turkishCase', 'ignoreBlank', 'hide'];
  const isValid = (k, v) =>
    CHOICES[k] ? CHOICES[k].includes(v) :
    BOOLS.includes(k) ? typeof v === 'boolean' :
    k === 'context' ? Number.isInteger(v) && v >= 0 : false;

  // First browser language the UI supports, else English.
  function detectLang() {
    for (const l of navigator.languages || [navigator.language]) {
      const base = String(l || '').toLowerCase().split('-')[0];
      if (LANGS.includes(base)) return base;
    }
    return LANGS.includes('en') ? 'en' : LANGS[0];
  }

  const defaults = {
    lang: detectLang(), format: 'text', whitespace: 'none', ignoreCase: false, turkishCase: false,
    ignoreBlank: false, inline: 'word', view: 'split', hide: false, context: 5,
  };
  for (const k in defaults) if (isValid(k, CFG[k])) defaults[k] = CFG[k];

  const contextOptions = (Array.isArray(CFG.contextOptions) ? CFG.contextOptions : [0, 3, 5, 10, 20])
    .filter(n => isValid('context', n));
  if (!contextOptions.includes(defaults.context)) contextOptions.push(defaults.context);
  contextOptions.sort((a, b) => a - b);

  // Only options the visitor actually changed are stored, so config/browser defaults keep applying to the rest.
  let saved = {};
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    for (const k in raw) if (k in defaults && isValid(k, raw[k])) saved[k] = raw[k];
  } catch (_) { /* storage may be unavailable */ }
  if (!contextOptions.includes(saved.context)) delete saved.context;
  const prefs = { ...defaults, ...saved };

  function setPref(key, value) {
    prefs[key] = value;
    saved[key] = value;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(saved)); } catch (_) {}
  }

  /* ---------- Language ---------- */
  // title/tagline/footer can be overridden in config.js, as a string or one string per language.
  function fromConfig(key) {
    const v = CFG[key];
    if (typeof v === 'string') return v || null;
    if (v && typeof v === 'object') return v[prefs.lang] || null;
    return null;
  }

  function t(key, vars) {
    let s = fromConfig(key) ?? I18N[prefs.lang][key] ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  const fmt = (n) => n.toLocaleString(prefs.lang);

  function applyLang() {
    document.documentElement.lang = prefs.lang;
    document.title = t('title');
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    $$('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    $$('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === prefs.lang));
    updateCounts();
    if (state.result) render();
  }

  /* ---------- Elements ---------- */
  const leftEl = $('#leftText'), rightEl = $('#rightText');
  const resultEl = $('#result'), wrapEl = $('#diffWrap');
  const optFormat = $('#optFormat');
  const optWs = $('#optWhitespace'), optCase = $('#optCase'), optTurkish = $('#optTurkish'), optBlank = $('#optBlank');
  const optInline = $('#optInline'), optHide = $('#optHide'), optContext = $('#optContext');

  // Controls built from config / available languages.
  optContext.innerHTML = contextOptions.map(n => `<option value="${n}">${n}</option>`).join('');
  $('#langSeg').innerHTML = LANGS.map(l => `<button type="button" data-lang="${l}">${l.toUpperCase()}</button>`).join('');
  if (LANGS.length < 2) $('#langSeg').hidden = true;

  const state = {
    result: null,         // result from the worker
    reqId: 0,             // id of the latest request; older responses are dropped
    reqFormat: 'text',    // format of the latest request
    ran: false,           // the user has compared at least once
    expanded: new Set(),  // start indexes of hidden blocks the user expanded
    blockStarts: [],      // first row index of each change block
    current: -1,          // selected block
  };

  /* ---------- Worker ---------- */
  const worker = new Worker('worker.js?v=__V__');
  worker.onmessage = (e) => {
    const { id, result, error } = e.data;
    if (id !== state.reqId) return; // stale response
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
      limits: CFG.limits,
    };
  }

  function showMessage(html, scroll) {
    state.reqId++; // invalidate any pending response
    state.result = null;
    state.blockStarts = [];
    $('#stats').innerHTML = '';
    setStale(false);
    wrapEl.innerHTML = html;
    updateNav();
    if (scroll) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function runCompare(scroll) {
    let left = leftEl.value, right = rightEl.value;
    resultEl.hidden = false;
    state.ran = true;
    if (left === '' && right === '') {
      showMessage(`<div class="msg">${esc(t('empty'))}</div>`, false);
      return;
    }
    const format = prefs.format;
    if (format !== 'text') {
      let side = 'left';
      try {
        left = Formatter.normalize(left, format);
        side = 'right';
        right = Formatter.normalize(right, format);
      } catch (err) {
        const pos = err.line ? t('formatPos', { line: err.line, col: err.col }) : '';
        const msg = t('formatError', { side: t(side === 'left' ? 'sideLeft' : 'sideRight'), fmt: format.toUpperCase(), pos });
        showMessage(`<div class="msg error">${esc(msg)}</div>`, scroll);
        return;
      }
    }
    state.reqFormat = format;
    const id = ++state.reqId;
    if (!state.result) wrapEl.innerHTML = `<div class="msg">${esc(t('computing'))}</div>`;
    worker.postMessage({ id, left, right, opts: currentOpts() });
    if (scroll) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Rendering ---------- */
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

  // Visible items: a row index, or { gap: [start, end) } for a collapsed run.
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
      // Showing a single line reads better than hiding it behind a gap.
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

  /* ---------- Change navigation ---------- */
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

  /* ---------- UI helpers ---------- */
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

  // When the content is replaced entirely, move the caret and the view to the start
  // (otherwise a long last line leaves the box scrolled to the right).
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

  /* ---------- Events ---------- */
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

  // Comparison options: recompute if a comparison has been run.
  function onCompareOpt(key, value) {
    setPref(key, value);
    syncControls();
    if (state.ran) runCompare(false);
  }
  optFormat.addEventListener('change', () => onCompareOpt('format', optFormat.value));
  optWs.addEventListener('change', () => onCompareOpt('whitespace', optWs.value));
  optCase.addEventListener('change', () => onCompareOpt('ignoreCase', optCase.checked));
  optTurkish.addEventListener('change', () => onCompareOpt('turkishCase', optTurkish.checked));
  optBlank.addEventListener('change', () => onCompareOpt('ignoreBlank', optBlank.checked));
  optInline.addEventListener('change', () => onCompareOpt('inline', optInline.value));

  // View options: redraw only.
  function onViewOpt(key, value) {
    setPref(key, value);
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

  // In the split view, keep a text selection within one column.
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
    setPref('lang', b.dataset.lang);
    applyLang();
  }));

  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch (_) {}
  });

  /* ---------- Startup ---------- */
  syncControls();
  applyLang();
})();
