#!/usr/bin/env node
/* Readout check. Runs the page's own checks from the command line, plus a few that need the file.
     node scripts/check.js dashboard.html              check a dashboard
     node scripts/check.js --brand brand.css           check a brand overlay's contrast
   Exit code 1 when there is an error. Notes do not fail the run.
   Needs node only. Without node, open the page: it reports the same problems itself. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const assets = path.join(__dirname, "..", "assets");
const core = require(path.join(assets, "readout.js"));

const out = [];
const add = (level, code, where, msg) => { if (!out.some((x) => x.code === code && x.where === where && x.msg === msg)) { out.push({ level: level, code: code, where: where, msg: msg }); } };
function finish(label) {
  const errors = out.filter((x) => x.level === "error");
  const notes = out.filter((x) => x.level === "note");
  errors.concat(notes).forEach((x) => console.log((x.level === "error" ? "ERROR" : "NOTE ") + " [" + x.code + "] " + x.where + ": " + x.msg));
  console.log(label + ": " + errors.length + " error(s), " + notes.length + " note(s)." + (errors.length ? "" : " No errors."));
  process.exit(errors.length ? 1 : 0);
}
const between = (text, a, b) => { const i = text.indexOf(a); const j = i < 0 ? -1 : text.indexOf(b, i + a.length); return i < 0 || j < 0 ? null : text.slice(i + a.length, j); };

/* ---------- colour maths for the brand check ---------- */
function rgb(hex) { let h = hex.replace("#", ""); if (h.length === 3) { h = h.split("").map((c) => c + c).join(""); } return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }
function lum(hex) { const c = rgb(hex).map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b) { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

function baseTheme(style, mode) {
  const raw = JSON.parse(fs.readFileSync(path.join(assets, "tokens.json"), "utf8"));
  const value = (p) => { let n = raw; p.split(".").forEach((k) => { n = n[k]; }); const v = n.$value; const m = typeof v === "string" && v.match(/^\{([^}]+)\}$/); return m ? value(m[1]) : v; };
  const t = {};
  [["style", style, mode], ["data", mode]].forEach((parts) => { const g = parts.reduce((n, k) => n[k], raw); Object.keys(g).forEach((k) => { if (k.charAt(0) !== "$") { t[k] = value(parts.concat([k]).join(".")); } }); });
  return t;
}
function checkBrand(file) {
  const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const style = /base:\s*mono/.test(fs.readFileSync(file, "utf8").split("\n")[0]) ? "mono" : "soft"; /* the first line names the base style */
  if (/url\(|@import|@font-face|https?:/i.test(css)) { add("error", "X01", file, "refers to an outside resource. A brand overlay names installed fonts only and loads nothing."); }
  const blocks = { light: {}, dark: {} };
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const mode = /data-theme="dark"|not\(\[data-theme="light"\]\)/.test(m[1]) ? "dark" : "light";
    m[2].split(";").forEach((d) => { const kv = d.split(":"); if (kv.length < 2) { return; } const k = kv[0].trim().replace(/^--ro-_?/, ""); const v = kv.slice(1).join(":").trim(); if (/^#[0-9a-fA-F]{3,6}$/.test(v)) { blocks[mode][k] = v; } else if (/^(rgb|hsl|oklch|color)/.test(v)) { add("error", "B02", file, "--ro-" + k + " must be a hex colour so it can be checked"); } });
  }
  if (!Object.keys(blocks.light).length && !Object.keys(blocks.dark).length) { add("note", "B03", file, "sets no colours. Fonts, radius and density need no contrast check."); }
  ["light", "dark"].forEach((mode) => {
    const t = Object.assign(baseTheme(style, mode), blocks[mode]);
    const need = (fg, bgs, min) => bgs.forEach((bg) => { const c = contrast(t[fg], t[bg]); if (c < min) { add("error", "A01", file + " (" + mode + ")", fg + " " + t[fg] + " on " + bg + " " + t[bg] + " is " + c.toFixed(2) + ":1. It needs " + min + ":1."); } });
    ["text", "text-2", "text-3"].forEach((fg) => need(fg, ["page", "card", "fill", "raised"], 4.5));
    need("accent-text", ["page", "card", "accent-soft"], 4.5);
    need("on-accent", ["accent"], 4.5);
    need("on-marking", ["marking"], 4.5);
    need("border-strong", ["page", "card"], 3);
    need("accent", ["page", "card"], 3);
    need("emphasis", ["card"], 3);
    need("neutral", ["card"], 3);
    if (contrast(t.emphasis, t.neutral) < 1.25) { add("note", "A01", file + " (" + mode + ")", "emphasis " + t.emphasis + " is close in lightness to neutral " + t.neutral + ". A highlighted bar may not stand out for colour-blind readers."); }
    ["good", "warning", "serious", "critical"].forEach((s) => { if (blocks[mode][s] || blocks[mode][s + "-text"] || blocks[mode][s + "-soft"]) { add("error", "C03", file, "status colours are fixed and are not part of a brand overlay (" + s + ")"); } });
  });
  finish("Brand overlay " + path.basename(file));
}

function checkPage(file) {
  const html = fs.readFileSync(file, "utf8");
  const layout = between(html, "<!-- readout:layout:start -->", "<!-- readout:layout:end -->");
  const dataText = between(html, "<script type=\"application/json\" id=\"readout-data\">", "</script>");
  if (layout === null) { add("error", "X02", "layout", "the readout:layout markers are missing. Start again from assets/starter.html."); }
  if (dataText === null) { add("error", "D01", "data block", "no script element with id readout-data was found"); finish(path.basename(file)); }

  /* The generated blocks must be the shipped ones, and the pinned hash must match the script. */
  const starter = fs.readFileSync(path.join(assets, "starter.html"), "utf8");
  const script = (h) => { const i = h.lastIndexOf("<script>"); const j = h.lastIndexOf("</script>"); return i < 0 || j < i ? null : h.slice(i + 8, j); };
  const cssOf = (h) => between(h, "<style id=\"readout-css\">", "</style>");
  const js = script(html);
  const pinned = (html.match(/script-src 'sha256-([^']+)'/) || [])[1];
  const artifactForm = !/<html[\s>]/i.test(html) && !pinned;
  if (artifactForm && js && js === script(starter)) { add("note", "X01", "page", "is in artifact form: it has no wrapper lines and no security policy of its own, so it relies on the host that displays it. Do not use this form as a standalone file."); }
  else if (!js || !pinned) { add("error", "X02", "page", "the script block or its security policy is missing. Start again from assets/starter.html."); }
  else if (crypto.createHash("sha256").update(js, "utf8").digest("base64") !== pinned) { add("error", "X02", "script", "has been edited, so the browser will refuse to run it. Restore it from assets/starter.html. Use a custom card for anything the runtime does not draw."); }
  else if (js !== script(starter)) { add("note", "X02", "script", "comes from a different Readout version than this skill (" + core.version + ")"); }
  if (cssOf(html) !== cssOf(starter)) { add("note", "X02", "style", "the generated stylesheet differs from this skill's. Put brand changes in the brand block, not here."); }
  if ((html.match(/<script(?![^>]*type="(?:application\/json|text\/csv)")[\s>]/g) || []).length > 1) { add("error", "X04", "page", "has extra script elements. The security policy blocks them: remove them."); }
  if (!/<html[^>]*\slang="[a-zA-Z-]+"/.test(html) && !(artifactForm && /class="ro-page"[^>]*\slang="[a-zA-Z-]+"|\slang="[a-zA-Z-]+"[^>]*class="ro-page"/.test(html))) { add("note", "A06", artifactForm ? "ro-page" : "html", "has no lang attribute"); }
  const brand = between(html, "<!-- readout:brand:start", "<!-- readout:brand:end -->") || "";
  const authored = (layout || "") + brand;
  if (/(?:src|href|action|poster)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(authored) || /url\(\s*["']?(?:https?:)?\/\//i.test(authored) || /@import/i.test(authored)) { add("error", "X01", "layout", "refers to an outside address. Pages load nothing from the network."); }
  if (/<(?:iframe|object|embed|link|canvas|form)\b/i.test(layout || "")) { add("error", "X01", "layout", "uses an element that is not allowed here (iframe, object, embed, link, canvas or form)"); }
  if (/\sstyle\s*=/.test(layout || "")) { add("note", "C05", "layout", "has inline style attributes. Use the documented classes and tokens."); }
  if (/<style/i.test(layout || "")) { add("note", "C05", "layout", "has its own style block. Use the documented classes, or a brand overlay for brand changes."); }
  if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test((layout || "").replace(/&#\d+;|&#x[0-9a-f]+;/gi, ""))) { add("note", "C05", "layout", "contains a raw colour. Every colour comes from a token."); }
  if (/\son[a-z]+\s*=/i.test(layout || "")) { add("error", "X04", "layout", "has inline event handlers. The security policy blocks them."); }

  let cfg = null;
  try { cfg = JSON.parse(dataText); }
  catch (e) {
    const pos = +(String(e.message).match(/position (\d+)/) || [])[1];
    const near = isFinite(pos) ? " Near: " + JSON.stringify(dataText.slice(Math.max(0, pos - 40), pos + 20)) : "";
    add("error", "D01", "data block", e.message + "." + near + " Look for a trailing comma, a missing quote, or a raw < inside a string.");
    finish(path.basename(file));
  }
  const ids = (attr) => { const r = new RegExp("\\s" + attr + "\\s*=\\s*\"([^\"]*)\"", "g"); const a = []; let m; while ((m = r.exec(layout || ""))) { a.push(m[1]); } return a; };
  const mounts = { kpis: ids("data-kpi"), cards: ids("data-card"), extraScripts: 0, rawStyles: 0 };
  const lang = (html.match(/<html[^>]*\slang="([a-zA-Z-]+)"/) || html.match(/class="ro-page"[^>]*\slang="([a-zA-Z-]+)"/) || [])[1];
  const views = [null].concat(cfg && cfg.meta && cfg.meta.views && Array.isArray(cfg.meta.views.options) ? cfg.meta.views.options : []);
  const csv = {};
  const csvRe = /<script type="text\/csv" data-table="([^"]+)">([\s\S]*?)<\/script>/g;
  let cm;
  while ((cm = csvRe.exec(html))) { csv[cm[1]] = cm[2]; }
  views.forEach((v) => { core.prepare(cfg, mounts, v, lang, csv).diag.items.forEach((x) => add(x.level, x.code, x.path + (v === null || views.length === 1 ? "" : " (view " + v + ")"), x.msg)); });
  if (/"(?:<|[^"\\]|\\.)*<\/script/i.test(dataText)) { add("error", "D01", "data block", "contains </script inside a string. Write < as \\u003c."); }
  finish(path.basename(file));
}

const args = process.argv.slice(2);
if (args[0] === "--brand" && args[1]) { checkBrand(args[1]); }
else if (args[0] && args[0] !== "--help") { checkPage(args[0]); }
else { console.log("Usage: node scripts/check.js dashboard.html | --brand brand.css"); }
