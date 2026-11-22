#!/usr/bin/env node
// Readout documentation and hygiene checks: node tools/budget.mjs
// Keeps the skill cheap to load and its documents honest:
// line budgets, a valid front matter, plain ASCII with no long dashes, and colours in the
// documents that really are token values.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTokens, value, SKILL } from './tokens.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const lines = (p) => readFileSync(p, 'utf8').split('\n').length;
const rel = (p) => relative(root, p);

// Line budgets. SKILL.md and build.md are what an agent reads on every job.
const budgets = { 'SKILL.md': 130, 'references/build.md': 320, 'references/design-system.md': 160, 'references/brand-overlay.md': 80, 'references/rules.md': 220, 'references/patterns/flow-wip.md': 90 };
const rows = [];
for (const [file, max] of Object.entries(budgets)) {
  const n = lines(join(SKILL, file));
  rows.push(`${file} ${n}/${max}`);
  if (n > max) problems.push(`${file} has ${n} lines, budget ${max}`);
}

// Front matter.
const skill = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
const fm = skill.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) problems.push('SKILL.md has no front matter');
else {
  const keys = fm[1].split('\n').filter((l) => /^[a-z-]+:/.test(l)).map((l) => l.split(':')[0]);
  for (const k of keys) if (!['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'].includes(k)) problems.push(`front matter key not allowed: ${k}`);
  const desc = (fm[1].match(/^description:\s*(.*)$/m) || [])[1] || '';
  rows.push(`description ${desc.length}/1024 characters`);
  if (desc.length > 1024) problems.push(`description is ${desc.length} characters`);
  if (/[<>]/.test(desc)) problems.push('description contains an angle bracket');
  if ((fm[1].match(/^name:\s*(.*)$/m) || [])[1] !== 'readout-dashboards') problems.push('name must match the folder');
}

// The starter must stay cheap to open: only two long lines, and regions near the top.
const starter = readFileSync(join(SKILL, 'assets', 'starter.html'), 'utf8').split('\n');
const long = starter.filter((l) => l.length > 2000).length;
const endOfData = starter.findIndex((l) => l.includes('readout:data:end')) + 1;
rows.push(`starter.html ${starter.length} lines, ${long} long lines, regions end at line ${endOfData}`);
if (long !== 2) problems.push(`starter.html should have exactly two long generated lines, has ${long}`);
if (endOfData > 80) problems.push(`starter.html regions end at line ${endOfData}`);

// Plain ASCII and no long dashes, everywhere.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(md|mjs|js|css|json|html|txt)$/.test(name)) out.push(p);
  }
  return out;
}
let scanned = 0;
for (const p of walk(root)) {
  scanned += 1;
  const m = readFileSync(p, 'utf8').match(/[^\x09\x0A\x0D\x20-\x7E]/);
  if (m) problems.push(`${rel(p)} contains a character outside plain ASCII: U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
}
rows.push(`${scanned} text files are plain ASCII`);

// Colours quoted in the references must be token values.
const raw = loadTokens();
const known = new Set();
(function collect(node, path) {
  for (const k of Object.keys(node)) {
    if (k.startsWith('$')) continue;
    const p = path ? path + '.' + k : k;
    if (node[k] && typeof node[k] === 'object' && '$value' in node[k]) { const v = value(raw, p); if (typeof v === 'string' && v.startsWith('#')) known.add(v.toLowerCase()); }
    else if (node[k] && typeof node[k] === 'object') collect(node[k], p);
  }
}(raw, ''));
let quoted = 0;
for (const file of Object.keys(budgets)) {
  for (const hex of readFileSync(join(SKILL, file), 'utf8').match(/#[0-9a-fA-F]{6}\b/g) || []) {
    quoted += 1;
    if (!known.has(hex.toLowerCase())) problems.push(`${file} quotes ${hex}, which is not a token value`);
  }
}
rows.push(`${quoted} colours quoted in the documents are token values`);

console.log(rows.map((r) => '  ' + r).join('\n'));
console.log(problems.length ? `${problems.length} problem(s):\n` + problems.map((p) => '  ' + p).join('\n') : 'All within budget.');
process.exit(problems.length ? 1 : 0);
