'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../public/diff.js');

function lcsLen(a, b) {
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function apply(a, b, ops) {
  const ra = [], rb = [];
  let i = 0, j = 0, eq = 0;
  for (let k = 0; k < ops.length; k += 2) {
    const op = ops[k], n = ops[k + 1];
    for (let c = 0; c < n; c++) {
      if (op === D.EQ) { assert.strictEqual(a[i], b[j]); ra.push(a[i++]); rb.push(b[j++]); eq++; }
      else if (op === D.DEL) ra.push(a[i++]);
      else rb.push(b[j++]);
    }
  }
  return { ra, rb, eq };
}

test('diffSeq: correct and minimal on random sequences', () => {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 3000; t++) {
    const alpha = 1 + Math.floor(rnd() * 5);
    const a = Array.from({ length: Math.floor(rnd() * 30) }, () => Math.floor(rnd() * alpha));
    const b = Array.from({ length: Math.floor(rnd() * 30) }, () => Math.floor(rnd() * alpha));
    const ops = D.diffSeq(a, b);
    const { ra, rb, eq } = apply(a, b, ops);
    assert.deepStrictEqual(ra, a);
    assert.deepStrictEqual(rb, b);
    assert.strictEqual(eq, lcsLen(a, b), `not minimal: ${a} | ${b}`);
  }
});

const base = { whitespace: 'none', ignoreCase: false, ignoreBlank: false, inline: 'word' };

test('compare: basic insert/delete/modify', () => {
  const r = D.compare('a\nb\nc\nd', 'a\nB\nc\ne\nf', base);
  assert.deepStrictEqual(r.rows.map(x => x.type), ['equal', 'mod', 'equal', 'mod', 'ins']);
  assert.strictEqual(r.stats.added, 3);
  assert.strictEqual(r.stats.removed, 2);
  assert.strictEqual(r.stats.blocks, 2);
});

test('compare: ignore case, including Turkish İ', () => {
  const o = { ...base, ignoreCase: true };
  const r = D.compare('İSTANBUL\nFILE\nSATIR', 'istanbul\nfile\nsatır', o);
  assert.ok(r.rows.every(x => x.type === 'equal'));
});

test('compare: Turkish case rules', () => {
  const o = { ...base, ignoreCase: true, turkishCase: true };
  const same = (a, b) => D.compare(a, b, o).stats.blocks === 0;
  assert.ok(same('SATIR', 'satır'));
  assert.ok(same('İSTANBUL', 'istanbul'));
  assert.ok(same('IĞDIR', 'ığdır'));
  assert.ok(!same('kır', 'kir'));
  assert.ok(!same('FILE', 'file'));
  // When off, I/ı/İ/i are all the same
  assert.ok(D.compare('kır', 'kir', { ...base, ignoreCase: true }).stats.blocks === 0);
});

test('compare: whitespace options', () => {
  assert.ok(D.compare('  a b  ', 'a b', { ...base, whitespace: 'trim' }).rows.every(x => x.type === 'equal'));
  assert.ok(D.compare('a  b', 'ab', { ...base, whitespace: 'all' }).rows.every(x => x.type === 'equal'));
  assert.strictEqual(D.compare('a  b', 'ab', { ...base, whitespace: 'trim' }).stats.blocks, 1);
});

test('compare: ignore blank lines', () => {
  const r = D.compare('a\n\nb\n\n\nc', 'a\nb\nc\n', { ...base, ignoreBlank: true });
  assert.strictEqual(r.stats.blocks, 0);
  assert.strictEqual(r.rows.filter(x => x.type === 'skip').length, 3);
  assert.deepStrictEqual(r.rows.filter(x => x.aNo).map(x => x.aNo), [1, 2, 3, 4, 5, 6]);
});

test('compare: CRLF and LF are equal', () => {
  assert.strictEqual(D.compare('a\r\nb\r\n', 'a\nb', base).stats.blocks, 0);
});

test('compare: every line appears exactly once on each side', () => {
  const left = Array.from({ length: 500 }, (_, i) => (i % 7 === 0 ? '' : 'L' + (i % 13))).join('\n');
  const right = Array.from({ length: 480 }, (_, i) => (i % 5 === 0 ? '' : 'L' + (i % 11))).join('\n');
  for (const ignoreBlank of [false, true]) {
    const r = D.compare(left, right, { ...base, ignoreBlank });
    const aNos = r.rows.filter(x => x.aNo).map(x => x.aNo);
    const bNos = r.rows.filter(x => x.bNo).map(x => x.bNo);
    assert.deepStrictEqual(aNos, Array.from({ length: 500 }, (_, i) => i + 1));
    assert.deepStrictEqual(bNos, Array.from({ length: 480 }, (_, i) => i + 1));
  }
});

test('inlineDiff: word level', () => {
  const s = D.inlineDiff('const x = 10;', 'const y = 10;', base);
  assert.deepStrictEqual(s.a.filter(p => p[1]).map(p => p[0]), ['x']);
  assert.deepStrictEqual(s.b.filter(p => p[1]).map(p => p[0]), ['y']);
});

test('inlineDiff: limits from opts are honored', () => {
  const a = 'one two three four', b = 'one two THREE four';
  assert.ok(D.inlineDiff(a, b, base));
  assert.strictEqual(D.inlineDiff(a, b, { ...base, limits: { maxInlineTokens: 3 } }), null);
  assert.strictEqual(D.inlineDiff(a, b, { ...base, limits: { inlineMinSimilarity: 0.99 } }), null);
});

test('performance: 10k lines', () => {
  const left = Array.from({ length: 10000 }, (_, i) => `satır ${i} içerik ${i * 7 % 101}`);
  const right = left.slice();
  for (let i = 0; i < 10000; i += 37) right[i] = right[i] + ' değişti';
  right.splice(5000, 200);
  const t0 = Date.now();
  const r = D.compare(left.join('\n'), right.join('\n'), base);
  const ms = Date.now() - t0;
  assert.ok(ms < 3000, `too slow: ${ms}ms`);
  console.log(`  10k lines: ${ms}ms, ${r.stats.blocks} blocks`);
  const t1 = Date.now();
  const rnd = Array.from({ length: 10000 }, (_, i) => 'x' + ((i * 7919) % 10007));
  D.compare(left.join('\n'), rnd.join('\n'), base);
  console.log(`  10k completely different: ${Date.now() - t1}ms`);
});

const F = require('../public/format.js');

test('formatJSON: key order and indentation are ignored', () => {
  const a = F.formatJSON('{"b": 1, "a": {"y": [1, 2], "x": "ç"}}');
  const b = F.formatJSON('{\n  "a": {"x": "\\u00e7", "y": [1,2]},\n  "b": 1\n}');
  assert.strictEqual(a, b);
  assert.strictEqual(a, '{\n  "a": {\n    "x": "ç",\n    "y": [\n      1,\n      2\n    ]\n  },\n  "b": 1\n}');
});

test('formatJSON: array order and number notation are kept', () => {
  assert.notStrictEqual(F.formatJSON('[1, 2]'), F.formatJSON('[2, 1]'));
  // JSON.parse turns these two numbers into the same value; we must not
  assert.notStrictEqual(F.formatJSON('{"id": 12345678901234567890}'), F.formatJSON('{"id": 12345678901234567891}'));
  assert.strictEqual(F.formatJSON('{"n": 1.50}'), '{\n  "n": 1.50\n}');
  assert.strictEqual(F.formatJSON('  '), '');
  assert.strictEqual(F.formatJSON('{}'), '{}');
  assert.strictEqual(F.formatJSON('﻿[]'), '[]');
});

test('formatJSON: invalid JSON is rejected with its position', () => {
  for (const bad of ['{"a": 1,}', '{"a" 1}', '[1, 2', '{"a": tru}', '{"a": "x\ny"}', '01', '{} x']) {
    assert.throws(() => F.formatJSON(bad), e => e.code === 'json' && e.line >= 1 && e.col >= 1, bad);
  }
  try { F.formatJSON('{\n  "a": 1,\n  "b": ?\n}'); } catch (e) { assert.deepStrictEqual([e.line, e.col], [3, 8]); }
});
