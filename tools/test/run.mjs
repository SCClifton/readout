#!/usr/bin/env node
// Readout tests. No dependencies: node tools/test/run.mjs
// Covers the runtime's pure logic (formats, pipelines, scalars), every diagnostic it can raise,
// hostile inputs, and the command-line check against good pages and deliberately broken ones.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..', '..', 'skills', 'readout-dashboards');
const R = createRequire(import.meta.url)(join(skill, 'assets', 'readout.js'));
const MINUS = String.fromCharCode(8722);
const TIMES = String.fromCharCode(215);

let pass = 0;
const failures = [];
function test(name, fn) { try { fn(); pass += 1; } catch (e) { failures.push(name + ': ' + e.message); } }
function eq(a, b, what = '') { const x = JSON.stringify(a); const y = JSON.stringify(b); if (x !== y) throw new Error(`${what} expected ${y} but got ${x}`); }
function near(a, b, what = '') { if (!(Math.abs(a - b) < 1e-6)) throw new Error(`${what} expected ${b} but got ${a}`); }
const meta = { title: 'T', asOf: '2026-01-31', source: 'test' };
const prep = (cfg, mounts = null, view = null) => R.prepare(cfg, mounts, view, 'en');
const codes = (P, level) => P.diag.items.filter((d) => !level || d.level === level).map((d) => d.code);
const has = (P, code, level) => { if (!codes(P, level).includes(code)) throw new Error(`expected ${level || 'diagnostic'} ${code}, got ${JSON.stringify(P.diag.items.map((d) => d.level + ' ' + d.code + ' ' + d.path))}`); };
const clean = (P) => { const e = P.diag.items.filter((d) => d.level === 'error'); if (e.length) throw new Error('unexpected errors: ' + JSON.stringify(e)); };
const T = (cols, rows) => ({ cols, rows });

// ---------- formats ----------
const f = new R.Formatter({ locale: 'en', currency: 'USD' });
test('format integers and signs', () => { eq([f.format(1284, 'int'), f.format(-85, 'int', true), f.format(120, 'int', true), f.format(0, 'int', true), f.format(-0.2, 'int', true)], ['1,284', MINUS + '85', '+120', '0', '0']); });
test('format percent, currency, compact', () => { eq([f.format(0.184, 'pct1'), f.format(0.18, 'pct0'), f.format(48250, 'cur0'), f.format(-12.5, 'cur2'), f.format(1284000, 'curCompact'), f.format(12900, 'compact')], ['18.4%', '18%', '$48,250', MINUS + '$12.50', '$1.3M', '12.9K']); });
test('format days and multiples', () => { eq([f.format(12.5, 'days1'), f.format(12, 'days0'), f.format(1.44, 'x1')], ['12.5 d', '12 d', '1.4' + TIMES]); });
test('format dates', () => { eq([f.format('2026-11-20', 'date'), f.format('2026-11-20', 'day'), f.format('2026-11', 'month'), f.format('2026-11-20T17:00+11:00', 'date'), f.format('not a date', 'date')], ['Nov 20, 2026', 'Nov 20', 'Nov 2026', 'Nov 20, 2026, 17:00 UTC+11:00', 'not a date']); });
test('format missing and text', () => { eq([f.format(null), f.format('', 'int'), f.format('abc', 'int'), f.format(5, 'text')], ['n/a', 'n/a', 'abc', '5']); });
test('axis goes compact at ten thousand', () => { eq([f.axis(2000, 'int', 8000), f.axis(20000, 'int', 40000), f.axis(20000, 'cur0', 40000)], ['2,000', '20K', '$20K']); });
test('a bad locale falls back', () => { eq(new R.Formatter({ locale: 'zz-invalid-locale-tag-zz' }).format(1234.5, 'dec1'), '1,234.5'); });
test('nice scales', () => { eq(R.niceScale(0, 1840, 4).ticks, [0, 500, 1000, 1500, 2000]); eq(R.niceScale(3.2, 9.7, 4).ticks, [2, 4, 6, 8, 10]); eq(R.niceScale(5, 5, 4).ticks.length > 1, true); eq(R.niceScale(-40, 60, 4).ticks, [-50, 0, 50, 100]); });
test('formula text', () => { eq(R.exprText(['pos', ['sub', 'wip', 'target']]), 'max(0, wip ' + MINUS + ' target)'); eq(R.exprText(['mul', ['add', 'a', 'b'], 'c']), '(a + b) ' + TIMES + ' c'); eq(R.exprText(['gte', 'x', 2]), '(x >= 2)'); });
test('status thresholds', () => { eq([R.statusOf(1.2, { warning: 1.1, critical: 1.5 }), R.statusOf(1.6, { warning: 1.1, critical: 1.5 }), R.statusOf(1, { warning: 1.1 }), R.statusOf(3, { warning: 5, critical: 2, direction: 'below' }), R.statusOf('x', { warning: 1 })], ['warning', 'critical', null, 'warning', null]); });
test('status thresholds: strict means past a threshold, not at it', () => { eq([R.statusOf(4, { warning: 4 }), R.statusOf(4, { warning: 4, strict: true }), R.statusOf(4.1, { warning: 4, strict: true }), R.statusOf(2, { warning: 2, direction: 'below', strict: true }), R.statusOf(1.9, { warning: 2, direction: 'below', strict: true })], ['warning', null, 'warning', null, 'warning']); });

// ---------- pipelines ----------
const base = () => ({ meta, data: { t: T(['line', 'k', 'v', 'w'], [['A', 'x', 10, 2], ['A', 'y', 20, 0], ['B', 'x', 30, 5], ['B', 'z', 5, 1], ['B', 'z', 15, 3]]) } });
const rows = (cfg, name, view) => prep(cfg, null, view).eng.table(name).rows;
test('where: view, value and list', () => {
  const cfg = base(); cfg.derive = { a: { from: 't', where: { line: '$view' } }, b: { from: 't', where: { k: 'x' } }, c: { from: 't', where: { k: ['y', 'z'] } } };
  eq([rows(cfg, 'a', null).length, rows(cfg, 'a', 'B').length, rows(cfg, 'b').length, rows(cfg, 'c').length], [5, 3, 2, 3]);
});
test('add: arithmetic, nesting and division by zero', () => {
  const cfg = base(); cfg.derive = { a: { from: 't', add: { r: ['div', 'v', 'w'], over: ['pos', ['sub', 'v', 12]], flag: ['mul', 'v', ['gte', 'v', 15]], twice: ['mul', 'r', 2] } } };
  const out = rows(cfg, 'a');
  eq(out.map((r) => r.r), [5, null, 6, 5, 5]); eq(out.map((r) => r.over), [0, 8, 18, 0, 3]); eq(out.map((r) => r.flag), [0, 20, 30, 0, 15]); eq(out[1].twice, null);
});
test('group and aggregates', () => {
  const cfg = base(); cfg.derive = { g: { from: 't', group: 'k', agg: { s: ['sum', 'v'], m: ['mean', 'v'], n: ['count'], lo: ['min', 'v'], hi: ['max', 'v'], med: ['median', 'v'], a: ['first', 'v'], z: ['last', 'v'] } }, n: { from: 't', group: ['line', 'k'] } };
  eq(rows(cfg, 'g'), [{ k: 'x', s: 40, m: 20, n: 2, lo: 10, hi: 30, med: 20, a: 10, z: 30 }, { k: 'y', s: 20, m: 20, n: 1, lo: 20, hi: 20, med: 20, a: 20, z: 20 }, { k: 'z', s: 20, m: 10, n: 2, lo: 5, hi: 15, med: 10, a: 5, z: 15 }]);
  eq(rows(cfg, 'n').map((r) => r.count), [1, 1, 1, 2]);
});
test('bin: edges, empty bins and aggregates', () => {
  const cfg = { meta, data: { t: T(['d', 'q'], [[0, 1], [1.9, 2], [2, 3], [5.5, 4], [9.99, 5], [10, 6]]) }, derive: { b: { from: 't', bin: 'd', step: 2, agg: { q: ['sum', 'q'] } } } };
  const out = rows(cfg, 'b');
  eq(out.map((r) => r.lo), [0, 2, 4, 6, 8, 10]); eq(out.map((r) => r.count), [2, 1, 1, 0, 1, 1]); eq(out.map((r) => r.q), [3, 3, 4, 0, 5, 6]); eq(out[0].bin, '0 to 2');
});
test('bin with decimal steps stays exact', () => {
  const cfg = { meta, data: { t: T(['d'], [[0.1], [0.3], [0.6], [0.7], [1.2]]) }, derive: { b: { from: 't', bin: 'd', step: 0.3 } } };
  eq(rows(cfg, 'b').map((r) => [r.lo, r.count]), [[0, 1], [0.3, 1], [0.6, 2], [0.9, 0], [1.2, 1]]);
});
test('sort, top with Other, and cumulative share', () => {
  const cfg = base(); cfg.derive = { g: { from: 't', group: 'k', agg: { s: ['sum', 'v'] }, sort: '-s', top: 1, cum: 's' }, asc: { from: 't', sort: 'v' }, txt: { from: 't', sort: '-k' } };
  const g = rows(cfg, 'g');
  eq(g.map((r) => [r.k, r.s]), [['x', 40], ['Other', 40]]); near(g[0].sShare, 0.5); near(g[1].sCumShare, 1); eq(g[1]._other, true);
  eq(rows(cfg, 'asc').map((r) => r.v), [5, 10, 15, 20, 30]); eq(rows(cfg, 'txt')[0].k, 'z');
});
test('pipelines chain, and a loop is reported', () => {
  const cfg = base(); cfg.derive = { a: { from: 't', add: { d: ['mul', 'v', 2] } }, b: { from: 'a', group: 'line', agg: { d: ['sum', 'd'] } }, x: { from: 'y' }, y: { from: 'x' } };
  const P = prep(cfg); eq(P.eng.table('b').rows, [{ line: 'A', d: 60 }, { line: 'B', d: 100 }]); has(P, 'D04', 'error');
});
test('scalars', () => {
  const P = prep(base()); const sc = (e) => P.eng.scalar(e, 'x');
  eq([sc(['sum', 't.v']), sc(['mean', 't.v']), sc(['count', 't']), sc(['last', 't.v']), sc(['prev', 't.v']), sc(['max', 't.w']), sc(7)], [80, 16, 5, 15, 5, 5, 7]);
  near(sc(['div', ['sum', 't.v'], ['sum', 't.w']]), 80 / 11); eq(sc(['div', 5, 0]), null); eq(sc(['pos', ['sub', 3, 9]]), 0); clean(P);
});

// ---------- counting, text and dates (found by the first fresh-agent run) ----------
const tk = () => ({ meta, data: { t: T(['id', 'team', 'status', 'opened', 'hours'], [['T-1', 'A', 'Open', '2026-01-30', 2], ['T-2', 'A', 'Closed', '2026-02-01', 6], ['T-3', 'B', 'Closed', '2026-01-20', null], ['T-4', 'B', 'Closed', '2025-12-31', 4]]) } });
test('count takes text columns, and counts only what is present', () => {
  const cfg = tk(); cfg.derive = { g: { from: 't', group: 'team', agg: { n: ['count', 'id'], rows: ['count'], withHours: ['count', 'hours'] } } };
  const P = prep(cfg); clean(P); eq(P.eng.table('g').rows, [{ team: 'A', n: 2, rows: 2, withHours: 2 }, { team: 'B', n: 2, rows: 2, withHours: 1 }]);
  eq([P.eng.scalar(['count', 't.status'], 'x'), P.eng.scalar(['count', 't.hours'], 'x'), P.eng.scalar(['count', 't'], 'x')], [4, 3, 4]);
});
test('summing a text column is an error, not a silent zero', () => {
  const cfg = tk(); cfg.derive = { g: { from: 't', group: 'team', agg: { n: ['sum', 'status'] } } }; has(prep(cfg), 'D06', 'error');
  const P = prep(tk()); eq(P.eng.scalar(['mean', 't.team'], 'x'), null); has(P, 'D06', 'error');
});
test('is: matches text, and a group with no match still shows as zero', () => {
  const cfg = tk(); cfg.derive = { g: { from: 't', add: { open: ['is', 'status', 'Open'], two: ['is', 'hours', 2] }, group: 'team', agg: { open: ['sum', 'open'], two: ['sum', 'two'] } } };
  const P = prep(cfg); clean(P); eq(P.eng.table('g').rows, [{ team: 'A', open: 1, two: 1 }, { team: 'B', open: 0, two: 0 }]);
  has(prep({ ...tk(), derive: { g: { from: 't', add: { o: ['is', 'status'] } } } }), 'D05', 'error');
});
test('week, month and age work on ISO dates', () => {
  const cfg = tk(); cfg.meta = { ...meta, asOf: '2026-01-30' }; cfg.derive = { d: { from: 't', add: { week: ['week', 'opened'], month: ['month', 'opened'], age: ['age', 'opened'] } }, w: { from: 'd', group: 'week', agg: { n: ['count'] }, sort: 'week' } };
  const P = prep(cfg); clean(P);
  eq(P.eng.table('d').rows.map((r) => [r.week, r.month, r.age]), [['2026-01-26', '2026-01', 0], ['2026-01-26', '2026-02', -2], ['2026-01-19', '2026-01', 10], ['2025-12-29', '2025-12', 30]]);
  eq(P.eng.table('w').rows, [{ week: '2025-12-29', n: 1 }, { week: '2026-01-19', n: 1 }, { week: '2026-01-26', n: 2 }]);
  const noDate = tk(); noDate.meta = { title: 'T', source: 's' }; noDate.derive = { d: { from: 't', add: { age: ['age', 'opened'] } } }; has(prep(noDate), 'D03', 'error');
});
test('facts fill titles, follow the data, and report an unknown name', () => {
  const cfg = tk(); cfg.derive = { open: { from: 't', where: { status: 'Open' } }, byTeam: { from: 't', group: 'team', agg: { hours: ['sum', 'hours'] }, sort: '-hours' } };
  cfg.facts = { open: { value: ['count', 'open'] }, share: { value: ['div', ['count', 'open'], ['count', 't']], format: 'pct0' }, worst: { value: ['first', 'byTeam.team'] } };
  cfg.cards = { c: { title: '{worst} leads; {open} open, {share} of all', subtitle: 'About {open}', chart: { type: 'bar', data: 'byTeam', x: 'team', y: 'hours', target: 4 } } };
  const P = prep(cfg); clean(P); eq(P.facts, { open: '1', share: '25%', worst: 'A' }); eq(P.fill(cfg.cards.c.title), 'A leads; 1 open, 25% of all');
  cfg.cards.c.note = 'See {missing}'; has(prep(cfg), 'D04', 'error');
  const bad = tk(); bad.kpis = { k: { label: 'L', value: ['first', 't.team'], unit: 'u' } }; has(prep(bad), 'D06', 'error');
});
test('formula text for the newer operations', () => { eq([R.exprText(['is', 'status', 'Open']), R.exprText(['week', 'opened']), R.exprText(['age', 'opened'])], ['(status is "Open")', 'week of opened', 'days from opened to the as-of date']); });

// ---------- dates, blanks and titles (found by the second fresh-agent run) ----------
test('min and max read a date column as the earliest and the latest', () => {
  const cfg = tk(); cfg.derive = { g: { from: 't', group: 'team', agg: { a: ['min', 'opened'], z: ['max', 'opened'] } } };
  const P = prep(cfg); clean(P);
  eq([P.eng.scalar(['min', 't.opened'], 'x'), P.eng.scalar(['max', 't.opened'], 'x')], ['2025-12-31', '2026-02-01']);
  eq(P.eng.table('g').rows, [{ team: 'A', a: '2026-01-30', z: '2026-02-01' }, { team: 'B', a: '2025-12-31', z: '2026-01-20' }]);
  const Q = prep(tk()); eq(Q.eng.scalar(['max', 't.team'], 'x'), null); has(Q, 'D06', 'error');
});
test('a fact takes a date format, and text stays as written', () => {
  const cfg = tk(); cfg.facts = { from: { value: ['min', 't.opened'], format: 'date' }, to: { value: ['max', 't.opened'], format: 'day' }, who: { value: ['first', 't.team'], format: 'dec1' }, plain: { value: ['first', 't.opened'] } };
  const P = prep(cfg); clean(P); eq(P.facts, { from: 'Dec 31, 2025', to: 'Feb 1', who: 'A', plain: '2026-01-30' });
});
test('a long title is measured as the reader sees it, not as it is written', () => {
  const cfg = tk(); cfg.facts = { aVeryLongFactNameThatTheReaderNeverSees: { value: ['count', 't'] }, anotherLongFactNameForTheSameReason: { value: ['first', 't.team'] } };
  const title = 'Team {anotherLongFactNameForTheSameReason} has {aVeryLongFactNameThatTheReaderNeverSees} tickets in all, which is fine';
  if (title.length <= 90) throw new Error('the written title must be over ninety characters for this test');
  cfg.cards = { c: { title, chart: { type: 'bar', data: 't', x: 'id', y: 'hours' } } };
  const P = prep(cfg); clean(P); if (codes(P).includes('W01')) throw new Error('W01 raised on a title that reads at ' + P.fill(title).length + ' characters');
  cfg.facts.long = { value: ['first', 't.id'] }; cfg.data.t.rows[0][0] = 'x'.repeat(95); cfg.cards.c.title = '{long}';
  has(prep(cfg), 'W01', 'note');
});
test('an age below zero raises a note about a stale as-of date, and until does not', () => {
  const cfg = tk(); cfg.meta = { ...meta, asOf: '2026-01-30' }; cfg.derive = { d: { from: 't', add: { age: ['age', 'opened'] } } };
  const P = prep(cfg); clean(P); has(P, 'N11', 'note');
  if (!P.diag.items.some((x) => x.code === 'N11' && x.msg.includes('2026-02-01') && x.msg.includes('2026-01-30'))) throw new Error('the note does not name both dates');
  cfg.derive = { d: { from: 't', add: { left: ['until', 'opened'] } } };
  const Q = prep(cfg); clean(Q); eq(Q.eng.table('d').rows.map((r) => r.left), [0, 2, -10, -30]); if (codes(Q).includes('N11')) throw new Error('until must not raise N11');
  cfg.meta = { ...meta, asOf: '2026-02-01' }; cfg.derive = { d: { from: 't', add: { age: ['age', 'opened'] } } };
  if (codes(prep(cfg)).includes('N11')) throw new Error('N11 raised although no row is dated after the as-of date');
  const noDate = tk(); noDate.meta = { title: 'T', source: 's' }; noDate.derive = { d: { from: 't', add: { left: ['until', 'opened'] } } }; has(prep(noDate), 'D03', 'error');
});
test('formula text for until', () => { eq(R.exprText(['until', 'due']), 'days from the as-of date to due'); });
test('blanks stay blank through arithmetic and comparisons, and aggregates skip them', () => {
  const cfg = tk(); cfg.derive = { d: { from: 't', add: { within: ['lte', 'hours', 4], twice: ['mul', 'hours', 2], open: ['is', 'status', 'Open'], both: ['add', 'twice', 'within'] } } };
  const P = prep(cfg); clean(P); eq(P.eng.table('d').rows.map((r) => [r.within, r.twice, r.both, r.open]), [[1, 4, 5, 1], [0, 12, 12, 0], [null, null, null, 0], [1, 8, 9, 0]]);
  eq([P.eng.scalar(['sum', 'd.within'], 'x'), P.eng.scalar(['mean', 'd.hours'], 'x'), P.eng.scalar(['count', 'd.hours'], 'x')], [2, 4, 3]);
});

// ---------- CSV tables ----------
test('csv: quotes, commas, line endings and blank lines', () => { eq(R.parseCsv('a,b,c\n1,"x, y",3\r\n"he said ""hi""",,-2.5\n\n'), [['a', 'b', 'c'], ['1', 'x, y', '3'], ['he said "hi"', '', '-2.5']]); eq(R.parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]); });
test('csv: types, missing cells and use in pipelines', () => {
  const P = R.prepare({ meta, derive: { open: { from: 't', where: { status: 'Open' } } }, kpis: { n: { label: 'Open', value: ['count', 'open'], unit: 'tickets' }, m: { label: 'Mean', value: ['mean', 't.hours'], format: 'dec1', unit: 'h' } } }, null, null, 'en', { t: 'id,status,hours\nT-1,Open,2.5\nT-2,Closed,4\nT-3,Open,\n007,Open,.5\n' });
  clean(P); eq([P.kpis.n.value, P.kpis.m.value], [3, 7 / 3]); eq(P.eng.table('t').rows[2], { id: 'T-3', status: 'Open', hours: null }); eq(P.eng.table('t').rows[3].id, 7);
});
test('csv: a ragged line is reported with its line number', () => { const P = R.prepare({ meta }, null, null, 'en', { t: 'a,b\n1,2\n3\n' }); has(P, 'D06', 'error'); if (!P.diag.items.some((x) => x.path.includes('line 3'))) throw new Error('line number missing'); });
test('csv: empty text and a clash with a JSON table are reported', () => { has(R.prepare({ meta }, null, null, 'en', { t: '' }), 'D06', 'error'); has(R.prepare({ meta, data: { t: T(['a'], [[1]]) } }, null, null, 'en', { t: 'a\n1\n' }), 'D04', 'error'); });

// ---------- every diagnostic ----------
const card = (chart) => ({ title: 'A finding', chart });
const d = (name, cfg, code, level = 'error', mounts = null) => test('diagnostic ' + code + ': ' + name, () => has(prep(cfg, mounts), code, level));
d('unknown top-level key', { meta, charts: {} }, 'D05');
d('missing title', { meta: {} }, 'D03');
d('row length', { meta, data: { t: T(['a', 'b'], [[1]]) } }, 'D06');
d('table shape', { meta, data: { t: [1, 2] } }, 'D03');
d('unknown source table', { meta, derive: { a: { from: 'nope' } } }, 'D04');
d('unknown column in where', { ...base(), derive: { a: { from: 't', where: { nope: 1 } } } }, 'D04');
d('unknown operation', { ...base(), derive: { a: { from: 't', add: { z: ['pow', 'v', 2] } } } }, 'D05');
d('wrong arity', { ...base(), derive: { a: { from: 't', add: { z: ['sub', 'v'] } } } }, 'D05');
d('bin without step', { ...base(), derive: { a: { from: 't', bin: 'v' } } }, 'D03');
d('too many bins', { ...base(), derive: { a: { from: 't', bin: 'v', step: 0.01 } } }, 'D06');
d('duplicate table name', { ...base(), derive: { t: { from: 't' } } }, 'D04');
d('unknown field', { ...base(), kpis: { a: { label: 'L', value: 1, colour: 'red' } } }, 'D05');
d('unknown format', { ...base(), kpis: { a: { label: 'L', value: 1, format: 'money' } } }, 'D05');
d('scalar without aggregate', { ...base(), kpis: { a: { label: 'L', value: 't.v', unit: 'u' } } }, 'D05');
d('scalar unknown column', { ...base(), kpis: { a: { label: 'L', value: ['sum', 't.nope'], unit: 'u' } } }, 'D04');
d('scalar with no numbers', { meta, data: { t: T(['v'], []) }, kpis: { a: { label: 'L', value: ['last', 't.v'], unit: 'u' } } }, 'D06');
d('status field on a tile', { ...base(), kpis: { a: { label: 'L', value: 1, unit: 'u', status: { field: 'v', warning: 1 } } } }, 'D05');
d('tile without a unit', { ...base(), kpis: { a: { label: 'L', value: 1 } } }, 'N01', 'note');
d('delta without a label', { ...base(), kpis: { a: { label: 'L', value: 1, unit: 'u', delta: { from: 2 } } } }, 'D03');
d('chart and table together', { ...base(), cards: { c: { title: 'x', chart: { type: 'bar', data: 't', x: 'k', y: 'v' }, table: { data: 't', columns: [{ field: 'k' }] } } } }, 'D03');
d('neither chart nor table', { ...base(), cards: { c: { title: 'x' } } }, 'D03');
d('pie is not offered', { ...base(), cards: { c: card({ type: 'pie', data: 't', x: 'k', y: 'v' }) } }, 'V04');
d('gauge is not offered', { ...base(), cards: { c: card({ type: 'gauge' }) } }, 'V04');
d('unknown chart type', { ...base(), cards: { c: card({ type: 'scatter', data: 't', x: 'v', y: 'w' }) } }, 'D05');
d('second axis', { ...base(), cards: { c: card({ type: 'line', data: 't', x: 'k', y: 'v', y2: 'w' }) } }, 'V03');
d('unknown chart column', { ...base(), cards: { c: card({ type: 'bar', data: 't', x: 'k', y: 'nope' }) } }, 'D04');
d('unknown chart table', { ...base(), cards: { c: card({ type: 'bar', data: 'nope', x: 'k', y: 'v' }) } }, 'D04');
d('band needs two columns', { ...base(), cards: { c: card({ type: 'bar', data: 't', x: 'k', y: 'v', band: ['v'] }) } }, 'D05');
d('five line series', { meta, data: { t: T(['x', 'a', 'b', 'c', 'e', 'f'], [[1, 1, 2, 3, 4, 5]]) }, cards: { c: card({ type: 'line', data: 't', x: 'x', y: ['a', 'b', 'c', 'e', 'f'] }) } }, 'C07');
d('thirteen bars', { meta, data: { t: T(['k', 'v'], Array.from({ length: 13 }, (_, i) => ['k' + i, i])) }, cards: { c: card({ type: 'bar', data: 't', x: 'k', y: 'v' }) } }, 'V13', 'note');
d('long title', { ...base(), cards: { c: { title: 'x'.repeat(91), chart: { type: 'bar', data: 't', x: 'k', y: 'v' } } } }, 'W01', 'note');
d('table column unknown', { ...base(), cards: { c: { title: 'x', table: { data: 't', columns: [{ field: 'nope' }] } } } }, 'D04');
d('view map without default', { ...base(), cards: { c: { title: { A: 'only A' }, chart: { type: 'bar', data: 't', x: 'k', y: 'v' } } } }, 'D05');
d('missing as-of and source', { meta: { title: 'T' } }, 'N02', 'note');
d('mount without an entry', { meta }, 'D02', 'error', { kpis: ['absent'], cards: [], extraScripts: 0, rawStyles: 0 });
d('entry without a mount', { ...base(), kpis: { a: { label: 'L', value: 1, unit: 'u' } } }, 'D02', 'note', { kpis: [], cards: [], extraScripts: 0, rawStyles: 0 });
const six = Object.fromEntries('abcdef'.split('').map((k) => [k, { label: k, value: 1, unit: 'u', hero: k < 'c' }]));
d('six tiles', { meta, kpis: six }, 'L03', 'note', { kpis: Object.keys(six), cards: [], extraScripts: 0, rawStyles: 0 });
d('two heroes', { meta, kpis: six }, 'L02', 'note', { kpis: Object.keys(six), cards: [], extraScripts: 0, rawStyles: 0 });
d('extra scripts', { meta }, 'X04', 'note', { kpis: [], cards: [], extraScripts: 1, rawStyles: 0 });
d('inline styles', { meta }, 'C05', 'note', { kpis: [], cards: [], extraScripts: 0, rawStyles: 2 });
test('a valid page raises nothing', () => { const P = prep({ ...base(), kpis: { a: { label: 'L', value: ['sum', 't.v'], unit: 'u' } }, cards: { c: card({ type: 'bar', data: 't', x: 'k', y: 'v' }) } }, { kpis: ['a'], cards: ['c'], extraScripts: 0, rawStyles: 0 }); eq(P.diag.items, []); near(P.kpis.a.value, 80); });

// ---------- hostile inputs: nothing may throw ----------
for (const [name, cfg] of Object.entries({ null: null, array: [], number: 7, empty: {}, 'meta as text': { meta: 'x' }, 'data as text': { meta, data: 'x' }, 'derive as list': { meta, derive: [] }, 'kpis as text': { meta, kpis: 'x' }, 'cards as number': { meta, cards: 3 }, 'kpi as null': { meta, kpis: { a: null } }, 'card as text': { meta, cards: { a: 'x' } }, 'chart as text': { meta, cards: { a: { title: 't', chart: 'bar' } } } })) {
  test('hostile config: ' + name, () => { const P = prep(cfg, { kpis: ['a'], cards: ['a'], extraScripts: 0, rawStyles: 0 }); if (!P.diag.items.some((x) => x.level === 'error')) throw new Error('expected at least one error'); });
}
test('hostile data: text, nulls and negatives in numeric columns', () => {
  const cfg = { meta, data: { t: T(['k', 'v'], [['a', -5], ['b', null], ['c', 'n/a'], ['d', 1e15], ['e', -0.0001]]) }, derive: { b: { from: 't', bin: 'v', step: 1e14 }, g: { from: 't', group: 'k', agg: { s: ['sum', 'v'] }, cum: 's' }, a: { from: 't', add: { z: ['div', 'v', 'v'] } } }, kpis: { a: { label: 'L', value: ['sum', 't.v'], unit: 'u' } } };
  const P = prep(cfg); clean(P); near(P.kpis.a.value, 1e15 - 5.0001); eq(P.eng.table('a').rows.map((r) => r.z), [1, null, null, 1, 1]);
});
test('hostile data: no rows and one row', () => {
  const cfg = { meta, data: { none: T(['k', 'v'], []), one: T(['k', 'v'], [['a', 3]]) }, derive: { b0: { from: 'none', bin: 'v', step: 1 }, g0: { from: 'none', group: 'k', agg: { s: ['sum', 'v'] }, sort: '-s', top: 3, cum: 's' }, b1: { from: 'one', bin: 'v', step: 1 }, c1: { from: 'one', cum: 'v' } } };
  const P = prep(cfg); clean(P); eq([P.eng.table('b0').rows.length, P.eng.table('g0').rows.length, P.eng.table('b1').rows.length], [0, 0, 1]); near(P.eng.table('c1').rows[0].vCumShare, 1);
});
test('labels that look like markup stay data', () => { const P = prep({ meta: { ...meta, title: '<img src=x onerror=alert(1)>' }, data: { t: T(['k', 'v'], [['<script>alert(1)</script>', 1]]) }, cards: { c: card({ type: 'bar', data: 't', x: 'k', y: 'v' }) } }); clean(P); eq(P.eng.table('t').rows[0].k, '<script>alert(1)</script>'); });

// ---------- the command-line check, on good pages and broken ones ----------
const check = (file, extra = []) => spawnSync(process.execPath, [join(skill, 'scripts', 'check.js'), ...extra, file], { encoding: 'utf8' });
for (const page of ['starter.html', 'specimen.html', 'examples/excess-wip.html']) {
  test('check passes ' + page, () => { const r = check(join(skill, 'assets', page)); if (r.status !== 0 || !/0 error\(s\), 0 note\(s\)/.test(r.stdout)) throw new Error(r.stdout); });
}
const tmp = mkdtempSync(join(tmpdir(), 'readout-test-'));
const good = readFileSync(join(skill, 'assets', 'starter.html'), 'utf8');
const broken = {
  'edited script': [(h) => h.replace('"use strict";', '"use strict";var edited=1;'), 'X02', 1],
  'extra script': [(h) => h.replace('<!-- readout:layout:end -->', '<script>var x=1;</script>\n<!-- readout:layout:end -->'), 'X04', 1],
  'outside image': [(h) => h.replace('<footer data-footer></footer>', '<img src="https://example.com/a.png" alt=""><footer data-footer></footer>'), 'X01', 1],
  'inline handler': [(h) => h.replace('<footer data-footer>', '<footer data-footer onclick="go()">'), 'X04', 1],
  'bad JSON': [(h) => h.replace('"asOf": "2026-01-31",', '"asOf": "2026-01-31",,'), 'D01', 1],
  'mount without entry': [(h) => h.replace('data-kpi="total"', 'data-kpi="totals"'), 'D02', 1],
  'unknown column': [(h) => h.replace('"y": "orders", "target": "target", "xFormat"', '"y": "order", "target": "target", "xFormat"'), 'D04', 1],
  'pie chart': [(h) => h.replace('"type": "bar"', '"type": "pie"'), 'V04', 1],
  'raw colour': [(h) => h.replace('<footer data-footer></footer>', '<p style="color:#ff0000">x</p><footer data-footer></footer>'), 'C05', 0],
  'missing markers': [(h) => h.replace('<!-- readout:layout:start -->', ''), 'X02', 1],
  'ragged CSV block': [(h) => h.replace('<!-- readout:data:end -->', '<script type="text/csv" data-table="extra">\na,b\n1\n</script>\n<!-- readout:data:end -->'), 'D06', 1],
};
test('check accepts a page with a CSV block', () => {
  const file = join(tmp, 'csv-ok.html');
  writeFileSync(file, good.replace('<!-- readout:data:end -->', '<script type="text/csv" data-table="extra">\na,b\n1,2\n</script>\n<!-- readout:data:end -->'));
  const r = check(file); if (r.status !== 0 || r.stdout.includes('[X04]')) throw new Error(r.stdout);
});
for (const [name, [edit, code, status]] of Object.entries(broken)) {
  test('check catches ' + name, () => {
    const changed = edit(good); if (changed === good) throw new Error('the edit did not apply');
    const file = join(tmp, name.replace(/\W+/g, '-') + '.html'); writeFileSync(file, changed);
    const r = check(file); if (r.status !== status || !r.stdout.includes('[' + code + ']')) throw new Error(`expected exit ${status} with ${code}:\n${r.stdout}${r.stderr}`);
  });
}

// ---------- what an author meets when working on a page (found by the second fresh-agent run) ----------
const scriptOf = (h) => h.slice(h.lastIndexOf('<script>') + 8, h.lastIndexOf('</script>'));
test('a search for the markers prints six short lines and never a generated line', () => {
  for (const page of ['starter.html', 'specimen.html', 'examples/excess-wip.html']) {
    const lines = readFileSync(join(skill, 'assets', page), 'utf8').split('\n');
    const hits = lines.filter((l) => /^<!-- readout:/.test(l));
    if (hits.length !== 6 || hits.some((l) => l.length > 120)) throw new Error(page + ': ' + hits.length + ' marker lines');
    if (lines.some((l) => l.length > 2000 && l.includes('readout:'))) throw new Error(page + ': a generated line contains the marker text');
  }
});
// The shell recipes in build.md are run exactly as printed, so the documentation cannot drift from what works.
const sh = (cmd, cwd) => spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8' });
const recipes = [...readFileSync(join(skill, 'references', 'build.md'), 'utf8').matchAll(/\n```\n([\s\S]*?)\n```\n/g)].map((m) => m[1]);
const assemble = recipes.find((b) => b.includes('page.tmp'));
const takeOut = recipes.find((b) => b.includes("sed '1d;$d'"));
test('build.md recipes: assemble a page from two files and a CSV, keep head edits, take the regions out again', () => {
  if (!assemble || !takeOut || !assemble.startsWith('cp assets/starter.html page.html')) throw new Error('recipes not found in build.md');
  const dir = mkdtempSync(join(tmpdir(), 'readout-recipe-'));
  mkdirSync(join(dir, 'assets')); copyFileSync(join(skill, 'assets', 'starter.html'), join(dir, 'assets', 'starter.html'));
  const layout = good.slice(good.indexOf('<!-- readout:layout:start -->') + 29, good.indexOf('<!-- readout:layout:end -->')).trim();
  const at = good.indexOf('id="readout-data">') + 18;
  const data = JSON.parse(good.slice(at, good.indexOf('</script>', at)));
  data.kpis.total.value = ['sum', 'tickets.hours'];
  /* No trailing newline on any of the three files, on purpose: the recipe has to cope. */
  writeFileSync(join(dir, 'page.layout.html'), layout); writeFileSync(join(dir, 'page.data.json'), JSON.stringify(data, null, 1)); writeFileSync(join(dir, 'tickets.csv'), 'id,hours\nT-1,2.5\nT-2,4');
  let r = sh(assemble, dir); if (r.status !== 0) throw new Error('assemble failed: ' + r.stderr);
  const file = join(dir, 'page.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('<html lang="en" data-style="soft"', '<html lang="en" data-theme="dark" data-style="mono"'));
  data.meta.title = 'Changed'; writeFileSync(join(dir, 'page.data.json'), JSON.stringify(data, null, 1) + '\n');
  r = sh(assemble.split('\n').slice(1).join('\n'), dir); if (r.status !== 0) throw new Error('second assemble failed: ' + r.stderr);
  const built = readFileSync(file, 'utf8');
  if (!built.includes('<title>Orders</title>') || !built.includes('data-theme="dark" data-style="mono"')) throw new Error('the title or the head edit was lost');
  if (built.split('\n').filter((l) => /^<!-- readout:/.test(l)).length !== 6) throw new Error('markers are not at line starts');
  if (scriptOf(built) !== scriptOf(good) || built.split('\n').filter((l) => l.length > 2000).length !== 2) throw new Error('the generated lines changed');
  const c = check(file); if (c.status !== 0 || !/0 error\(s\), 0 note\(s\)/.test(c.stdout)) throw new Error(c.stdout);
  r = sh(takeOut, dir); if (r.status !== 0) throw new Error('take-out failed: ' + r.stderr);
  eq(readFileSync(join(dir, 'page.layout.html'), 'utf8').trim(), layout, 'layout taken out');
  eq(JSON.parse(readFileSync(join(dir, 'page.data.json'), 'utf8')), data, 'data taken out');
});
const artifactForm = (h) => h.split('\n').filter((l, i) => i > 5 && !/^<\/head>$|^<body>$|^<\/body>$|^<\/html>$/.test(l)).join('\n');
test('check accepts the artifact form, with a note', () => { const file = join(tmp, 'form.html'); const form = artifactForm(good); if (/<html|<head>|<body>|http-equiv/.test(form)) throw new Error('wrapper lines remain'); writeFileSync(file, form.replace('<div class="ro-page">', '<div class="ro-page" lang="en">')); const r = check(file); if (r.status !== 0 || !r.stdout.includes('[X01]') || r.stdout.includes('[A06]')) throw new Error(r.stdout); });
test('check rejects an artifact form whose script was edited', () => { const file = join(tmp, 'form-bad.html'); writeFileSync(file, artifactForm(good).replace('"use strict";', '"use strict";var edited=1;')); const r = check(file); if (r.status !== 1 || !r.stdout.includes('[X02]')) throw new Error(r.stdout); });
test('brand template passes the brand check', () => { const r = check(join(skill, 'assets', 'brand.template.css'), ['--brand']); if (r.status !== 0) throw new Error(r.stdout); });
test('a low-contrast brand fails the brand check', () => { const file = join(tmp, 'brand.css'); writeFileSync(file, readFileSync(join(skill, 'assets', 'brand.template.css'), 'utf8').replace(/#2964c6/g, '#9cc4ff')); const r = check(file, ['--brand']); if (r.status !== 1 || !r.stdout.includes('[A01]')) throw new Error(r.stdout); });
test('a brand that loads a font from the network fails', () => { const file = join(tmp, 'brand2.css'); writeFileSync(file, readFileSync(join(skill, 'assets', 'brand.template.css'), 'utf8') + '\n@font-face{font-family:x;src:url(https://example.com/x.woff2)}'); const r = check(file, ['--brand']); if (r.status !== 1 || !r.stdout.includes('[X01]')) throw new Error(r.stdout); });
test('generated files are current', () => { const r = spawnSync(process.execPath, [join(here, '..', 'build.mjs'), '--check'], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stdout + r.stderr); });

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.map((x) => '  FAIL ' + x).join('\n')); process.exit(1); }
