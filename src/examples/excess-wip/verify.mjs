#!/usr/bin/env node
// Recompute test for the Excess WIP example. Every number the page shows is worked out here a
// second way, straight from the raw tables with plain loops, and compared with what the runtime
// computes. It also checks that the tables agree with each other and that each title's claim holds.
//   node src/examples/excess-wip/verify.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const R = createRequire(import.meta.url)(join(root, 'skills', 'readout-dashboards', 'assets', 'readout.js'));
const cfg = JSON.parse(readFileSync(join(root, 'src', 'pages', 'examples', 'excess-wip.data.json'), 'utf8'));
const objects = (t) => t.rows.map((r) => Object.fromEntries(t.cols.map((c, i) => [c, r[i]])));
const stages = objects(cfg.data.stages);
const orders = objects(cfg.data.orders);
const trend = objects(cfg.data.trend);
const mounts = { kpis: Object.keys(cfg.kpis), cards: Object.keys(cfg.cards), extraScripts: 0, rawStyles: 0 };

let checks = 0;
const problems = [];
const same = (what, got, want, tol = 1e-6) => { checks += 1; if (!(Math.abs(got - want) <= tol)) problems.push(`${what}: page has ${got}, recomputed ${want}`); };
const claim = (what, ok) => { checks += 1; if (!ok) problems.push(what); };

// The tables must agree with each other.
for (const s of stages) {
  let qty = 0;
  for (const o of orders) if (o.line === s.line && o.stage === s.stage) qty += o.qty;
  same(`stage WIP equals its orders (${s.line}, ${s.stage})`, s.wip, qty);
  const target = s.throughput * s.targetCt;
  const rate = s.wip > target ? (s.wip - target) / s.wip : 0;
  for (const o of orders) if (o.line === s.line && o.stage === s.stage) same(`order ${o.id} excess rate`, o.excessRate, rate, 1e-5);
}
for (const line of new Set(stages.map((s) => s.line))) {
  const last = trend.filter((t) => t.line === line).at(-1);
  let wip = 0; let excess = 0; let target = 0;
  for (const s of stages) if (s.line === line) { wip += s.wip; target += s.throughput * s.targetCt; excess += Math.max(0, s.wip - s.throughput * s.targetCt); }
  same(`trend ends at the snapshot, WIP (${line})`, last.wip, wip);
  same(`trend ends at the snapshot, target (${line})`, last.target, target, 0.06);
  same(`trend ends at the snapshot, excess (${line})`, last.excess, excess, 0.06);
}

for (const view of [null, ...cfg.meta.views.options]) {
  const name = view === null ? 'all lines' : view;
  const P = R.prepare(cfg, mounts, view, 'en');
  claim(`no errors or notes (${name}): ${JSON.stringify(P.diag.items)}`, P.diag.items.length === 0);
  const inView = (r) => view === null || r.line === view;

  let excess = 0; let excessValue = 0; let wip = 0; let wipValue = 0; let target = 0; let output = 0;
  const byStage = {};
  for (const s of stages) {
    if (!inView(s)) continue;
    const t = s.throughput * s.targetCt;
    const e = Math.max(0, s.wip - t); // not netted: a shortfall elsewhere does not offset this
    excess += e; excessValue += e * s.unitCost; wip += s.wip; wipValue += s.wip * s.unitCost; target += t;
    if (s.stage === 'Pack') output += s.throughput;
    byStage[s.stage] = (byStage[s.stage] || 0) + e;
  }
  const mine = orders.filter(inView);
  let units = 0; let aged = 0; let late = 0; let fromOrders = 0;
  const fam = {};
  for (const o of mine) {
    units += o.qty;
    const ratio = o.ageDays / o.targetCt;
    if (ratio >= 2) aged += o.qty;
    if (ratio >= 1) late += o.qty;
    fam[o.family] = (fam[o.family] || 0) + o.qty * o.excessRate;
    fromOrders += o.qty * o.excessRate;
  }
  const weeks = [...new Set(trend.map((t) => t.week))].map((week) => {
    let w = 0; let upper = 0; let ex = 0;
    for (const t of trend) if (t.week === week && inView(t)) { w += t.wip; upper += t.upper; ex += t.excess; }
    return { week, wip: w, upper, excess: ex };
  });

  // Tiles.
  same(`Excess WIP (${name})`, P.kpis.excess.value, excess);
  same(`Excess WIP, share of all WIP (${name})`, P.kpis.excess.detail, excess / wip);
  same(`Excess WIP, last week (${name})`, P.kpis.excess.from, weeks.at(-2).excess);
  same(`Value of excess WIP (${name})`, P.kpis.excessValue.value, excessValue);
  same(`Total WIP value (${name})`, P.kpis.excessValue.detail, wipValue);
  same(`Implied cycle time (${name})`, P.kpis.cycle.value, wip / output);
  same(`Target cycle time (${name})`, P.kpis.cycle.from, target / output);
  same(`Aged over twice target (${name})`, P.kpis.aged.value, aged);
  same(`Aged share (${name})`, P.kpis.aged.detail, aged / units);
  same(`orders add up to stage WIP (${name})`, units, wip);
  same(`excess shared across orders equals stage excess (${name})`, fromOrders, excess, 0.01);

  // Charts.
  for (const r of P.eng.table('byStageLoad').rows) same(`stage chart, ${r.stage} excess (${name})`, r.excess, byStage[r.stage]);
  const bins = P.eng.table('ageBins').rows;
  same(`ageing bins add up to WIP (${name})`, bins.reduce((a, b) => a + b.units, 0), units);
  const pareto = P.eng.table('byFamily').rows;
  same(`family bars add up to the excess (${name})`, pareto.reduce((a, b) => a + b.excess, 0), excess, 0.01);
  const t = P.eng.table('trendView').rows;
  same(`trend, latest WIP (${name})`, t.at(-1).wip, wip);
  claim(`trend has 26 weeks (${name})`, t.length === 26);

  // Titles: each claim, recomputed.
  const key = view === null ? '*' : view;
  const title = (id) => cfg.cards[id].title[key];
  const ranked = Object.entries(byStage).sort((a, b) => b[1] - a[1]);
  const top2 = Math.round(((ranked[0][1] + ranked[1][1]) / excess) * 100);
  claim(`stage title (${name}): "${title('byStage')}"`, title('byStage').includes(ranked[0][0]) && title('byStage').includes(ranked[1][0]) && title('byStage').includes(top2 + '%'));
  let above = 0;
  for (let i = weeks.length - 1; i >= 0 && weeks[i].wip > weeks[i].upper; i -= 1) above += 1;
  claim(`trend title (${name}): "${title('trend')}"`, above >= 2 ? title('trend').includes(`for ${above} weeks`) : above === 1 ? title('trend').includes('this week') : title('trend').includes('inside or below'));
  claim(`ageing title quotes a fact that matches the recompute (${name}): ${P.facts.lateShare}`, cfg.cards.ageing.title.startsWith('{lateShare}') && P.facts.lateShare === Math.round((late / units) * 100) + '%');
  const famRanked = Object.values(fam).filter((v) => v > 0).sort((a, b) => b - a);
  let run = 0; let k = 0;
  while (k < famRanked.length && run / fromOrders < 0.8) { run += famRanked[k]; k += 1; }
  claim(`family title (${name}): "${title('families')}"`, title('families').startsWith(`${k} of ${famRanked.length} `) && title('families').includes(Math.round((run / fromOrders) * 100) + '%'));
  const tenth = mine.map((o) => o.ageDays / o.targetCt).sort((a, b) => b - a)[9];
  claim(`table title (${name}): "${title('exceptions')}"`, title('exceptions').includes((Math.floor(tenth * 10) / 10).toFixed(1) + ' times'));
}

console.log(`${checks} checks, ${problems.length} problems`);
if (problems.length) { console.log(problems.map((p) => '  ' + p).join('\n')); process.exit(1); }
