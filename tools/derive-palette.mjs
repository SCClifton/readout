#!/usr/bin/env node
// How the shipped colour values were found. This is a record, not a build step:
// tokens.json is the source of truth and validate-tokens.mjs is the gate.
//   node tools/derive-palette.mjs ramps     print the neutral and colour ramps
//   node tools/derive-palette.mjs search    re-run the categorical search (about two minutes)
// Method. Ramps are generated in OKLCH on fixed lightness steps with chroma capped by a
// smooth curve and clipped to sRGB. The categorical palette is a seeded simulated-annealing
// search over hue, lightness and slot order. Hard limits: neighbouring slots at least 8 apart
// under simulated protanopia and deuteranopia and at least 15 apart in normal vision; the
// first three slots at least that far apart in every pairing; every colour at 3:1 or more on
// the card. Preferences: mid lightness, and no green, red or gold in slots two to four so
// that a status-like hue is never among the first series a reader meets.
// Status colours are steps of the green, amber, orange and red ramps, picked by hand so that
// every pair is at least 8 apart under the same simulation. The green ramp sits at hue 164,
// a slightly blue green, because a yellow green collapses into red for colour-blind readers.
import { oklchToHex, maxChroma, deltaE, cvdDeltaE, contrast } from './color.mjs';

const NEUTRAL_STEPS = { 0: 1, 25: 0.985, 50: 0.97, 100: 0.955, 150: 0.925, 200: 0.89, 300: 0.8, 400: 0.7, 450: 0.66, 500: 0.62, 600: 0.53, 700: 0.44, 800: 0.33, 850: 0.28, 875: 0.255, 900: 0.23, 925: 0.205, 950: 0.18, 975: 0.15, 1000: 0.11 };
const COLOUR_STEPS = { 50: 0.97, 100: 0.94, 200: 0.88, 300: 0.8, 400: 0.72, 500: 0.66, 550: 0.62, 600: 0.56, 650: 0.52, 700: 0.46, 800: 0.4, 900: 0.32, 950: 0.25 };
const chromaCap = (L, peak) => Math.max(0.12 * peak, peak * Math.min(1, 1.25 * (1 - Math.pow((L - 0.58) / 0.42, 2))));
const ramp = (H, peak) => Object.fromEntries(Object.entries(COLOUR_STEPS).map(([k, L]) => [k, oklchToHex(L, Math.min(maxChroma(L, H) * 0.97, chromaCap(L, peak)), H)]));

function ramps() {
  const gray = {};
  const neutral = {};
  for (const [k, L] of Object.entries(NEUTRAL_STEPS)) {
    gray[k] = oklchToHex(L, L >= 0.999 ? 0 : 0.004 + 0.016 * Math.pow(1 - L, 1.5), 258);
    neutral[k] = oklchToHex(L, 0, 0);
  }
  return { gray, neutral, blue: ramp(260, 0.165), green: ramp(164, 0.17), amber: ramp(78, 0.17), orange: ramp(50, 0.18), red: ramp(25, 0.19) };
}

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function search() {
  const fam = { blue: [255, 260], orange: [45, 52, 58], teal: [178, 186, 194], gold: [78, 86, 94], pink: [342, 350, 358], green: [145, 152], violet: [285, 292, 300], red: [22, 27] };
  const pref = { light: { blue: 0.52, orange: 0.64, teal: 0.62, gold: 0.68, pink: 0.62, green: 0.6, violet: 0.56, red: 0.58 }, dark: { blue: 0.62, orange: 0.66, teal: 0.66, gold: 0.66, pink: 0.66, green: 0.64, violet: 0.64, red: 0.64 } };
  const names = Object.keys(fam);
  const CAP = 0.165;
  const cardL = '#ffffff';
  const cardD = oklchToHex(0.205, 0.008, 255);
  const grid = { light: [], dark: [] };
  for (let L = 0.5; L <= 0.701; L += 0.02) grid.light.push(+L.toFixed(2));
  for (let L = 0.52; L <= 0.661; L += 0.02) grid.dark.push(+L.toFixed(2));
  const opts = {};
  for (const n of names) {
    opts[n] = fam[n].map((H) => {
      const o = {};
      for (const mode of ['light', 'dark']) {
        o[mode] = [];
        for (const L of grid[mode]) {
          const C = Math.min(CAP, maxChroma(L, H) * 0.97);
          if (C < 0.1) continue;
          const hex = oklchToHex(L, C, H);
          const cr = contrast(hex, mode === 'light' ? cardL : cardD);
          if (mode === 'dark' && cr < 3) continue;
          if (n === 'blue' && mode === 'light' && contrast(hex, '#f0f1f3') < 4.5) continue; // slot one doubles as accent text
          o[mode].push({ hex, L, C, H, cr });
        }
      }
      return o;
    });
  }
  const cache = new Map();
  const key = (a, b) => (a < b ? a + b : b + a);
  const cv = (a, b) => { const k = 'c' + key(a, b); if (!cache.has(k)) cache.set(k, cvdDeltaE(a, b)); return cache.get(k); };
  const nv = (a, b) => { const k = 'n' + key(a, b); if (!cache.has(k)) cache.set(k, deltaE(a, b)); return cache.get(k); };
  const pick = (st, mode) => st.order.map((n) => opts[n][st.hue[n]][mode][st[mode][n]]);
  function metrics(p) {
    let ac = 99; let an = 99;
    for (let i = 0; i < p.length - 1; i += 1) { ac = Math.min(ac, cv(p[i], p[i + 1])); an = Math.min(an, nv(p[i], p[i + 1])); }
    const all = (k) => { let c = 99; let n = 99; for (let i = 0; i < k; i += 1) for (let j = i + 1; j < k; j += 1) { c = Math.min(c, cv(p[i], p[j])); n = Math.min(n, nv(p[i], p[j])); } return [c, n]; };
    const [fc, fn] = all(3); const [f4c, f4n] = all(4);
    return { ac, an, fc, fn, f4c, f4n };
  }
  function energy(st) {
    let e = 0;
    st.order.forEach((n, i) => { if (i > 0 && i < 4 && (n === 'green' || n === 'red' || n === 'gold')) e += 60; });
    if (st.order[1] !== 'orange') e += 1.5;
    for (const mode of ['light', 'dark']) {
      const cs = pick(st, mode);
      const m = metrics(cs.map((c) => c.hex));
      e += 100 * (Math.max(0, 8.5 - m.ac) + Math.max(0, 15.5 - m.an) + Math.max(0, 8.5 - m.fc) + Math.max(0, 15.5 - m.fn));
      e -= 0.6 * Math.min(m.f4c, 8) + 0.3 * Math.min(m.f4n - 15, 5) + 0.15 * Math.min(m.ac, 12);
      cs.forEach((c, i) => { e += Math.abs(c.L - pref[mode][st.order[i]]) * 25; if (mode === 'light' && c.cr < 3) e += 1.5 + (i < 5 ? 4 : 0); });
    }
    return e;
  }
  function randState(r) {
    const rest = names.filter((n) => n !== 'blue');
    for (let i = rest.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const st = { order: ['blue', ...rest], hue: {}, light: {}, dark: {} };
    for (const n of names) { const h = Math.floor(r() * fam[n].length); st.hue[n] = h; st.light[n] = Math.floor(r() * opts[n][h].light.length); st.dark[n] = Math.floor(r() * opts[n][h].dark.length); }
    return st;
  }
  function mutate(st, r) {
    const s = { order: [...st.order], hue: { ...st.hue }, light: { ...st.light }, dark: { ...st.dark } };
    const k = r(); const n = names[Math.floor(r() * names.length)];
    if (k < 0.35) { const i = 1 + Math.floor(r() * 7); const j = 1 + Math.floor(r() * 7); [s.order[i], s.order[j]] = [s.order[j], s.order[i]]; }
    else if (k < 0.6) s.light[n] = Math.floor(r() * opts[n][s.hue[n]].light.length);
    else if (k < 0.85) s.dark[n] = Math.floor(r() * opts[n][s.hue[n]].dark.length);
    else { const h = Math.floor(r() * fam[n].length); s.hue[n] = h; s.light[n] = Math.min(s.light[n], opts[n][h].light.length - 1); s.dark[n] = Math.min(s.dark[n], opts[n][h].dark.length - 1); }
    return s;
  }
  const seen = new Map(); const r = rng(20261122);
  for (let run = 0; run < 30; run += 1) {
    let cur = randState(r); let ce = energy(cur); let b = cur; let be = ce;
    for (let it = 0; it < 50000; it += 1) {
      const T = 2 * (1 - it / 50000) + 0.02; const nx = mutate(cur, r); const ne = energy(nx);
      if (ne <= ce || r() < Math.exp((ce - ne) / T)) { cur = nx; ce = ne; }
      if (ce < be) { be = ce; b = JSON.parse(JSON.stringify(cur)); }
    }
    seen.set(JSON.stringify(b), be);
  }
  for (const [js, e] of [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3)) {
    const st = JSON.parse(js);
    console.log('\nenergy', e.toFixed(2), 'order', st.order.join(', '));
    for (const mode of ['light', 'dark']) {
      const cs = pick(st, mode); const m = metrics(cs.map((c) => c.hex));
      console.log(' ', mode, cs.map((c) => c.hex).join(', '));
      console.log('   ', Object.entries(m).map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  '));
    }
  }
  console.log('\nShipped: the second-ranked result (blue, orange, teal, pink, gold, red, violet, green), chosen because green sits last.');
}

const cmd = process.argv[2];
if (cmd === 'ramps') console.log(JSON.stringify(ramps(), null, 1));
else if (cmd === 'search') search();
else console.log('Usage: node tools/derive-palette.mjs ramps|search');
