// Token loader and CSS generator for Readout. No dependencies.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hexToRgb } from './color.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const SRC = join(here, '..', 'src');
export const SKILL = join(here, '..', 'skills', 'readout-dashboards');

export function loadTokens(path = join(SRC, 'tokens.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function lookup(raw, path) {
  let node = raw;
  for (const key of path.split('.')) {
    if (node == null || typeof node !== 'object' || !(key in node)) throw new Error('Unknown token: ' + path);
    node = node[key];
  }
  return node;
}

// Resolve one token path to its final value, following {alias} references.
export function value(raw, path, seen = []) {
  if (seen.includes(path)) throw new Error('Alias loop: ' + [...seen, path].join(' -> '));
  const node = lookup(raw, path);
  if (node == null || typeof node !== 'object' || !('$value' in node)) throw new Error('Not a token: ' + path);
  const v = node.$value;
  const m = typeof v === 'string' && v.match(/^\{([^}]+)\}$/);
  return m ? value(raw, m[1], [...seen, path]) : v;
}

// All tokens directly inside a group, resolved: { name: value }.
export function group(raw, path) {
  const node = lookup(raw, path);
  const out = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    if (node[key] && typeof node[key] === 'object' && '$value' in node[key]) out[key] = value(raw, path + '.' + key);
  }
  return out;
}

export const STYLES = ['soft', 'mono'];
export const MODES = ['light', 'dark'];
export const THEME_NAMES = { 'soft-light': 'Daylight', 'soft-dark': 'Midnight', 'mono-light': 'Paper', 'mono-dark': 'Graphite' };
// Roles that step up one level when more contrast is asked for.
export const PROMOTED = ['text-2', 'text-3', 'hairline', 'border'];

const fontList = (list) => list.map((f) => (/[^a-z-]/i.test(f) ? '"' + f + '"' : f)).join(', ');

function decl(map, prefix = '') {
  return Object.entries(map).map(([k, v]) => `--ro-${prefix}${k}:${v};`).join('');
}

function chrome(raw, style, mode) {
  const g = group(raw, `style.${style}.${mode}`);
  const out = {};
  for (const [k, v] of Object.entries(g)) out[PROMOTED.includes(k) ? '_' + k : k] = v;
  const [r, gg, b] = hexToRgb(g.page).map((c) => Math.round(c * 255));
  out._glass = `rgb(${r} ${gg} ${b} / 0.78)`;
  return out;
}

export function tokensCss(raw) {
  const ver = value(raw, 'meta.version');
  const scales = {
    ...Object.fromEntries(Object.entries(group(raw, 'space')).map(([k, v]) => ['space-' + k, v])),
    ...Object.fromEntries(Object.entries(group(raw, 'radius')).map(([k, v]) => ['radius-' + k, v])),
    font: fontList(value(raw, 'font.family.sans')),
    'font-mono': fontList(value(raw, 'font.family.mono')),
    ...Object.fromEntries(Object.entries(group(raw, 'font.size')).map(([k, v]) => ['size-' + k, v])),
    ...Object.fromEntries(Object.entries(group(raw, 'font.weight')).map(([k, v]) => ['weight-' + k, v])),
    ...Object.fromEntries(Object.entries(group(raw, 'font.leading')).map(([k, v]) => ['leading-' + k, v])),
    ...Object.fromEntries(Object.entries(group(raw, 'font.tracking')).map(([k, v]) => ['tracking-' + k, v])),
    'dur-fast': value(raw, 'motion.fast'),
    'dur-base': value(raw, 'motion.base'),
    ease: `cubic-bezier(${value(raw, 'motion.ease').join(',')})`,
    ...Object.fromEntries(Object.entries(group(raw, 'chart')).map(([k, v]) => ['chart-' + k, v])),
  };
  const publicAliases = '--ro-text-2:var(--ro-_text-2);--ro-text-3:var(--ro-_text-3);--ro-hairline:var(--ro-_hairline);--ro-border:var(--ro-_border);--ro-glass:var(--ro-_glass);';
  const more = '--ro-text-2:var(--ro-text);--ro-text-3:var(--ro-_text-2);--ro-hairline:var(--ro-_border);--ro-border:var(--ro-border-strong);--ro-glass:var(--ro-page);';
  const softLight = decl(chrome(raw, 'soft', 'light'));
  const softDark = decl(chrome(raw, 'soft', 'dark'));
  const monoLight = decl(chrome(raw, 'mono', 'light'));
  const monoDark = decl(chrome(raw, 'mono', 'dark'));
  const dataLight = decl(group(raw, 'data.light')) + `--ro-shadow-pop:${value(raw, 'shadow.pop.light')};`;
  const dataDark = decl(group(raw, 'data.dark')) + `--ro-shadow-pop:${value(raw, 'shadow.pop.dark')};`;
  const lines = [
    `/* Readout tokens ${ver}. Generated from tokens.json. Do not edit. */`,
    `:root{color-scheme:light;${decl(scales)}${decl(group(raw, 'density.comfortable'))}${decl(group(raw, 'style.soft.shape'))}${softLight}${publicAliases}${dataLight}}`,
    `:root[data-style="mono"]{${decl(group(raw, 'style.mono.shape'))}${monoLight}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;${softDark}${dataDark}}:root[data-style="mono"]:not([data-theme="light"]){${monoDark}}}`,
    `:root[data-theme="dark"]{color-scheme:dark;${softDark}${dataDark}}`,
    `:root[data-style="mono"][data-theme="dark"]{${monoDark}}`,
    `:root[data-density="compact"]{${decl(group(raw, 'density.compact'))}}`,
    `:root[data-contrast="more"]{${more}}`,
    `@media (prefers-contrast:more){:root:not([data-contrast="standard"]){${more}}}`,
    `@media (prefers-reduced-transparency:reduce){:root{--ro-glass:var(--ro-page);}}`,
    `@media print{:root:root:root:root{color-scheme:light;${softLight}${dataLight}}:root:root:root:root[data-style="mono"]{${monoLight}}}`,
  ];
  return lines.join('\n') + '\n';
}
