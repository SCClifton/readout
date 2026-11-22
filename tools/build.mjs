#!/usr/bin/env node
// Readout build. Generates everything in skills/readout-dashboards/assets from src/,
// and the field lists in references/build.md from src/schema.json.
//   node tools/build.mjs           write generated files
//   node tools/build.mjs --check   exit 1 if any generated file is stale
// No dependencies. Nothing here runs on a consumer's machine.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { loadTokens, tokensCss, value, SRC, SKILL } from './tokens.mjs';

const check = process.argv.includes('--check');
const read = (p) => readFileSync(p, 'utf8');
const stale = [];
const written = [];

function emit(path, content) {
  const current = existsSync(path) ? read(path) : null;
  if (check) {
    if (current !== content) stale.push(path);
  } else if (current !== content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    written.push(path);
  }
}

// Conservative minifiers. The sources are written to make these safe:
// CSS has no comment markers inside strings; JS ends every statement with a semicolon,
// uses block comments only, and has no multi-line strings.
function minCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join(' ')
    .replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/;}/g, '}').trim();
}
function minJs(js) {
  if (/^\s*\/\//m.test(js)) throw new Error('runtime.js must use block comments only');
  return js.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}
function assertAscii(name, text) {
  const m = text.match(/[^\x00-\x7F]/);
  if (m) throw new Error(`${name} contains a non-ASCII character (${JSON.stringify(m[0])} at ${m.index}). Use an escape.`);
}
// The page needs field types and required flags. Full field docs stay in references/build.md.
function slim(sc) {
  const objects = {};
  for (const [name, def] of Object.entries(sc.objects)) {
    objects[name] = { fields: Object.fromEntries(Object.entries(def.fields).map(([k, f]) => [k, f.required ? { type: f.type, required: true, doc: f.doc } : { type: f.type }])) };
  }
  return { formats: Object.fromEntries(Object.keys(sc.formats).map((k) => [k, 1])), objects };
}
function typeName(t) {
  if (t.startsWith('list:object:')) return 'list of ' + t.slice(12) + ' objects';
  if (t.startsWith('list:enum:')) return 'list of: ' + t.slice(10).split('|').join(', ');
  if (t.startsWith('list:')) return 'list of ' + t.slice(5);
  if (t.startsWith('enum:')) return t.slice(5).split('|').join(' or ');
  if (t.startsWith('object:')) return t.slice(7) + ' object';
  return ({ columns: 'column or list of columns', pair: '[column, column]', exprs: 'object', aggs: 'object', where: 'object', rows: 'list of rows', chart: 'chart object', pairs: 'list of pairs', refs: 'list', annotations: 'list' })[t] || t;
}

const raw = loadTokens();
const version = value(raw, 'meta.version');
const tokCss = tokensCss(raw);
const compCss = read(join(SRC, 'components.css'));
const schema = JSON.parse(read(join(SRC, 'schema.json')));
const runtimeSrc = read(join(SRC, 'runtime.js'))
  .replace('/*@SCHEMA@*/null', JSON.stringify(slim(schema)))
  .replace('/*@VERSION@*/"dev"', JSON.stringify(version));
const template = read(join(SRC, 'starter.template.html'));
for (const [n, t] of [['components.css', compCss], ['runtime.js', runtimeSrc], ['starter.template.html', template], ['tokens.css', tokCss]]) assertAscii(n, t);

const css = minCss(tokCss + '\n' + compCss);
const js = minJs(runtimeSrc);
const hash = createHash('sha256').update(js, 'utf8').digest('base64');
// A page's markers are found by searching it for "readout:". If a generated line held that text too, the search
// would print tens of thousands of characters (the second fresh-agent run met exactly this).
for (const [n, t] of [['style', css], ['script', js]]) if (t.includes('readout:')) throw new Error(`The generated ${n} line contains "readout:", which a search for the page's markers would match.`);

function page(layout, data, title) {
  const out = template
    .replace('{{VERSION}}', version)
    .replace('{{HASH}}', hash)
    .replace('{{TITLE}}', title)
    .replace('{{CSS}}', () => css)
    .replace('{{LAYOUT}}', () => layout.trim())
    .replace('{{DATA}}', () => data.trim())
    .replace('{{JS}}', () => js);
  if (/\{\{[A-Z]+\}\}/.test(out)) throw new Error('Unfilled placeholder in page: ' + title);
  return out;
}

const A = join(SKILL, 'assets');
emit(join(A, 'tokens.json'), read(join(SRC, 'tokens.json')));
emit(join(A, 'tokens.css'), tokCss);
emit(join(A, 'readout.css'), `/* Readout ${version}. Readable copy of the stylesheet embedded in starter.html. */\n` + tokCss + compCss);
emit(join(A, 'readout.js'), runtimeSrc);
emit(join(A, 'INTEGRITY.txt'), `Readout ${version}\nThe script embedded in starter.html is assets/readout.js with comments and line breaks removed\n(tools/build.mjs, function minJs). Its SHA-256, base64, is pinned in each page's security policy:\nsha256-${hash}\n`);

const pages = [
  ['starter', 'starter.html', 'Dashboard'],
  ['examples/excess-wip', 'examples/excess-wip.html', 'Excess WIP'],
  ['specimen', 'specimen.html', 'Readout specimen'],
];
for (const [src, dest, title] of pages) {
  const lp = join(SRC, 'pages', src + '.layout.html');
  const dp = join(SRC, 'pages', src + '.data.json');
  if (!existsSync(lp) || !existsSync(dp)) continue;
  const data = read(dp);
  JSON.parse(data);
  assertAscii(src + ' layout', read(lp));
  assertAscii(src + ' data', data);
  if (/<\/script/i.test(data) || /<!--/.test(data)) throw new Error(src + ' data contains a sequence that would end the data block');
  emit(join(A, dest), page(read(lp), data, title));
}

// Field lists in references/build.md, generated from the schema so the docs cannot drift.
// A marker line is followed by its generated lines, which are replaced on every build.
const buildMd = join(SKILL, 'references', 'build.md');
if (existsSync(buildMd)) {
  const out = [];
  let skipping = null;
  for (const line of read(buildMd).split('\n')) {
    if (skipping === 'fields' && line.startsWith('- `')) continue;
    if (skipping === 'formats' && line.startsWith('`')) continue;
    skipping = null;
    out.push(line);
    const m = line.match(/^<!-- fields:([a-zA-Z]+) -->$/);
    if (m) {
      const def = schema.objects[m[1]];
      if (!def) throw new Error('build.md names an unknown object: ' + m[1]);
      for (const [f, d] of Object.entries(def.fields)) out.push(`- \`${f}\`${d.required ? '*' : ''} (${typeName(d.type)}): ${d.doc}`);
      skipping = 'fields';
    } else if (line === '<!-- formats -->') {
      out.push(Object.entries(schema.formats).map(([k, v]) => `\`${k}\` ${v}`).join(' | '));
      skipping = 'formats';
    }
  }
  const md = out.join('\n');
  for (const name of Object.keys(schema.objects)) if (name !== 'table' && !md.includes('<!-- fields:' + name + ' -->')) throw new Error('build.md does not document ' + name);
  assertAscii('build.md', md);
  emit(buildMd, md);
}

if (check) {
  if (stale.length) { console.error('Stale generated files:\n  ' + stale.join('\n  ')); process.exit(1); }
  console.log('Generated files are current.');
} else {
  console.log(`Readout ${version} built. Script hash sha256-${hash}`);
  console.log(`CSS ${css.length} bytes, JS ${js.length} bytes. Files written: ${written.length}`);
}
