#!/usr/bin/env node
// Readout token validator. Checks every theme, not a sample.
//   node tools/validate-tokens.mjs            full report, exit 1 on any FAIL
//   node tools/validate-tokens.mjs --quiet    failures and warnings only
// Checks: WCAG 2 contrast for every text and interface pair on every surface it may sit on;
// the data palette under simulated colour-vision deficiency; ramp order; and a denylist so
// that no token copies a platform vendor's system colour.
import { loadTokens, group, value, STYLES, MODES, THEME_NAMES } from './tokens.mjs';
import { contrast, deltaE, cvdDeltaE, hexToOklch } from './color.mjs';

const quiet = process.argv.includes('--quiet');
const raw = loadTokens();
let fails = 0;
let warns = 0;
const out = [];
const say = (s) => out.push(s);

function row(level, label, detail) {
  if (level === 'FAIL') fails += 1;
  if (level === 'WARN') warns += 1;
  if (quiet && level === 'PASS') return;
  say(`  [${level}] ${label.padEnd(34)} ${detail}`);
}

// Summarise a list of [name, ratio] pairs against a minimum.
function pairs(label, list, min, floor) {
  const worst = list.reduce((a, b) => (a[1] < b[1] ? a : b));
  const detail = `worst ${worst[0]} ${worst[1].toFixed(2)}:1 (need ${min}:1, ${list.length} pairs)`;
  if (worst[1] >= min) row('PASS', label, detail);
  else if (floor != null && worst[1] >= floor) row('WARN', label, detail + ' - legal only with an icon and a label');
  else row('FAIL', label, detail + ' - ' + list.filter((p) => p[1] < min).map((p) => `${p[0]} ${p[1].toFixed(2)}`).join(', '));
}

const STATUS = ['good', 'warning', 'serious', 'critical'];

function checkTheme(style, mode, more) {
  const c = group(raw, `style.${style}.${mode}`);
  const d = group(raw, `data.${mode}`);
  if (more) {
    // More contrast promotes each of these roles one step.
    c['text-3'] = c['text-2'];
    c['text-2'] = c.text;
    c.hairline = c.border;
    c.border = c['border-strong'];
  }
  const name = `${THEME_NAMES[style + '-' + mode]} (${style} ${mode})${more ? ', more contrast' : ''}`;
  say(`\n${name}`);
  const surfaces = ['page', 'card', 'fill', 'raised'];
  const on = (fg, bgs) => bgs.map((bg) => [`${fg} on ${bg}`, contrast(c[fg] || d[fg], c[bg] || d[bg])]);

  pairs('Text on every surface', [...on('text', surfaces), ...on('text-2', surfaces), ...on('text-3', surfaces)], 4.5);
  pairs('Accent text and labels', [
    ...on('accent-text', ['page', 'card', 'accent-soft']),
    ...on('on-accent', ['accent']),
    ...on('on-marking', ['marking']),
  ], 4.5);
  pairs('Status text', STATUS.flatMap((s) => on(s + '-text', ['page', 'card', s + '-soft'])), 4.5);
  pairs('Interface marks', [
    ...on('border-strong', ['page', 'card']),
    ...on('accent', ['page', 'card']),
    ...on('accent-text', ['fill']),
    ...on('marking', ['page']),
  ], 3);
  pairs('Neutral and emphasis marks', [...on('neutral', ['card']), ...on('emphasis', ['card'])], 3);
  pairs('Categorical marks on card', Array.from({ length: 8 }, (_, i) => on('cat-' + (i + 1), ['card'])[0]), 3, 2.4);
  pairs('Status marks on card', STATUS.map((s) => on(s, ['card'])[0]), 3, 2.4);

  // A highlighted mark must stand apart from the neutral marks beside it, for everyone.
  const sep = Math.min(deltaE(c.emphasis, c.neutral), cvdDeltaE(c.emphasis, c.neutral));
  row(sep >= 15 ? 'PASS' : 'FAIL', 'Emphasis against neutral', `distance ${sep.toFixed(1)} (need 15, worst of normal and simulated vision)`);
}

function checkData(mode) {
  const d = group(raw, `data.${mode}`);
  const cat = Array.from({ length: 8 }, (_, i) => d['cat-' + (i + 1)]);
  say(`\nData palette, ${mode}`);
  const band = mode === 'light' ? [0.43, 0.77] : [0.48, 0.67];
  const lch = cat.map(hexToOklch);
  const outside = lch.map((x, i) => [i + 1, x.L]).filter(([, L]) => L < band[0] - 0.005 || L > band[1] + 0.005);
  row(outside.length ? 'FAIL' : 'PASS', 'Lightness band', outside.length ? outside.map(([i, L]) => `cat-${i} L ${L.toFixed(2)}`).join(', ') : `all 8 inside L ${band[0]} to ${band[1]}`);
  const dull = lch.map((x, i) => [i + 1, x.C]).filter(([, C]) => C < 0.1 - 0.003);
  row(dull.length ? 'FAIL' : 'PASS', 'Chroma floor', dull.length ? dull.map(([i, C]) => `cat-${i} C ${C.toFixed(3)}`).join(', ') : 'all 8 at C 0.10 or more');

  const adjacent = cat.slice(0, -1).map((a, i) => [`cat-${i + 1}/cat-${i + 2}`, a, cat[i + 1]]);
  const worstOf = (list, fn) => list.map(([n, a, b]) => [n, fn(a, b)]).reduce((x, y) => (x[1] < y[1] ? x : y));
  const all = (k) => { const l = []; for (let i = 0; i < k; i += 1) for (let j = i + 1; j < k; j += 1) l.push([`cat-${i + 1}/cat-${j + 1}`, cat[i], cat[j]]); return l; };
  const grade = (label, list, cvdMin, cvdFloor, normMin) => {
    const cv = worstOf(list, cvdDeltaE);
    const nv = worstOf(list, (a, b) => deltaE(a, b));
    const tri = worstOf(list, (a, b) => deltaE(a, b, 'tritan'));
    const detail = `colour-blind ${cv[1].toFixed(1)} at ${cv[0]} (need ${cvdMin}), normal ${nv[1].toFixed(1)} at ${nv[0]} (need ${normMin}), tritan ${tri[1].toFixed(1)}`;
    if (nv[1] < normMin || cv[1] < cvdFloor) row('FAIL', label, detail);
    else if (cv[1] < cvdMin) row('WARN', label, detail + ' - needs direct labels');
    else row('PASS', label, detail);
  };
  grade('Neighbouring slots', adjacent, 8, 6, 15);
  grade('First three, every pair', all(3), 8, 6, 15);
  grade('First four, every pair', all(4), 8, 6, 15);

  const st = STATUS.map((s) => [s, d[s]]);
  const stPairs = [];
  for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) stPairs.push([`${st[i][0]}/${st[j][0]}`, cvdDeltaE(st[i][1], st[j][1])]);
  const ws = stPairs.reduce((a, b) => (a[1] < b[1] ? a : b));
  row(ws[1] >= 8 ? 'PASS' : ws[1] >= 6 ? 'WARN' : 'FAIL', 'Status levels, colour-blind', `closest ${ws[0]} at ${ws[1].toFixed(1)} (need 8)`);

  const seq = Array.from({ length: 7 }, (_, i) => hexToOklch(d['seq-' + (i + 1)]).L);
  const steps = seq.slice(0, -1).map((L, i) => (mode === 'light' ? L - seq[i + 1] : seq[i + 1] - L));
  const minStep = Math.min(...steps);
  row(minStep >= 0.055 ? 'PASS' : 'FAIL', 'Sequential ramp', `one direction, smallest lightness step ${minStep.toFixed(3)} (need 0.06)`);
  const mid = hexToOklch(d['div-mid']).C;
  row(mid < 0.02 ? 'PASS' : 'FAIL', 'Diverging midpoint', `chroma ${mid.toFixed(3)} (must be neutral)`);
}

// Platform system colours that a token must not copy.
const DENY = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#30b0c7', '#32ade6', '#007aff', '#5856d6', '#af52de', '#ff2d55', '#a2845e',
  '#8e8e93', '#aeaeb2', '#c7c7cc', '#d1d1d6', '#e5e5ea', '#f2f2f7', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#63e6e2', '#40c8e0', '#64d2ff',
  '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ac8e68', '#636366', '#48484a', '#3a3a3c', '#2c2c2e', '#1c1c1e', '#f5f5f7', '#1d1d1f', '#ff383c', '#0088ff'];

function checkDenylist() {
  say('\nOriginality');
  const mine = [];
  const walk = (node, path) => {
    for (const k of Object.keys(node)) {
      if (k.startsWith('$')) continue;
      const p = path ? path + '.' + k : k;
      if (node[k] && typeof node[k] === 'object' && '$value' in node[k]) mine.push([p, value(raw, p)]);
      else if (node[k] && typeof node[k] === 'object') walk(node[k], p);
    }
  };
  walk(raw.color, 'color');
  const hits = [];
  for (const [p, hex] of mine) {
    for (const deny of DENY) {
      const chromatic = hexToOklch(deny).C > 0.04;
      if (hex.toLowerCase() === deny || (chromatic && deltaE(hex, deny) < 2)) hits.push(`${p} ${hex} is ${hex.toLowerCase() === deny ? 'equal to' : 'within 2 of'} ${deny}`);
    }
  }
  row(hits.length ? 'FAIL' : 'PASS', 'No copied system colours', hits.length ? hits.join('; ') : `${mine.length} colour tokens checked against ${DENY.length} system colours`);
}

for (const style of STYLES) for (const mode of MODES) for (const more of [false, true]) checkTheme(style, mode, more);
for (const mode of MODES) checkData(mode);
checkDenylist();

console.log(`Readout token validation, version ${value(raw, 'meta.version')}`);
console.log(out.join('\n'));
console.log(`\nResult: ${fails} fail, ${warns} warn.${fails ? '' : ' All hard gates pass.'}`);
process.exit(fails ? 1 : 0);
