#!/usr/bin/env node
// Builds the data block for the Excess WIP example: src/pages/examples/excess-wip.data.json
// Everything here is invented. Stage names, product families and all figures are synthetic,
// drawn from a seeded generator so the file is reproducible: node src/examples/excess-wip/make-data.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SEED = 7;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(SEED);
const pick = (weights) => { let x = rand() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < weights.length; i += 1) { x -= weights[i]; if (x <= 0) return i; } return weights.length - 1; };
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

const STAGES = ['Prep', 'Fabricate', 'Assemble', 'Integrate', 'Test', 'Pack'];
const TARGET_CT = [1.5, 3, 4, 3, 2.5, 1]; // target cycle time per stage, days
const UNIT_COST = [120, 310, 540, 780, 860, 900]; // accumulated cost per unit at each stage, dollars
const LINES = {
  'Line 1': { throughput: [62, 60, 58, 57, 56, 56], load: [0.95, 1.04, 1.07, 1.16, 1.12, 0.9] },
  'Line 2': { throughput: [48, 47, 46, 44, 40, 40], load: [1.0, 1.08, 1.22, 1.62, 1.85, 0.75] },
};
const FAMILIES = ['Family A', 'Family B', 'Family C', 'Family D', 'Family E', 'Family F', 'Family G', 'Family H'];
const MIX = [26, 20, 16, 12, 10, 7, 5, 4];
const MIX_HOT = [44, 8, 30, 4, 6, 3, 3, 2]; // the overloaded stages are mostly two families
const BAND = 0.1;
const WEEKS = 26;
const AS_OF = '2026-11-20';

// Open work orders. Stage WIP is the sum of order quantities, so the two tables cannot disagree.
const orders = [];
const stages = [];
let id = 1000;
for (const [line, cfg] of Object.entries(LINES)) {
  STAGES.forEach((stage, s) => {
    const target = cfg.throughput[s] * TARGET_CT[s];
    const goal = Math.round(target * cfg.load[s]);
    let wip = 0;
    const mine = [];
    while (wip < goal) {
      const qty = Math.min(goal - wip, 4 + Math.floor(rand() * 21));
      const hot = cfg.load[s] > 1.4;
      const age = Math.min(4.6 * TARGET_CT[s], TARGET_CT[s] * cfg.load[s] * 0.85 * -Math.log(1 - rand() * 0.97));
      id += 1 + Math.floor(rand() * 3);
      mine.push({ id: 'WO-' + id, line, stage, family: FAMILIES[pick(hot ? MIX_HOT : MIX)], qty, ageDays: round(age * 2) / 2, targetCt: TARGET_CT[s], unitCost: UNIT_COST[s] });
      wip += qty;
    }
    const excessRate = wip > target ? (wip - target) / wip : 0;
    mine.forEach((o) => { o.excessRate = round(excessRate, 6); orders.push(o); });
    stages.push({ line, stage, wip, throughput: cfg.throughput[s], targetCt: TARGET_CT[s], unitCost: UNIT_COST[s] });
  });
}

// Weekly history per line. The last week is the snapshot above, so the trend and the tiles agree.
const snapshot = (line) => {
  const rows = stages.filter((r) => r.line === line);
  const wip = rows.reduce((a, r) => a + r.wip, 0);
  const target = rows.reduce((a, r) => a + r.throughput * r.targetCt, 0);
  const excess = rows.reduce((a, r) => a + Math.max(0, r.wip - r.throughput * r.targetCt), 0);
  return { wip, target, excess };
};
const trend = [];
const end = new Date(AS_OF + 'T12:00:00Z');
for (const line of Object.keys(LINES)) {
  const now = snapshot(line);
  const finalLoad = now.wip / now.target;
  const startLoad = line === 'Line 2' ? 1.01 : 0.99;
  const turn = line === 'Line 2' ? 15 : 19; // the week the queue starts to build
  for (let w = 0; w < WEEKS; w += 1) {
    const d = new Date(end.getTime() - (WEEKS - 1 - w) * 7 * 86400000);
    const last = w === WEEKS - 1;
    const ramp = w <= turn ? 0 : (w - turn) / (WEEKS - 1 - turn);
    const load = startLoad + (finalLoad - startLoad) * ramp ** 1.3 + (last ? 0 : (rand() - 0.5) * 0.05);
    const target = last ? now.target : now.target * (1 + (1 - ramp) * (line === 'Line 2' ? 0.06 : 0.01) + (rand() - 0.5) * 0.012);
    const wip = last ? now.wip : Math.round(target * load);
    const share = now.excess / Math.max(1, now.wip - now.target); // stage excess exceeds the line net because shortfalls do not offset
    const excess = last ? now.excess : Math.max(0, (wip - target) * share + now.excess * 0.12 * (0.6 + rand() * 0.5));
    trend.push({ week: d.toISOString().slice(0, 10), line, wip, target: round(target, 1), lower: round(target * (1 - BAND), 1), upper: round(target * (1 + BAND), 1), excess: round(excess, 1) });
  }
}

// Findings for the card titles, worked out from the data for each view so that no title is typed by hand.
const fmt = (v) => Math.round(v).toLocaleString('en-US');
function findings(view) {
  const inView = (r) => view === '*' || r.line === view;
  const byStage = STAGES.map((stage) => {
    const rows = stages.filter((r) => r.stage === stage && inView(r));
    return { stage, excess: rows.reduce((a, r) => a + Math.max(0, r.wip - r.throughput * r.targetCt), 0) };
  }).sort((a, b) => b.excess - a.excess);
  const totalExcess = byStage.reduce((a, r) => a + r.excess, 0);
  const top2 = (byStage[0].excess + byStage[1].excess) / totalExcess;
  const stageTitle = totalExcess === 0 ? 'Every stage is within its target'
    : byStage[0].excess / totalExcess >= 0.5 ? `${byStage[0].stage} holds ${Math.round((byStage[0].excess / totalExcess) * 100)}% of the excess`
      : `${byStage[0].stage} and ${byStage[1].stage} hold ${Math.round(top2 * 100)}% of the excess`;

  const weeks = [...new Set(trend.map((r) => r.week))];
  const weekly = weeks.map((week) => { const rows = trend.filter((r) => r.week === week && inView(r)); return { week, wip: rows.reduce((a, r) => a + r.wip, 0), upper: rows.reduce((a, r) => a + r.upper, 0) }; });
  let above = 0;
  for (let i = weekly.length - 1; i >= 0 && weekly[i].wip > weekly[i].upper; i -= 1) above += 1;
  const trendTitle = above >= 2 ? `WIP has been above the target band for ${above} weeks` : above === 1 ? 'WIP moved above the target band this week' : 'WIP is inside or below the target band';
  const crossed = above >= 1 ? weekly[weekly.length - above].week : null;

  const mine = orders.filter(inView);
  const units = mine.reduce((a, o) => a + o.qty, 0);
  const late = mine.filter((o) => o.ageDays / o.targetCt >= 1).reduce((a, o) => a + o.qty, 0);
  const ageTitle = `${Math.round((late / units) * 100)}% of WIP has waited longer than its target time`;

  const fam = FAMILIES.map((family) => ({ family, excess: mine.filter((o) => o.family === family).reduce((a, o) => a + o.qty * o.excessRate, 0) })).sort((a, b) => b.excess - a.excess);
  const famTotal = fam.reduce((a, r) => a + r.excess, 0);
  let run = 0; let k = 0;
  while (k < fam.length && run / famTotal < 0.8) { run += fam[k].excess; k += 1; }
  const famTitle = `${k} of ${fam.filter((r) => r.excess > 0).length} product families hold ${Math.round((run / famTotal) * 100)}% of the excess`;

  const ranked = mine.map((o) => o.ageDays / o.targetCt).sort((a, b) => b - a).slice(0, 10);
  const floor = Math.floor(ranked[ranked.length - 1] * 10) / 10;
  const tableTitle = `The ten most overdue orders have each waited at least ${floor.toFixed(1)} times their target`;
  return { stageTitle, trendTitle, crossed, ageTitle, famTitle, tableTitle, totalExcess };
}
const views = { '*': findings('*'), 'Line 1': findings('Line 1'), 'Line 2': findings('Line 2') };
const perView = (key) => Object.fromEntries(Object.entries(views).map(([v, f]) => [v, f[key]]));
const table = (rows) => ({ cols: Object.keys(rows[0]), rows: rows.map((r) => Object.values(r)) });

const config = {
  meta: {
    title: 'Excess WIP',
    eyebrow: 'Operations',
    subtitle: 'Work in progress above target, by stage, age and product family',
    asOf: AS_OF,
    source: `Synthetic data set, seed ${SEED}`,
    marking: 'Synthetic data',
    locale: 'en',
    currency: 'USD',
    views: { field: 'line', options: Object.keys(LINES), label: 'Line', all: 'All lines' },
    switches: ['theme'],
    method: [
      ['Target WIP', "Throughput (units per day, trailing 20 working days) multiplied by target cycle time (days). This is Little's Law, rearranged."],
      ['Excess WIP', 'WIP above target at each stage on each line. A shortfall at one stage does not offset an excess at another.'],
      ['Target band', 'Target WIP plus or minus 10 percent.'],
      ['Excess by family', "Each stage's excess is shared across its open orders in proportion to quantity."],
      ['Implied cycle time', 'Total WIP divided by the throughput of the last stage.'],
      ['Data', 'Synthetic. Stage names, product families and every figure are invented.'],
    ],
  },
  data: { stages: table(stages), orders: table(orders), trend: table(trend) },
  derive: {
    stageCalc: { from: 'stages', where: { line: '$view' }, add: { target: ['mul', 'throughput', 'targetCt'], excess: ['pos', ['sub', 'wip', 'target']], excessValue: ['mul', 'excess', 'unitCost'], wipValue: ['mul', 'wip', 'unitCost'], lower: ['mul', 'target', 1 - BAND], upper: ['mul', 'target', 1 + BAND] } },
    byStage: { from: 'stageCalc', group: 'stage', agg: { wip: ['sum', 'wip'], target: ['sum', 'target'], lower: ['sum', 'lower'], upper: ['sum', 'upper'], excess: ['sum', 'excess'], excessValue: ['sum', 'excessValue'], wipValue: ['sum', 'wipValue'] } },
    byStageLoad: { from: 'byStage', add: { load: ['div', 'wip', 'target'] } },
    output: { from: 'stages', where: { line: '$view', stage: 'Pack' } },
    trendView: { from: 'trend', where: { line: '$view' }, group: 'week', agg: { wip: ['sum', 'wip'], target: ['sum', 'target'], lower: ['sum', 'lower'], upper: ['sum', 'upper'], excess: ['sum', 'excess'] } },
    orderCalc: { from: 'orders', where: { line: '$view' }, add: { ageRatio: ['div', 'ageDays', 'targetCt'], value: ['mul', 'qty', 'unitCost'], excessQty: ['mul', 'qty', 'excessRate'], agedUnits: ['mul', 'qty', ['gte', ['div', 'ageDays', 'targetCt'], 2]], lateUnits: ['mul', 'qty', ['gte', ['div', 'ageDays', 'targetCt'], 1]] } },
    ageBins: { from: 'orderCalc', bin: 'ageRatio', step: 0.5, agg: { units: ['sum', 'qty'] } },
    byFamily: { from: 'orderCalc', group: 'family', agg: { excess: ['sum', 'excessQty'] }, sort: '-excess', top: 6 },
  },
  // A fact is a figure that text can quote, so this title stays true in every view and after a refresh.
  facts: { lateShare: { value: ['div', ['sum', 'orderCalc.lateUnits'], ['sum', 'orderCalc.qty']], format: 'pct0' } },
  kpis: {
    excess: {
      label: 'Excess WIP', value: ['sum', 'byStage.excess'], format: 'int', unit: 'units', hero: true,
      detail: { value: ['div', ['sum', 'byStage.excess'], ['sum', 'byStage.wip']], format: 'pct0', text: 'of all WIP' },
      delta: { from: ['prev', 'trendView.excess'], label: 'vs last week', good: 'down' },
      spark: { data: 'trendView', y: 'excess' },
    },
    excessValue: {
      label: 'Value of excess WIP', value: ['sum', 'byStage.excessValue'], format: 'cur0',
      detail: { value: ['sum', 'byStage.wipValue'], format: 'curCompact', text: 'total WIP value' },
    },
    cycle: {
      label: 'Implied cycle time', value: ['div', ['sum', 'byStage.wip'], ['sum', 'output.throughput']], format: 'dec1', unit: 'days',
      delta: { from: ['div', ['sum', 'byStage.target'], ['sum', 'output.throughput']], label: 'vs target', format: 'dec1', good: 'down' },
    },
    aged: {
      label: 'Aged over twice target', value: ['sum', 'orderCalc.agedUnits'], format: 'int', unit: 'units',
      detail: { value: ['div', ['sum', 'orderCalc.agedUnits'], ['sum', 'orderCalc.qty']], format: 'pct0', text: 'of all WIP' },
    },
  },
  cards: {
    byStage: {
      title: perView('stageTitle'),
      subtitle: 'WIP by stage against target, units',
      chart: {
        type: 'bar', data: 'byStageLoad', x: 'stage', y: 'wip', target: 'target', band: ['lower', 'upper'], format: 'int', unit: 'units',
        status: { field: 'load', warning: 1 + BAND, critical: 1.5, labels: { warning: 'Above target band', critical: 'More than 1.5 times target' } },
        labels: { wip: 'WIP', target: 'Target WIP', band: 'Target band' },
      },
    },
    trend: {
      title: perView('trendTitle'),
      subtitle: 'Total WIP, units, weekly for 26 weeks',
      chart: {
        type: 'line', data: 'trendView', x: 'week', y: 'wip', band: ['lower', 'upper'], xFormat: 'day', format: 'int', unit: 'units',
        annotate: views['*'].crossed ? [{ x: views['*'].crossed, text: 'Above band' }] : [],
        labels: { wip: 'WIP', band: 'Target band' },
      },
      note: 'The band is target WIP plus or minus 10 percent.',
    },
    ageing: {
      title: '{lateShare} of WIP has waited longer than its target time',
      subtitle: "Units by age in current stage, as a multiple of the stage's target cycle time",
      chart: {
        type: 'histogram', data: 'ageBins', x: 'lo', y: 'units', xFormat: 'dec1', xUnit: 'times target', format: 'int', unit: 'units',
        refs: [{ x: 1, label: 'Target' }, { x: 2, label: 'Twice target' }],
        status: { warning: 1, critical: 2, labels: { warning: 'Past target', critical: 'Past twice target' } },
        labels: { units: 'WIP' },
      },
    },
    families: {
      title: perView('famTitle'),
      subtitle: 'Excess WIP by product family, units',
      chart: { type: 'pareto', data: 'byFamily', x: 'family', y: 'excess', format: 'int', unit: 'units', labels: { excess: 'Excess WIP', family: 'Product family' } },
    },
    exceptions: {
      title: perView('tableTitle'),
      subtitle: "Open work orders ranked by age against the stage's target cycle time",
      table: {
        data: 'orderCalc', sort: '-ageRatio', limit: 10,
        columns: [
          { field: 'id', label: 'Work order', mono: true },
          { field: 'family', label: 'Product family' },
          { field: 'line', label: 'Line' },
          { field: 'stage', label: 'Stage' },
          { field: 'qty', label: 'Quantity', format: 'int', unit: 'units' },
          { field: 'ageDays', label: 'Age in stage', format: 'days1' },
          { field: 'ageRatio', label: 'Age vs target', format: 'x1' },
          { field: 'ageRatio', label: 'Status', status: { warning: 1.5, critical: 2, labels: { warning: 'Late', critical: 'Very late', normal: 'On time' } } },
          { field: 'value', label: 'Value', format: 'cur0' },
        ],
      },
    },
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'pages', 'examples', 'excess-wip.data.json');
const text = JSON.stringify(config).replace(/</g, '\\u003c');
if (/[^\x00-\x7F]/.test(text)) throw new Error('data block must be plain ASCII');
// One table row per line keeps the file readable and diffs small.
const pretty = JSON.stringify(config, (k, v) => (Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object') ? '@@' + JSON.stringify(v) + '@@' : v), 1)
  .replace(/"@@(.*?)@@"/g, (m, a) => JSON.parse('"' + a + '"')).replace(/</g, '\\u003c');
JSON.parse(pretty);
writeFileSync(out, pretty + '\n');
console.log(`orders ${orders.length}, stage rows ${stages.length}, trend rows ${trend.length}, bytes ${pretty.length}`);
for (const [v, f] of Object.entries(views)) console.log(`${v}: excess ${fmt(f.totalExcess)} | ${f.stageTitle} | ${f.trendTitle} | ${f.ageTitle} | ${f.famTitle} | ${f.tableTitle}`);
