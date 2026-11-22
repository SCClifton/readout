/* Readout runtime. Draws a dashboard from the layout mounts and the JSON data block.
   No network access, no dependencies. Labels are inserted as text, never as markup.
   Source: src/runtime.js. The build relies on three habits in this file:
   block comments only, a semicolon after every statement, no multi-line strings. */
(function (root) {
  "use strict";
  const VERSION = "1.0.0";
  const SCHEMA = {"formats":{"int":1,"dec1":1,"dec2":1,"pct0":1,"pct1":1,"cur0":1,"cur2":1,"compact":1,"curCompact":1,"days0":1,"days1":1,"x1":1,"date":1,"day":1,"month":1,"text":1},"objects":{"meta":{"fields":{"title":{"type":"text","required":true,"doc":"Page title: what this page is about."},"subtitle":{"type":"text"},"eyebrow":{"type":"text"},"asOf":{"type":"text"},"source":{"type":"text"},"marking":{"type":"text"},"locale":{"type":"text"},"currency":{"type":"text"},"views":{"type":"object:views"},"switches":{"type":"list:enum:theme|style|density|contrast"},"method":{"type":"pairs"}}},"views":{"fields":{"field":{"type":"text","required":true,"doc":"Column the switch filters. A pipeline opts in with where: {column: \"$view\"}."},"options":{"type":"list:text","required":true,"doc":"Values to offer, in order."},"label":{"type":"text"},"all":{"type":"text"}}},"table":{"fields":{"cols":{"type":"list:text","required":true,"doc":"Column names."},"rows":{"type":"rows","required":true,"doc":"One array per row, values in column order."}}},"derive":{"fields":{"from":{"type":"table","required":true,"doc":"Source table: a data table or another derived table."},"where":{"type":"where"},"add":{"type":"exprs"},"group":{"type":"columns"},"agg":{"type":"aggs"},"bin":{"type":"column"},"step":{"type":"number"},"sort":{"type":"text"},"top":{"type":"number"},"other":{"type":"text"},"cum":{"type":"column"}}},"fact":{"fields":{"value":{"type":"scalar","required":true,"doc":"A scalar. first, last, min and max may also pick text or a date, such as the top row's name."},"format":{"type":"format"}}},"kpi":{"fields":{"label":{"type":"text","required":true,"doc":"What the number is. Sentence case, no colon."},"value":{"type":"scalar","required":true,"doc":"A scalar such as [\"sum\", \"stages.excess\"]."},"format":{"type":"format"},"unit":{"type":"text"},"hero":{"type":"bool"},"detail":{"type":"object:detail"},"delta":{"type":"object:delta"},"spark":{"type":"object:spark"},"status":{"type":"object:status"}}},"detail":{"fields":{"value":{"type":"scalar","required":true,"doc":"A scalar."},"format":{"type":"format"},"text":{"type":"text","required":true,"doc":"Words after the number, such as of all WIP."}}},"delta":{"fields":{"from":{"type":"scalar","required":true,"doc":"The comparison value. The change shown is value minus from."},"label":{"type":"text","required":true,"doc":"What it is compared with, such as vs last week."},"format":{"type":"format"},"good":{"type":"enum:up|down|none"}}},"spark":{"fields":{"data":{"type":"table","required":true,"doc":"Table holding the trend."},"y":{"type":"column","required":true,"doc":"Column to draw, in row order."}}},"status":{"fields":{"field":{"type":"column"},"warning":{"type":"number"},"serious":{"type":"number"},"critical":{"type":"number"},"direction":{"type":"enum:above|below"},"strict":{"type":"bool"},"labels":{"type":"object"}}},"card":{"fields":{"title":{"type":"text or view map","required":true,"doc":"States the finding, not the measure. With a view switch, give {\"*\": default, \"view value\": text}."},"subtitle":{"type":"text"},"chart":{"type":"chart"},"table":{"type":"object:tableView"},"note":{"type":"text or view map"},"source":{"type":"text"},"asOf":{"type":"text"}}},"bar":{"fields":{"type":{"type":"enum:bar","required":true,"doc":"Compare categories, or actual against target."},"data":{"type":"table","required":true,"doc":"Table to draw."},"x":{"type":"column","required":true,"doc":"Category column."},"y":{"type":"column","required":true,"doc":"Value column. Bars always start at zero."},"orient":{"type":"enum:h|v"},"xFormat":{"type":"format"},"target":{"type":"column or number"},"band":{"type":"pair"},"highlight":{"type":"any"},"status":{"type":"object:status"},"sort":{"type":"enum:none|desc|asc"},"format":{"type":"format"},"unit":{"type":"text"},"labels":{"type":"object"}}},"line":{"fields":{"type":{"type":"enum:line","required":true,"doc":"Change over time."},"data":{"type":"table","required":true,"doc":"Table to draw, rows in time order."},"x":{"type":"column","required":true,"doc":"Time or sequence column."},"y":{"type":"columns","required":true,"doc":"One to four value columns. The first is emphasised."},"band":{"type":"pair"},"target":{"type":"column or number"},"zero":{"type":"bool"},"colors":{"type":"enum:emphasis|categorical"},"annotate":{"type":"annotations"},"xFormat":{"type":"format"},"format":{"type":"format"},"unit":{"type":"text"},"labels":{"type":"object"}}},"histogram":{"fields":{"type":{"type":"enum:histogram","required":true,"doc":"Shape of a distribution. Feed it a bin pipeline."},"data":{"type":"table","required":true,"doc":"A table made with bin."},"x":{"type":"column","required":true,"doc":"Bin start column. Use lo."},"y":{"type":"column","required":true,"doc":"Count column. Use count."},"refs":{"type":"refs"},"status":{"type":"object:status"},"xFormat":{"type":"format"},"format":{"type":"format"},"unit":{"type":"text"},"xUnit":{"type":"text"},"labels":{"type":"object"}}},"pareto":{"fields":{"type":{"type":"enum:pareto","required":true,"doc":"Which few contributors make up most of a total."},"data":{"type":"table","required":true,"doc":"Table to draw. Sorted for you, largest first."},"x":{"type":"column","required":true,"doc":"Contributor column."},"y":{"type":"column","required":true,"doc":"Value column."},"cut":{"type":"number"},"format":{"type":"format"},"unit":{"type":"text"},"labels":{"type":"object"}}},"tableView":{"fields":{"data":{"type":"table","required":true,"doc":"Table to show."},"columns":{"type":"list:object:column","required":true,"doc":"Columns to show, in order."},"sort":{"type":"text"},"limit":{"type":"number"}}},"column":{"fields":{"field":{"type":"column","required":true,"doc":"Column to show."},"label":{"type":"text"},"format":{"type":"format"},"unit":{"type":"text"},"mono":{"type":"bool"},"status":{"type":"object:status"}}}}};

  /* ---------- small helpers ---------- */
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  /* Typographic characters, built from code points so this file stays plain ASCII. */
  const CH = { minus: String.fromCharCode(8722), times: String.fromCharCode(215), dots: String.fromCharCode(8230), dot: String.fromCharCode(183), sep: String.fromCharCode(1) };
  const words = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

  /* ---------- diagnostics ---------- */
  function Diag() { this.items = []; this.seen = {}; }
  Diag.prototype.push = function (level, code, path, msg) {
    const key = code + "|" + path + "|" + msg;
    if (this.seen[key]) { return; }
    this.seen[key] = true;
    this.items.push({ level: level, code: code, path: path, msg: msg });
  };
  Diag.prototype.error = function (code, path, msg) { this.push("error", code, path, msg); };
  Diag.prototype.note = function (code, path, msg) { this.push("note", code, path, msg); };

  /* ---------- row arithmetic and aggregates: the closed vocabulary ---------- */
  const OPS = {
    add: (a) => sum(a),
    sub: (a) => a[0] - a[1],
    mul: (a) => a.reduce((x, y) => x * y, 1),
    div: (a) => (a[1] === 0 ? null : a[0] / a[1]),
    pos: (a) => Math.max(0, a[0]),
    neg: (a) => -a[0],
    abs: (a) => Math.abs(a[0]),
    min: (a) => Math.min.apply(null, a),
    max: (a) => Math.max.apply(null, a),
    round: (a) => { const k = Math.pow(10, a[1] || 0); return Math.round(a[0] * k) / k; },
    gt: (a) => (a[0] > a[1] ? 1 : 0),
    gte: (a) => (a[0] >= a[1] ? 1 : 0),
    lt: (a) => (a[0] < a[1] ? 1 : 0),
    lte: (a) => (a[0] <= a[1] ? 1 : 0)
  };
  const ARITY = { sub: 2, div: 2, pos: 1, neg: 1, abs: 1, gt: 2, gte: 2, lt: 2, lte: 2 };
  const CMP = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
  const AGG = {
    sum: (v) => sum(v),
    mean: (v) => (v.length ? sum(v) / v.length : null),
    min: (v) => (v.length ? Math.min.apply(null, v) : null),
    max: (v) => (v.length ? Math.max.apply(null, v) : null),
    count: (v) => v.length,
    median: (v) => { if (!v.length) { return null; } const s = v.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; },
    first: (v) => (v.length ? v[0] : null),
    last: (v) => (v.length ? v[v.length - 1] : null),
    prev: (v) => (v.length > 1 ? v[v.length - 2] : null)
  };
  /* count, first, last and prev take any value that is present. The rest need numbers,
     except that min and max also read a column of ISO dates, as the earliest and the latest. */
  const present = (v) => v !== null && v !== undefined && v !== "";
  const ANY = { count: true, first: true, last: true, prev: true };
  const isDateText = (v) => typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?/.test(v);
  const datesOnly = (fn, values) => (fn === "min" || fn === "max") && values.some(present) && values.filter(present).every(isDateText);
  const aggregate = (fn, values) => {
    if (fn === "count") { return values.filter(present).length; }
    if (datesOnly(fn, values)) { const d = values.filter(present).sort(); return d[fn === "min" ? 0 : d.length - 1]; }
    return AGG[fn](values.filter(has(ANY, fn) ? present : isNum));
  };
  const noNumbers = (fn, values) => !has(ANY, fn) && values.some(present) && !values.some(isNum) && !datesOnly(fn, values);
  const NO_NUMBERS = " holds no numbers. To count rows use [\"count\"]. To count the rows that match something, add a 0 or 1 column with \"is\" and sum it.";

  /* Operations on text and dates. Their first operand is always a column. */
  function isoDate(v) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(v == null ? "" : v));
    return m ? Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) : null;
  }
  const isoText = (ms) => new Date(ms).toISOString().slice(0, 10);
  const SPECIAL = {
    is: (v, e) => (v === e[2] ? 1 : 0),
    month: (v) => { const t = isoDate(v); return t === null ? null : isoText(t).slice(0, 7); },
    week: (v) => { const t = isoDate(v); return t === null ? null : isoText(t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000); },
    /* An age below zero nearly always means the rows were replaced and meta.asOf was not, so the engine remembers the latest date it met. */
    age: (v, e, ctx) => { const t = isoDate(v); if (t === null || !ctx || ctx.asOf === null) { return null; } if (t > ctx.asOf && !(ctx.late > t)) { ctx.late = t; } return Math.round((ctx.asOf - t) / 86400000); },
    until: (v, e, ctx) => { const t = isoDate(v); return t === null || !ctx || ctx.asOf === null ? null : Math.round((t - ctx.asOf) / 86400000); }
  };
  const usesOp = (e, name) => Array.isArray(e) && (e[0] === name || e.slice(1).some((x) => usesOp(x, name)));

  function exprProblem(e, cols) {
    if (isNum(e)) { return null; }
    if (typeof e === "string") { return cols.indexOf(e) >= 0 ? null : "column \"" + e + "\" is not available here. Columns: " + cols.join(", "); }
    if (!Array.isArray(e) || typeof e[0] !== "string") { return "must be a number, a column name, or [operation, ...]"; }
    if (has(SPECIAL, e[0])) {
      if (typeof e[1] !== "string" || cols.indexOf(e[1]) < 0) { return "\"" + e[0] + "\" takes a column name first. Columns: " + cols.join(", "); }
      if (e[0] === "is") { return e.length === 3 && (typeof e[2] === "string" || isNum(e[2])) ? null : "\"is\" takes a column and the text or number to match, such as [\"is\", \"status\", \"Open\"]"; }
      return e.length === 2 ? null : "\"" + e[0] + "\" takes one date column";
    }
    if (!has(OPS, e[0])) { return "unknown operation \"" + e[0] + "\". Operations: " + Object.keys(OPS).concat(Object.keys(SPECIAL)).join(", "); }
    if (has(ARITY, e[0]) && e.length - 1 !== ARITY[e[0]]) { return "\"" + e[0] + "\" takes " + ARITY[e[0]] + " value(s)"; }
    if (e.length < 2) { return "\"" + e[0] + "\" needs at least one value"; }
    for (let i = 1; i < e.length; i += 1) { const p = exprProblem(e[i], cols); if (p) { return p; } }
    return null;
  }
  function evalExpr(e, row, ctx) {
    if (isNum(e)) { return e; }
    if (typeof e === "string") { return row[e]; }
    if (has(SPECIAL, e[0])) { return SPECIAL[e[0]](row[e[1]], e, ctx); }
    const args = e.slice(1).map((x) => evalExpr(x, row, ctx));
    return args.some((x) => !isNum(x)) ? null : OPS[e[0]](args);
  }
  function exprText(e) {
    if (!Array.isArray(e)) { return String(e); }
    if (e[0] === "is") { return "(" + e[1] + " is " + JSON.stringify(e[2]) + ")"; }
    if (e[0] === "month" || e[0] === "week") { return e[0] + " of " + e[1]; }
    if (e[0] === "age") { return "days from " + e[1] + " to the as-of date"; }
    if (e[0] === "until") { return "days from the as-of date to " + e[1]; }
    const a = e.slice(1).map(exprText);
    const wrap = (x, i) => (Array.isArray(e[i + 1]) && /^(add|sub)$/.test(e[i + 1][0]) ? "(" + x + ")" : x);
    if (e[0] === "add") { return a.join(" + "); }
    if (e[0] === "sub") { return a.join(" " + CH.minus + " "); }
    if (e[0] === "mul") { return a.map(wrap).join(" " + CH.times + " "); }
    if (e[0] === "div") { return a.map(wrap).join(" / "); }
    if (e[0] === "pos") { return "max(0, " + a[0] + ")"; }
    if (e[0] === "neg") { return CH.minus + a[0]; }
    if (has(CMP, e[0])) { return "(" + a[0] + " " + CMP[e[0]] + " " + a[1] + ")"; }
    return e[0] + "(" + a.join(", ") + ")";
  }

  /* ---------- schema validation ---------- */
  function checkType(v, type, p, diag, ctx) {
    const bad = (m) => { diag.error("D05", p, m); return false; };
    if (type === "text") { return typeof v === "string" || isNum(v) || bad("must be text"); }
    if (type === "text or view map") { return typeof v === "string" || (isObj(v) && typeof v["*"] === "string") || bad("must be text, or an object of view value to text with a \"*\" default"); }
    if (type === "number") { return isNum(v) || bad("must be a number"); }
    if (type === "bool") { return typeof v === "boolean" || bad("must be true or false"); }
    if (type === "format") { return has(SCHEMA.formats, v) || bad("unknown format \"" + v + "\". Formats: " + Object.keys(SCHEMA.formats).join(", ")); }
    if (type.indexOf("enum:") === 0) { const o = type.slice(5).split("|"); return o.indexOf(v) >= 0 || bad("must be one of: " + o.join(", ")); }
    if (type === "table") {
      if (typeof v !== "string") { return bad("must be a table name"); }
      if (ctx && ctx.eng && !ctx.eng.has(v)) { diag.error("D04", p, "table \"" + v + "\" does not exist. Tables: " + ctx.eng.names().join(", ")); return false; }
      return true;
    }
    if (type === "column" || type === "columns" || type === "pair" || type === "column or number") {
      if (type === "column or number" && isNum(v)) { return true; }
      const cs = list(v);
      if (type === "pair" && cs.length !== 2) { return bad("must be [low column, high column]"); }
      if (cs.some((c) => typeof c !== "string")) { return bad("must be a column name"); }
      if (!ctx || !ctx.cols) { return true; }
      return cs.map((c) => { if (ctx.cols.indexOf(c) >= 0) { return true; } diag.error("D04", p, "column \"" + c + "\" is not in \"" + ctx.table + "\". Columns: " + ctx.cols.join(", ")); return false; }).every(Boolean);
    }
    if (type.indexOf("list:") === 0) {
      if (!Array.isArray(v)) { return bad("must be a list"); }
      return v.map((x, i) => checkType(x, type.slice(5), p + "[" + i + "]", diag, ctx)).every(Boolean);
    }
    if (type.indexOf("object:") === 0) { return validate(v, type.slice(7), p, diag, ctx); }
    if (type === "object" || type === "where" || type === "exprs" || type === "aggs") { return isObj(v) || bad("must be an object"); }
    if (type === "pairs") { return (Array.isArray(v) && v.every((x) => Array.isArray(x) && x.length === 2)) || bad("must be a list of [term, explanation] pairs"); }
    if (type === "refs") { return (Array.isArray(v) && v.every((x) => isObj(x) && isNum(x.x) && typeof x.label === "string")) || bad("must be a list of {\"x\": number, \"label\": \"words\"}"); }
    if (type === "annotations") { return (Array.isArray(v) && v.every((x) => isObj(x) && x.x != null && typeof x.text === "string")) || bad("must be a list of {\"x\": value, \"text\": \"words\"}"); }
    return true;
  }
  function validate(obj, name, path, diag, ctx) {
    const def = SCHEMA.objects[name];
    let ok = true;
    if (!isObj(obj)) { diag.error("D03", path, "must be an object"); return false; }
    if (ctx && ctx.eng && has(def.fields, "data") && typeof obj.data === "string") {
      const t = ctx.eng.table(obj.data);
      ctx = { eng: ctx.eng, table: obj.data, cols: t ? t.cols : null };
    }
    Object.keys(obj).forEach((k) => {
      if (k.charAt(0) === "_" || has(def.fields, k)) { return; }
      if (/^(y2|axis2|secondary|secondaryAxis|dualAxis|rightAxis)$/.test(k)) { diag.error("V03", path + "." + k, "a second value axis is not available. Use two charts, or index both series to a common base."); }
      else { diag.error("D05", path + "." + k, "unknown field. Fields here: " + Object.keys(def.fields).join(", ")); }
      ok = false;
    });
    Object.keys(def.fields).forEach((k) => {
      const f = def.fields[k];
      const v = obj[k];
      if (v == null) { if (f.required) { diag.error("D03", path + "." + k, "is required. " + f.doc); ok = false; } return; }
      if (!checkType(v, f.type, path + "." + k, diag, ctx)) { ok = false; }
    });
    return ok;
  }

  /* ---------- tables and pipelines ---------- */
  /* CSV text pasted verbatim into a script element of type text/csv. Quoted fields may hold commas, quotes and line breaks. */
  function parseCsv(text) {
    const src = String(text).replace(/^\uFEFF/, "");
    const tab = src.split("\n")[0].indexOf("\t") >= 0 && src.split("\n")[0].indexOf(",") < 0;
    const sep = tab ? "\t" : ",";
    const out = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < src.length; i += 1) {
      const ch = src.charAt(i);
      if (quoted) {
        if (ch === "\"" && src.charAt(i + 1) === "\"") { cell += "\""; i += 1; }
        else if (ch === "\"") { quoted = false; }
        else { cell += ch; }
      } else if (ch === "\"" && cell === "") { quoted = true; }
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src.charAt(i + 1) === "\n") { i += 1; } row.push(cell); cell = ""; if (row.length > 1 || row[0].trim() !== "") { out.push(row); } row = []; }
      else { cell += ch; }
    }
    row.push(cell);
    if (row.length > 1 || row[0].trim() !== "") { out.push(row); }
    return out;
  }
  function csvTable(name, text, diag) {
    const lines = parseCsv(text);
    const p = "csv table " + name;
    if (!lines.length) { diag.error("D06", p, "is empty. The first line must hold the column names."); return null; }
    const cols = lines[0].map((c) => c.trim());
    if (cols.some((c) => c === "")) { diag.error("D06", p, "has a column with no name in its first line"); return null; }
    const rows = [];
    lines.slice(1).forEach((r, i) => {
      if (r.length !== cols.length) { diag.error("D06", p + ", line " + (i + 2), "has " + r.length + " values but there are " + cols.length + " columns"); return; }
      const o = {};
      cols.forEach((c, k) => { const v = r[k].trim(); o[c] = v === "" ? null : /^-?(\d+\.?\d*|\.\d+)$/.test(v) ? Number(v) : v; });
      rows.push(o);
    });
    return { cols: cols, rows: rows };
  }
  function buildTables(cfg, diag, csv) {
    const base = {};
    Object.keys(csv || {}).forEach((name) => { const t = csvTable(name, csv[name], diag); if (t) { base[name] = t; } });
    const data = isObj(cfg.data) ? cfg.data : {};
    Object.keys(data).forEach((name) => {
      const t = data[name];
      const p = "data." + name;
      if (has(base, name)) { diag.error("D04", p, "has the same name as a CSV table"); return; }
      if (!isObj(t) || !Array.isArray(t.cols) || !Array.isArray(t.rows)) { diag.error("D03", p, "must be {\"cols\": [...], \"rows\": [[...], ...]}"); return; }
      const rows = [];
      t.rows.forEach((r, i) => {
        if (!Array.isArray(r) || r.length !== t.cols.length) { diag.error("D06", p + ".rows[" + i + "]", "has " + (Array.isArray(r) ? r.length : 0) + " values but the table has " + t.cols.length + " columns"); return; }
        const o = {};
        t.cols.forEach((c, j) => { o[c] = r[j]; });
        rows.push(o);
      });
      base[name] = { cols: t.cols.slice(), rows: rows };
    });
    return base;
  }
  function compare(k, desc) {
    return (a, b) => {
      const x = a[k];
      const y = b[k];
      const c = isNum(x) && isNum(y) ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return desc ? -c : c;
    };
  }
  function runPipeline(eng, name, spec) {
    const p = "derive." + name;
    const d = eng.diag;
    if (!validate(spec, "derive", p, d, null)) { return null; }
    const src = eng.table(spec.from);
    if (!src) { if (!eng.has(spec.from)) { d.error("D04", p + ".from", "table \"" + spec.from + "\" does not exist. Tables: " + eng.names().join(", ")); } return null; }
    let cols = src.cols.slice();
    let rows = src.rows.map((r) => Object.assign({}, r));
    const need = (c, where) => { if (cols.indexOf(c) >= 0) { return true; } d.error("D04", p + "." + where, "column \"" + c + "\" is not available. Columns: " + cols.join(", ")); return false; };
    if (isObj(spec.where)) {
      const keys = Object.keys(spec.where).filter((k) => need(k, "where"));
      rows = rows.filter((r) => keys.every((k) => {
        const w = spec.where[k];
        if (w === "$view") { return eng.view === null || r[k] === eng.view; }
        return Array.isArray(w) ? w.indexOf(r[k]) >= 0 : r[k] === w;
      }));
    }
    if (isObj(spec.add)) {
      Object.keys(spec.add).forEach((k) => {
        const bad = exprProblem(spec.add[k], cols);
        if (bad) { d.error("D05", p + ".add." + k, bad); return; }
        if ((usesOp(spec.add[k], "age") || usesOp(spec.add[k], "until")) && eng.asOf === null) { d.error("D03", p + ".add." + k, "\"age\" and \"until\" count days to and from meta.asOf, which must be an ISO date such as 2026-01-31"); return; }
        rows.forEach((r) => { r[k] = evalExpr(spec.add[k], r, eng); });
        if (cols.indexOf(k) < 0) { cols.push(k); }
      });
    }
    const aggs = isObj(spec.agg) ? spec.agg : {};
    const aggNames = Object.keys(aggs).filter((a) => {
      const g = aggs[a];
      if (!Array.isArray(g) || !has(AGG, g[0])) { d.error("D05", p + ".agg." + a, "must be [aggregate, column]. Aggregates: " + Object.keys(AGG).join(", ")); return false; }
      if (g[0] === "count" && g[1] == null) { return true; }
      if (!need(g[1], "agg." + a)) { return false; }
      if (noNumbers(g[0], rows.map((r) => r[g[1]]))) { d.error("D06", p + ".agg." + a, "column \"" + g[1] + "\"" + NO_NUMBERS); return false; }
      return true;
    });
    const applyAggs = (o, group) => { aggNames.forEach((a) => { o[a] = aggs[a][1] == null ? group.length : aggregate(aggs[a][0], group.map((r) => r[aggs[a][1]])); }); return o; };
    if (spec.group != null) {
      const keys = list(spec.group).filter((k) => need(k, "group"));
      const order = [];
      const map = {};
      rows.forEach((r) => { const id = keys.map((k) => String(r[k])).join(CH.sep); if (!has(map, id)) { map[id] = []; order.push(id); } map[id].push(r); });
      rows = order.map((id) => { const o = {}; keys.forEach((k) => { o[k] = map[id][0][k]; }); if (!aggNames.length) { o.count = map[id].length; } return applyAggs(o, map[id]); });
      cols = keys.concat(aggNames.length ? aggNames : ["count"]);
    } else if (spec.bin != null) {
      if (!isNum(spec.step) || spec.step <= 0) { d.error("D03", p + ".step", "is required with bin and must be above zero"); return null; }
      if (!need(spec.bin, "bin")) { return null; }
      const vals = rows.filter((r) => isNum(r[spec.bin]));
      const out = [];
      if (vals.length) {
        const lo0 = Math.floor(Math.min.apply(null, vals.map((r) => r[spec.bin])) / spec.step) * spec.step;
        const n = Math.floor((Math.max.apply(null, vals.map((r) => r[spec.bin])) - lo0) / spec.step) + 1;
        if (n > 60) { d.error("D06", p + ".step", "gives " + n + " bins. Use a larger step: 60 bins is the limit"); return null; }
        const groups = [];
        for (let i = 0; i < n; i += 1) { const lo = +(lo0 + i * spec.step).toFixed(9); const hi = +(lo0 + (i + 1) * spec.step).toFixed(9); out.push({ bin: lo + " to " + hi, lo: lo, hi: hi, count: 0 }); groups.push([]); }
        vals.forEach((r) => { const i = Math.min(n - 1, Math.floor((r[spec.bin] - lo0) / spec.step + 1e-9)); out[i].count += 1; groups[i].push(r); });
        out.forEach((o, i) => applyAggs(o, groups[i]));
      }
      rows = out;
      cols = ["bin", "lo", "hi", "count"].concat(aggNames);
    }
    if (typeof spec.sort === "string") {
      const desc = spec.sort.charAt(0) === "-";
      const k = desc ? spec.sort.slice(1) : spec.sort;
      if (need(k, "sort")) { rows.sort(compare(k, desc)); }
    }
    if (isNum(spec.top) && rows.length > spec.top) {
      const rest = rows.slice(spec.top);
      const o = { _other: true };
      cols.forEach((c, i) => { const nums = rest.map((r) => r[c]).filter(isNum); o[c] = i === 0 ? (spec.other || "Other") : (nums.length === rest.length ? sum(nums) : null); });
      rows = rows.slice(0, spec.top).concat([o]);
    }
    if (spec.cum != null && need(spec.cum, "cum")) {
      const total = sum(rows.map((r) => r[spec.cum]).filter(isNum));
      let run = 0;
      rows.forEach((r) => { const v = isNum(r[spec.cum]) ? r[spec.cum] : 0; run += v; r[spec.cum + "Cum"] = run; r[spec.cum + "Share"] = total ? v / total : 0; r[spec.cum + "CumShare"] = total ? run / total : 0; });
      cols = cols.concat([spec.cum + "Cum", spec.cum + "Share", spec.cum + "CumShare"]);
    }
    return { cols: cols, rows: rows };
  }
  function Engine(cfg, diag, view, csv) {
    this.diag = diag;
    this.view = view == null ? null : view;
    this.base = buildTables(cfg, diag, csv);
    this.derive = isObj(cfg.derive) ? cfg.derive : {};
    this.memo = {};
    this.stack = [];
    this.asOf = isoDate(isObj(cfg.meta) ? cfg.meta.asOf : null);
    this.late = null;
  }
  Engine.prototype.names = function () { return Object.keys(this.base).concat(Object.keys(this.derive)); };
  Engine.prototype.has = function (name) { return has(this.base, name) || has(this.derive, name); };
  Engine.prototype.table = function (name) {
    if (has(this.memo, name)) { return this.memo[name]; }
    let out = null;
    if (has(this.derive, name)) {
      if (this.stack.indexOf(name) >= 0) { this.diag.error("D04", "derive." + name, "refers to itself through " + this.stack.join(" > ")); return null; }
      this.stack.push(name);
      try { out = runPipeline(this, name, this.derive[name]); } catch (e) { this.diag.error("D00", "derive." + name, "could not be computed: " + e.message); }
      this.stack.pop();
    } else if (has(this.base, name)) { out = this.base[name]; }
    this.memo[name] = out;
    return out;
  };
  Engine.prototype.scalar = function (e, path) {
    const d = this.diag;
    if (isNum(e)) { return e; }
    if (!Array.isArray(e) || typeof e[0] !== "string") { d.error("D05", path, "must be a number or a scalar such as [\"sum\", \"table.column\"]"); return null; }
    const op = e[0];
    if (has(AGG, op)) {
      const ref = String(e[1] == null ? "" : e[1]);
      const dot = ref.indexOf(".");
      const tn = dot < 0 ? ref : ref.slice(0, dot);
      const cn = dot < 0 ? null : ref.slice(dot + 1);
      const t = this.table(tn);
      if (!t) { if (!this.has(tn)) { d.error("D04", path, "table \"" + tn + "\" does not exist. Tables: " + this.names().join(", ")); } return null; }
      if (op === "count" && cn === null) { return t.rows.length; }
      if (cn === null || t.cols.indexOf(cn) < 0) { d.error("D04", path, "column \"" + cn + "\" is not in \"" + tn + "\". Columns: " + t.cols.join(", ")); return null; }
      const vals = t.rows.map((r) => r[cn]);
      if (noNumbers(op, vals)) { d.error("D06", path, "column \"" + cn + "\" in \"" + tn + "\"" + NO_NUMBERS); return null; }
      return aggregate(op, vals);
    }
    if (has(OPS, op)) {
      if (has(ARITY, op) && e.length - 1 !== ARITY[op]) { d.error("D05", path, "\"" + op + "\" takes " + ARITY[op] + " value(s)"); return null; }
      const a = e.slice(1).map((x, i) => this.scalar(x, path + "[" + (i + 1) + "]"));
      return a.some((x) => !isNum(x)) ? null : OPS[op](a);
    }
    d.error("D05", path, "unknown operation \"" + op + "\". Aggregates: " + Object.keys(AGG).join(", ") + ". Arithmetic: " + Object.keys(OPS).join(", "));
    return null;
  };

  /* ---------- number and date formats ---------- */
  const NUMF = {
    int: { maximumFractionDigits: 0 },
    dec1: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    dec2: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    pct0: { style: "percent", maximumFractionDigits: 0 },
    pct1: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 },
    cur0: { style: "currency", maximumFractionDigits: 0 },
    cur2: { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 },
    compact: { notation: "compact", maximumFractionDigits: 1 },
    curCompact: { style: "currency", notation: "compact", maximumFractionDigits: 1 },
    days0: { maximumFractionDigits: 0 },
    days1: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    x1: { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  };
  const SUFFIX = { days0: " d", days1: " d", x1: CH.times };
  function Formatter(meta, lang) {
    this.locale = (meta && meta.locale) || lang || "en";
    this.currency = (meta && meta.currency) || "USD";
    this.cache = {};
  }
  Formatter.prototype.nf = function (name) {
    if (!this.cache[name]) {
      const o = Object.assign({}, NUMF[name] || NUMF.int);
      if (o.style === "currency") { o.currency = this.currency; o.currencyDisplay = "narrowSymbol"; }
      try { this.cache[name] = new Intl.NumberFormat(this.locale, o); } catch (e) { this.cache[name] = new Intl.NumberFormat("en", o); }
    }
    return this.cache[name];
  };
  Formatter.prototype.date = function (v, name) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}:\d{2})(?::\d{2})?\s*(Z|[+-]\d{2}:?\d{2})?)?$/.exec(String(v));
    if (!m) { return String(v); }
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1, 12));
    const o = name === "month" || !m[3] ? { month: "short", year: "numeric" } : name === "day" ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" };
    o.timeZone = "UTC";
    let out;
    try { out = new Intl.DateTimeFormat(this.locale, o).format(dt); } catch (e) { out = new Intl.DateTimeFormat("en", o).format(dt); }
    if (name === "date" && m[4]) { out += ", " + m[4] + (m[5] ? " UTC" + (m[5] === "Z" ? "" : m[5]) : ""); }
    return out;
  };
  Formatter.prototype.format = function (v, name, signed) {
    name = name || "int";
    if (v == null || v === "") { return "n/a"; }
    if (name === "text") { return String(v); }
    if (name === "date" || name === "day" || name === "month") { return this.date(v, name); }
    if (!isNum(v)) { return String(v); }
    const f = this.nf(name);
    const body = f.format(Math.abs(v)) + (SUFFIX[name] || "");
    if (f.format(Math.abs(v)) === f.format(0)) { return body; }
    return (v < 0 ? CH.minus : signed ? "+" : "") + body;
  };
  /* Axis ticks: written in full under 10,000 and compact once the axis reaches it. */
  Formatter.prototype.axis = function (v, name, max) {
    if (Math.abs(max) >= 10000 && (!name || name === "int" || name === "dec1" || name === "dec2")) { return this.format(v, "compact"); }
    if (Math.abs(max) >= 10000 && (name === "cur0" || name === "cur2")) { return this.format(v, "curCompact"); }
    return this.format(v, name);
  };

  function niceScale(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; }
    const raw = (hi - lo) / Math.max(1, n);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    const a = Math.floor(lo / step + 1e-9) * step;
    const b = Math.ceil(hi / step - 1e-9) * step;
    const ticks = [];
    for (let i = 0; a + i * step <= b + step * 1e-6; i += 1) { ticks.push(+(a + i * step).toPrecision(12)); }
    return { min: a, max: b, step: step, ticks: ticks };
  }
  function statusOf(v, st) {
    if (!isObj(st) || !isNum(v)) { return null; }
    const below = st.direction === "below";
    const strict = st.strict === true;
    const hit = (t) => isNum(t) && (below ? (strict ? v < t : v <= t) : (strict ? v > t : v >= t));
    return hit(st.critical) ? "critical" : hit(st.serious) ? "serious" : hit(st.warning) ? "warning" : null;
  }
  const STATUS_WORD = { warning: "Warning", serious: "Serious", critical: "Critical", good: "Good" };
  const statusLabel = (level, st) => (st && isObj(st.labels) && st.labels[level]) || STATUS_WORD[level];

  /* ---------- prepare: validate everything and compute every number ---------- */
  const CHARTS = ["bar", "line", "histogram", "pareto"];
  const BANNED = {
    pie: "Use a bar chart sorted by value, or a pareto chart.",
    donut: "Use a bar chart sorted by value, or a pareto chart.",
    gauge: "Use a KPI tile with a delta, or a bar with a target.",
    radar: "Use a bar chart per measure, side by side."
  };
  const UNITLESS = /^(pct|cur|x|days|date|day|month|text)/;
  function prepare(cfg, mounts, view, lang, csv) {
    const diag = new Diag();
    if (!isObj(cfg)) { diag.error("D01", "data block", "must be a JSON object"); return { diag: diag, meta: {}, kpis: {}, cards: {} }; }
    Object.keys(cfg).forEach((k) => { if (["meta", "data", "derive", "facts", "kpis", "cards"].indexOf(k) < 0 && k.charAt(0) !== "_") { diag.error("D05", k, "unknown top-level key. Keys: meta, data, derive, facts, kpis, cards"); } });
    const meta = isObj(cfg.meta) ? cfg.meta : {};
    validate(meta, "meta", "meta", diag, null);
    const eng = new Engine(cfg, diag, view, csv);
    Object.keys(eng.derive).forEach((n) => { if (has(eng.base, n)) { diag.error("D04", "derive." + n, "has the same name as a data table"); } eng.table(n); });
    const out = { diag: diag, eng: eng, meta: meta, fmt: new Formatter(meta, lang), kpis: {}, cards: {} };
    out.facts = {};
    const fc = isObj(cfg.facts) ? cfg.facts : {};
    Object.keys(fc).forEach((id) => {
      const p = "facts." + id;
      if (!validate(fc[id], "fact", p, diag, { eng: eng })) { return; }
      const v = eng.scalar(fc[id].value, p + ".value");
      if (!present(v) && !diag.items.some((x) => x.path.indexOf(p + ".value") === 0)) { diag.error("D06", p + ".value", "has no result. Check the table has rows in this view."); }
      /* A number takes any number format. Text is quoted as written, unless it is a date and a date format was asked for. */
      const ff = fc[id].format;
      out.facts[id] = out.fmt.format(v, isNum(v) ? ff || "int" : ff === "date" || ff === "day" || ff === "month" ? ff : "text");
    });
    /* Text that quotes facts, as {name}. An unknown name is reported once and left as written. */
    out.fill = (text, path) => String(text == null ? "" : text).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (m, name) => {
      if (has(out.facts, name)) { return out.facts[name]; }
      diag.error("D04", path || "text", "quotes {" + name + "}, which is not a fact. Facts: " + (Object.keys(out.facts).join(", ") || "none"));
      return m;
    });
    const texts = (v) => (isObj(v) ? Object.keys(v).map((k) => v[k]) : v == null ? [] : [v]);
    texts(meta.subtitle).forEach((x) => out.fill(x, "meta.subtitle"));
    const kp = isObj(cfg.kpis) ? cfg.kpis : {};
    const cd = isObj(cfg.cards) ? cfg.cards : {};
    Object.keys(kp).forEach((id) => {
      const spec = kp[id];
      const p = "kpis." + id;
      if (!validate(spec, "kpi", p, diag, { eng: eng })) { return; }
      const k = { spec: spec, value: eng.scalar(spec.value, p + ".value") };
      if (!isNum(k.value) && !diag.items.some((x) => x.path.indexOf(p + ".value") === 0)) { diag.error("D06", p + ".value", "has no numeric result. Check that the column holds numbers and the view has rows."); }
      if (spec.detail) { k.detail = eng.scalar(spec.detail.value, p + ".detail.value"); out.fill(spec.detail.text, p + ".detail.text"); }
      if (spec.delta) { k.from = eng.scalar(spec.delta.from, p + ".delta.from"); }
      if (spec.spark) { const t = eng.table(spec.spark.data); k.spark = t ? t.rows.map((r) => r[spec.spark.y]).filter(isNum) : []; }
      if (spec.status && spec.status.field) { diag.error("D05", p + ".status.field", "is not used on a KPI tile, which tests its own value"); }
      if (!spec.unit && !UNITLESS.test(spec.format || "int")) { diag.note("N01", p, "has no unit. Say what is being counted."); }
      out.kpis[id] = k;
    });
    Object.keys(cd).forEach((id) => {
      const spec = cd[id];
      const p = "cards." + id;
      let ok = validate(spec, "card", p, diag, { eng: eng });
      if (!isObj(spec)) { return; }
      if ((spec.chart == null) === (spec.table == null)) { diag.error("D03", p, "needs exactly one of chart or table"); ok = false; }
      if (isObj(spec.chart)) {
        const t = spec.chart.type;
        if (CHARTS.indexOf(t) >= 0) { if (!validate(spec.chart, t, p + ".chart", diag, { eng: eng })) { ok = false; } }
        else if (has(BANNED, t)) { diag.error("V04", p + ".chart.type", "\"" + t + "\" is not part of this system. " + BANNED[t]); ok = false; }
        else { diag.error("D05", p + ".chart.type", "unknown chart type \"" + t + "\". Types: " + CHARTS.join(", ") + ". For anything else use a custom card."); ok = false; }
        if (ok && t === "line" && list(spec.chart.y).length > 4) { diag.error("C07", p + ".chart.y", "has " + list(spec.chart.y).length + " series. Four is the limit: drawn are the first four. Fold the rest or split into small charts."); }
        if (ok && (t === "bar" || t === "pareto")) { const tb = eng.table(spec.chart.data); if (tb && tb.rows.length > 12 && spec.chart.orient !== "v") { diag.note("V13", p + ".chart", "has " + tb.rows.length + " bars. Keep the top few and fold the rest with top in a pipeline."); } }
      } else if (spec.chart != null) { diag.error("D03", p + ".chart", "must be an object"); ok = false; }
      /* A title is measured as the reader sees it, with its facts filled in, not as it is written. */
      ["title", "subtitle", "note"].forEach((key) => texts(spec[key]).forEach((x) => {
        const shown = out.fill(x, p + "." + key);
        if (key === "title" && typeof x === "string" && shown.length > 90) { diag.note("W01", p + ".title", "reads at " + shown.length + " characters. State the finding in one short sentence."); }
      }));
      out.cards[id] = { spec: spec, ok: ok };
    });
    if (mounts) {
      mounts.kpis.forEach((id) => { if (!has(kp, id)) { diag.error("D02", "data-kpi=\"" + id + "\"", "has no entry in kpis. Entries: " + (Object.keys(kp).join(", ") || "none")); } });
      mounts.cards.forEach((id) => { if (!has(cd, id)) { diag.error("D02", "data-card=\"" + id + "\"", "has no entry in cards. Entries: " + (Object.keys(cd).join(", ") || "none")); } });
      Object.keys(kp).forEach((id) => { if (mounts.kpis.indexOf(id) < 0) { diag.note("D02", "kpis." + id, "is defined but the layout has no data-kpi mount for it"); } });
      Object.keys(cd).forEach((id) => { if (mounts.cards.indexOf(id) < 0) { diag.note("D02", "cards." + id, "is defined but the layout has no data-card mount for it"); } });
      if (mounts.kpis.length > 5) { diag.note("L03", "layout", mounts.kpis.length + " KPI tiles. Three to five reads at a glance: move the rest into cards."); }
      if (mounts.kpis.filter((id) => has(kp, id) && isObj(kp[id]) && kp[id].hero === true).length > 1) { diag.note("L02", "kpis", "more than one tile is marked hero. A page leads with one number."); }
      if (mounts.extraScripts > 0) { diag.note("X04", "layout", mounts.extraScripts + " script element(s) in the layout. A page carries no script of its own: remove them."); }
      if (mounts.rawStyles > 0) { diag.note("C05", "layout", mounts.rawStyles + " inline style attribute(s). Use the documented classes and tokens instead."); }
    }
    if (eng.late !== null) { diag.note("N11", "meta.asOf", "is " + isoText(eng.asOf) + ", but the rows hold a date as late as " + isoText(eng.late) + ", so \"age\" gives days below zero. If the rows were replaced, update asOf. For a date that is meant to lie ahead, use \"until\"."); }
    if (!meta.asOf) { diag.note("N02", "meta.asOf", "is not stated. Every card shows when its data was current."); }
    if (!meta.source) { diag.note("N02", "meta.source", "is not stated. Every card shows where its data came from."); }
    return out;
  }

  const core = { version: VERSION, schema: SCHEMA, prepare: prepare, parseCsv: parseCsv, Formatter: Formatter, niceScale: niceScale, exprText: exprText, statusOf: statusOf, words: words };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }
  if (!root.document) { return; }

  /* ================= everything below needs a browser ================= */
  const doc = root.document;
  const NS = "http://www.w3.org/2000/svg";
  function fill(e, attrs, kids) {
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) { return; }
        if (k === "text") { e.textContent = v; }
        else if (k.slice(0, 2) === "on") { e.addEventListener(k.slice(2), v); }
        else { e.setAttribute(k, v === true ? "" : String(v)); }
      });
    }
    list(kids).forEach((c) => { if (c != null && c !== false) { e.appendChild(typeof c === "string" ? doc.createTextNode(c) : c); } });
    return e;
  }
  const h = (tag, attrs, kids) => fill(doc.createElement(tag), attrs, kids);
  const s = (tag, attrs, kids) => fill(doc.createElementNS(NS, tag), attrs, kids);
  const ICON = {
    up: "M6 1.5l4.5 5.5H7.4v3.5H4.6V7H1.5z",
    down: "M6 10.5L1.5 5h3.1V1.5h2.8V5h3.1z",
    flat: "M1.5 5h9v2h-9z",
    good: "M6 1.2a4.8 4.8 0 1 0 0 9.6a4.8 4.8 0 0 0 0-9.6z",
    warning: "M6 1l5.2 9.6H0.8z",
    serious: "M6 0.6L11.4 6L6 11.4L0.6 6z",
    critical: "M1.6 1.6h8.8v8.8H1.6z",
    table: "M1.5 2h9v1.8h-9zM1.5 5.1h9v1.8h-9zM1.5 8.2h9V10h-9z",
    chart: "M1.5 6.5h2.2V10H1.5zM4.9 3.5h2.2V10H4.9zM8.3 1.5h2.2V10H8.3z"
  };
  const icon = (name, cls) => s("svg", { class: "ro-ico" + (cls ? " " + cls : ""), viewBox: "0 0 12 12", "aria-hidden": "true" }, s("path", { d: ICON[name] }));
  const glyph = (name, x, y) => s("path", { d: ICON[name], class: "ro-glyph ro-ico--" + name, transform: "translate(" + x + "," + y + ") scale(0.85)" });
  const chip = (level, text) => h("span", { class: "ro-chip ro-chip--" + level }, [icon(level), text]);
  const empty = (text) => h("div", { class: "ro-empty", text: text });

  let ctx2d = null;
  function px(token) {
    const cs = root.getComputedStyle(doc.documentElement);
    const v = cs.getPropertyValue(token).trim();
    const n = parseFloat(v);
    return /rem$/.test(v) ? n * parseFloat(cs.fontSize) : n;
  }
  function textW(str, size, weight) {
    if (!ctx2d) { ctx2d = doc.createElement("canvas").getContext("2d"); }
    ctx2d.font = (weight || 400) + " " + size + "px " + root.getComputedStyle(doc.body).fontFamily;
    return ctx2d.measureText(String(str)).width;
  }
  function clip(str, size, max) {
    if (textW(str, size) <= max) { return str; }
    let out = String(str);
    while (out.length > 1 && textW(out + CH.dots, size) > max) { out = out.slice(0, -1); }
    return out + CH.dots;
  }
  const frame = (W, H, label) => s("svg", { class: "ro-chart", viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": label });
  const maxOf = (a) => (a.length ? Math.max.apply(null, a) : 0);
  const labelOf = (spec, col) => (isObj(spec.labels) && spec.labels[col]) || words(col);
  const withUnit = (text, unit) => (unit ? text + " " + unit : text);
  const viewText = (v, view) => (isObj(v) ? (view !== null && has(v, String(view)) ? v[String(view)] : v["*"]) : v == null ? "" : String(v));
  function barPath(horizontal, a, b, c, t) {
    /* A bar from the baseline a to the tip b, square at the baseline and rounded 4px at the tip. */
    const r = Math.min(4, t / 2, Math.abs(b - a));
    const d = b >= a ? 1 : -1;
    if (horizontal) { return "M" + a + "," + c + "H" + (b - d * r) + "Q" + b + "," + c + " " + b + "," + (c + r) + "V" + (c + t - r) + "Q" + b + "," + (c + t) + " " + (b - d * r) + "," + (c + t) + "H" + a + "Z"; }
    return "M" + c + "," + a + "V" + (b - d * r) + "Q" + c + "," + b + " " + (c + r) + "," + b + "H" + (c + t - r) + "Q" + (c + t) + "," + b + " " + (c + t) + "," + (b - d * r) + "V" + a + "Z";
  }
  function highlightSet(hl, cats, vals) {
    if (hl == null) { return {}; }
    const set = {};
    if (hl === "max" || hl === "min") { const m = hl === "max" ? Math.max.apply(null, vals) : Math.min.apply(null, vals); cats.forEach((c, i) => { if (vals[i] === m) { set[c] = true; } }); }
    else { list(hl).forEach((c) => { set[String(c)] = true; }); }
    return set;
  }
  function statusLegend(used, st) { return ["warning", "serious", "critical"].filter((l) => used[l]).map((l) => ({ icon: l, label: statusLabel(l, st) })); }

  /* ---------- charts. Each returns {svg, points, legend, cols, locate?}. ---------- */
  function drawBarH(spec, rows, env, pareto) {
    const f = env.fmt;
    const fm = spec.format || "int";
    const rowH = env.compact ? 24 : 30;
    const t = env.compact ? 12 : 16;
    const cats = rows.map((r) => String(r[spec.x]));
    const vals = rows.map((r) => (isNum(r[spec.y]) ? r[spec.y] : 0));
    const st = pareto ? null : spec.status;
    const hl = pareto ? {} : highlightSet(spec.highlight, cats, vals);
    const valText = vals.map((v) => f.format(v, fm));
    const labW = Math.min(maxOf(cats.map((c) => textW(c, env.S12))) + 12, env.W * 0.38);
    const valW = maxOf(valText.map((x) => textW(x, env.S12, 500))) + 10 + (st ? 14 : 0);
    const total = sum(vals);
    const shareW = pareto ? Math.max(textW("100%", env.S12), textW("Cumulative", env.S11)) + 14 : 0;
    let lo = Math.min(0, Math.min.apply(null, vals.concat([0])));
    let hi = Math.max(0, maxOf(vals));
    const tcol = !pareto && typeof spec.target === "string" ? spec.target : null;
    const tnum = !pareto && isNum(spec.target) ? spec.target : null;
    const targetOf = (r) => (tnum !== null ? tnum : tcol ? r[tcol] : null);
    const extra = pareto ? [] : [tcol].concat(list(spec.band)).filter(Boolean);
    rows.forEach((r) => { extra.forEach((c) => { if (isNum(r[c])) { hi = Math.max(hi, r[c]); lo = Math.min(lo, r[c]); } }); });
    if (tnum !== null) { hi = Math.max(hi, tnum); lo = Math.min(lo, tnum); }
    const x0 = labW + (lo < 0 ? valW : 0);
    const x1 = Math.max(x0 + 20, env.W - valW - shareW);
    const sx = (v) => x0 + ((v - lo) / ((hi - lo) || 1)) * (x1 - x0);
    const head = pareto ? 18 : 0;
    let cutAt = -1;
    if (pareto) { let run = 0; const cut = isNum(spec.cut) ? spec.cut : 0.8; for (let i = 0; i < rows.length; i += 1) { run += vals[i]; if (total > 0 && run / total >= cut - 1e-9) { cutAt = i; break; } } }
    const gap = pareto && cutAt >= 0 && cutAt < rows.length - 1 ? 18 : 0;
    const H = head + rows.length * rowH + gap;
    const svg = frame(env.W, H, env.label);
    const points = [];
    const used = {};
    let run = 0;
    if (pareto) { svg.appendChild(s("text", { x: env.W, y: 11, "text-anchor": "end", text: "Cumulative" })); }
    svg.appendChild(s("line", { class: "ro-base-line", x1: sx(0), x2: sx(0), y1: head, y2: H }));
    rows.forEach((r, i) => {
      const y = head + i * rowH + (pareto && i > cutAt && cutAt >= 0 ? gap : 0);
      const mid = y + rowH / 2;
      const v = vals[i];
      const level = st ? statusOf(r[st.field || spec.y], st) : null;
      if (level) { used[level] = true; }
      run += v;
      const cls = "ro-mark" + (level ? " ro-mark--" + level : r._other ? " ro-mark--ctx" : (hl[cats[i]] || (pareto && i <= cutAt)) ? " ro-mark--em" : "");
      const cat = clip(cats[i], env.S12, labW - 10);
      svg.appendChild(s("text", { class: "ro-cat", x: 0, y: mid, "dominant-baseline": "central" }, [cat, cat !== cats[i] ? s("title", { text: cats[i] }) : null]));
      if (!pareto && list(spec.band).length === 2 && isNum(r[spec.band[0]]) && isNum(r[spec.band[1]])) { svg.appendChild(s("rect", { class: "ro-band", x: sx(r[spec.band[0]]), y: mid - t / 2 - 4, width: Math.max(0, sx(r[spec.band[1]]) - sx(r[spec.band[0]])), height: t + 8, rx: 2 })); }
      const bar = s("path", { class: cls, d: barPath(true, sx(0), sx(v), mid - t / 2, t) });
      svg.appendChild(bar);
      if (isNum(targetOf(r))) { ["ro-target-gap", "ro-target"].forEach((cl) => svg.appendChild(s("line", { class: cl, x1: sx(targetOf(r)), x2: sx(targetOf(r)), y1: mid - t / 2 - (cl === "ro-target" ? 4 : 0), y2: mid + t / 2 + (cl === "ro-target" ? 4 : 0) }))); }
      const reach = pareto ? [] : extra.map((c) => r[c]).concat([targetOf(r)]).filter(isNum);
      const above = reach.filter((x) => x > v);
      const fits = above.length > 0 && sx(Math.min.apply(null, above)) - sx(v) >= textW(valText[i], env.S12, 500) + (level ? 14 : 0) + 18;
      const tip = v < 0 ? sx(Math.min.apply(null, reach.concat([v]))) - 6 : fits ? sx(v) + 6 : sx(Math.max.apply(null, reach.concat([v]))) + 6;
      if (level) { svg.appendChild(glyph(level, v < 0 ? tip - 10 : tip, mid - 5)); }
      svg.appendChild(s("text", { class: "ro-val", x: v < 0 ? tip - (level ? 14 : 0) : tip + (level ? 14 : 0), y: mid, "dominant-baseline": "central", "text-anchor": v < 0 ? "end" : "start", text: valText[i] }));
      const tipRows = [[labelOf(spec, spec.y), withUnit(valText[i], spec.unit)]];
      if (pareto) {
        svg.appendChild(s("text", { class: "ro-cat ro-tnum", x: env.W, y: mid, "dominant-baseline": "central", "text-anchor": "end", text: f.format(total ? run / total : 0, "pct0") }));
        tipRows.push(["Share of total", f.format(total ? v / total : 0, "pct1")], ["Cumulative", f.format(total ? run / total : 0, "pct1")]);
      } else {
        if (isNum(targetOf(r))) { tipRows.push([labelOf(spec, tcol || "target"), withUnit(f.format(targetOf(r), fm), spec.unit)]); }
        if (list(spec.band).length === 2 && isNum(r[spec.band[0]])) { tipRows.push([labelOf(spec, "band"), f.format(r[spec.band[0]], fm) + " to " + f.format(r[spec.band[1]], fm)]); }
        if (level) { tipRows.push(["Status", statusLabel(level, st)]); }
      }
      svg.appendChild(s("rect", { class: "ro-hit", "data-i": i, x: 0, y: y, width: env.W, height: rowH }));
      points.push({ cx: Math.max(sx(v), sx(0)), cy: mid, node: bar, title: cats[i], rows: tipRows });
    });
    if (gap) {
      const y = head + (cutAt + 1) * rowH + 5;
      svg.appendChild(s("line", { class: "ro-ref", x1: 0, x2: env.W, y1: y, y2: y }));
      svg.appendChild(s("text", { class: "ro-ann", x: x0 + 8, y: y + 12, text: f.format(isNum(spec.cut) ? spec.cut : 0.8, "pct0") + " of the total sits above this line" }));
    }
    const legend = [];
    if (tcol || tnum !== null) { legend.push({ cls: "ro-key-tick", label: labelOf(spec, tcol || "target") }); }
    if (!pareto && list(spec.band).length === 2) { legend.push({ cls: "ro-key-band", label: labelOf(spec, "band") }); }
    const bandName = (c) => (list(spec.band).indexOf(c) < 0 ? null : labelOf(spec, "band") + (c === spec.band[0] ? ", low" : ", high"));
    const cols = [[spec.x, "text"], [spec.y, fm]].concat(extra.map((c) => [c, fm, bandName(c)]));
    return { svg: svg, points: points, legend: legend.concat(statusLegend(used, st)), cols: cols };
  }

  function axisLayout(ticks, fm, env, max) {
    const text = ticks.map((v) => env.fmt.axis(v, fm, max));
    return { text: text, w: maxOf(text.map((x) => textW(x, env.S11))) + 10 };
  }
  function drawGrid(svg, scale, ax, sy, plotW, W) {
    scale.ticks.forEach((v, i) => {
      svg.appendChild(s("line", { class: v === 0 ? "ro-base-line" : "ro-grid-line", x1: 0, x2: plotW, y1: sy(v), y2: sy(v) }));
      svg.appendChild(s("text", { x: W, y: sy(v), "text-anchor": "end", "dominant-baseline": "central", text: ax.text[i] }));
    });
  }
  /* Pick which x labels to draw so that none collide: always the first, evenly spaced after. */
  function thin(labels, slot, env, fromEnd) {
    const m = maxOf(labels.map((x) => textW(x, env.S11)));
    /* Counted from the end, the last label sits against the right edge, so it needs a little more room than the rest. */
    const w = m + 14 + (fromEnd ? Math.max(0, m / 2 - 9) : 0);
    return Math.max(1, Math.ceil(w / Math.max(1, slot)));
  }
  function xLabels(svg, labels, at, every, limit, y, env, startFirst, fromEnd) {
    const n = labels.length;
    if (fromEnd) {
      /* On a line the latest point is the one the reader came for. Its label is always drawn, set against the right edge,
         and the others are counted back from it at an even step, so the spacing stays regular up to the present. */
      let edge = 1e9;
      for (let i = n - 1; i >= 0; i -= every) {
        const w = textW(labels[i], env.S11);
        const anchor = i === n - 1 ? "end" : at(i) - w / 2 < 0 ? "start" : "middle";
        const x = anchor === "end" ? Math.min(limit, at(i) + w / 2) : at(i);
        const left = anchor === "end" ? x - w : anchor === "start" ? x : x - w / 2;
        if (left + w <= edge - 10) { svg.appendChild(s("text", { x: x, y: y, "text-anchor": anchor, text: labels[i] })); edge = left; }
      }
      return;
    }
    let edge = -1e9;
    labels.forEach((c, i) => {
      if (i % every !== 0) { return; }
      const w = textW(c, env.S11);
      const start = startFirst && i === 0;
      const left = start ? at(i) : at(i) - w / 2;
      if (left < edge + 10 || left + w > limit + 2) { return; }
      svg.appendChild(s("text", { x: at(i), y: y, "text-anchor": start ? "start" : "middle", text: c }));
      edge = left + w;
    });
  }

  function drawBarV(spec, rows, env, hist) {
    const f = env.fmt;
    const fm = spec.format || "int";
    const n = rows.length;
    const vals = rows.map((r) => (isNum(r[spec.y]) ? r[spec.y] : 0));
    const st = spec.status;
    const refs = hist ? list(spec.refs) : [];
    const scale = niceScale(Math.min(0, Math.min.apply(null, vals.concat([0]))), Math.max(maxOf(vals), 1e-9), 4);
    const ax = axisLayout(scale.ticks, fm, env, scale.max);
    const top = refs.length ? 20 : 12;
    const bottom = 20;
    const H = env.chartH;
    const plotW = env.W - ax.w;
    const sy = (v) => top + (1 - (v - scale.min) / (scale.max - scale.min)) * (H - top - bottom);
    const slot = plotW / Math.max(1, n);
    const bw = hist ? Math.max(1, slot - 2) : Math.min(24, Math.max(1, slot - 2));
    const svg = frame(env.W, H, env.label);
    drawGrid(svg, scale, ax, sy, plotW, env.W);
    const cats = rows.map((r) => (hist ? f.format(r[spec.x], spec.xFormat || "int") : f.format(r[spec.x], spec.xFormat || "text")));
    const hl = hist ? {} : highlightSet(spec.highlight, rows.map((r) => String(r[spec.x])), vals);
    const step = hist && n > 1 ? rows[1][spec.x] - rows[0][spec.x] : hist && n === 1 && isNum(rows[0].hi) ? rows[0].hi - rows[0][spec.x] : 1;
    const every = thin(cats, slot, env);
    const points = [];
    const used = {};
    xLabels(svg, cats, (i) => (hist ? i * slot : i * slot + slot / 2), every, plotW, H - 5, env, hist);
    rows.forEach((r, i) => {
      const x = i * slot + (slot - bw) / 2;
      const level = st ? statusOf(r[st.field || (hist ? spec.x : spec.y)], st) : null;
      if (level) { used[level] = true; }
      const bar = s("path", { class: "ro-mark" + (level ? " ro-mark--" + level : hl[String(r[spec.x])] ? " ro-mark--em" : ""), d: barPath(false, sy(0), sy(vals[i]), x, bw) });
      svg.appendChild(bar);
      if (!hist && hl[String(r[spec.x])]) { svg.appendChild(s("text", { class: "ro-val", x: i * slot + slot / 2, y: sy(vals[i]) - 6, "text-anchor": "middle", text: f.format(vals[i], fm) })); }
      const title = hist ? withUnit(cats[i] + " to " + f.format(r[spec.x] + step, spec.xFormat || "int"), spec.xUnit) : cats[i];
      const tipRows = [[labelOf(spec, spec.y), withUnit(f.format(vals[i], fm), spec.unit)]];
      if (level) { tipRows.push(["Status", statusLabel(level, st)]); }
      svg.appendChild(s("rect", { class: "ro-hit", "data-i": i, x: i * slot, y: top, width: slot, height: H - top - bottom }));
      points.push({ cx: i * slot + slot / 2, cy: sy(vals[i]), node: bar, title: title, rows: tipRows });
    });
    refs.forEach((ref) => {
      const x = Math.max(0, Math.min(plotW, ((ref.x - rows[0][spec.x]) / step) * slot));
      const flip = x + textW(ref.label, env.S11) + 6 > plotW;
      svg.appendChild(s("line", { class: "ro-ref", x1: x, x2: x, y1: 4, y2: sy(0) }));
      svg.appendChild(s("text", { class: "ro-ann ro-halo", x: flip ? x - 5 : x + 5, y: 11, "text-anchor": flip ? "end" : "start", text: ref.label }));
    });
    const cols = hist && n && has(rows[0], "bin") ? [["bin", "text"], [spec.y, fm]] : [[spec.x, spec.xFormat || (hist ? "int" : "text")], [spec.y, fm]];
    return { svg: svg, points: points, legend: statusLegend(used, st), cols: cols };
  }

  function drawLine(spec, rows, env) {
    const f = env.fmt;
    const fm = spec.format || "int";
    const ys = list(spec.y).slice(0, 4);
    const n = rows.length;
    const band = list(spec.band).length === 2 ? spec.band : null;
    const tcol = typeof spec.target === "string" ? spec.target : null;
    const all = [];
    rows.forEach((r) => { ys.concat(band || [], tcol ? [tcol] : []).forEach((c) => { if (isNum(r[c])) { all.push(r[c]); } }); });
    if (isNum(spec.target)) { all.push(spec.target); }
    let lo = all.length ? Math.min.apply(null, all) : 0;
    const hi = all.length ? Math.max.apply(null, all) : 1;
    if (spec.zero === true || (lo >= 0 && lo < hi * 0.35)) { lo = Math.min(lo, 0); }
    const scale = niceScale(lo, hi, 4);
    const ax = axisLayout(scale.ticks, fm, env, scale.max);
    const top = 18;
    const bottom = 20;
    const H = env.chartH;
    const plotW = env.W - ax.w;
    const sx = (i) => (n > 1 ? 5 + (i * (plotW - 10)) / (n - 1) : plotW / 2);
    const sy = (v) => top + (1 - (v - scale.min) / (scale.max - scale.min)) * (H - top - bottom);
    const svg = frame(env.W, H, env.label);
    const path = (col) => { let d = ""; let pen = false; rows.forEach((r, i) => { if (isNum(r[col])) { d += (pen ? "L" : "M") + sx(i).toFixed(1) + "," + sy(r[col]).toFixed(1); pen = true; } else { pen = false; } }); return d; };
    if (band) {
      let d = "";
      rows.forEach((r, i) => { if (isNum(r[band[1]])) { d += (d ? "L" : "M") + sx(i).toFixed(1) + "," + sy(r[band[1]]).toFixed(1); } });
      for (let i = n - 1; i >= 0; i -= 1) { if (isNum(rows[i][band[0]])) { d += "L" + sx(i).toFixed(1) + "," + sy(rows[i][band[0]]).toFixed(1); } }
      if (d) { svg.appendChild(s("path", { class: "ro-band", d: d + "Z" })); }
    }
    drawGrid(svg, scale, ax, sy, plotW, env.W);
    const cats = rows.map((r) => f.format(r[spec.x], spec.xFormat || "text"));
    const every = thin(cats, (plotW - 10) / Math.max(1, n - 1), env, true);
    xLabels(svg, cats, sx, every, plotW, H - 5, env, true, true);
    if (tcol) { svg.appendChild(s("path", { class: "ro-line ro-line--target", d: path(tcol) })); }
    if (isNum(spec.target)) { svg.appendChild(s("line", { class: "ro-line ro-line--target", x1: 0, x2: plotW, y1: sy(spec.target), y2: sy(spec.target) })); }
    list(spec.annotate).forEach((a) => {
      const i = rows.findIndex((r) => String(r[spec.x]) === String(a.x));
      if (i < 0) { return; }
      const flip = sx(i) + textW(a.text, env.S11) + 6 > plotW;
      svg.appendChild(s("line", { class: "ro-ref", x1: sx(i), x2: sx(i), y1: 4, y2: H - bottom }));
      svg.appendChild(s("text", { class: "ro-ann ro-halo", x: flip ? sx(i) - 5 : sx(i) + 5, y: 11, "text-anchor": flip ? "end" : "start", text: a.text }));
    });
    const cat = spec.colors === "categorical";
    const lineCls = (i) => "ro-line " + (cat ? "ro-s" + (i + 1) : i === 0 ? "ro-line--em" : "ro-line--ctx");
    const keyCls = (i) => "ro-key-line " + (cat ? "ro-bg-" + (i + 1) : i === 0 ? "ro-bg-em" : "ro-bg-ctx");
    for (let i = ys.length - 1; i >= 0; i -= 1) { svg.appendChild(s("path", { class: lineCls(i), d: path(ys[i]) })); }
    let last = -1;
    rows.forEach((r, i) => { if (isNum(r[ys[0]])) { last = i; } });
    if (last >= 0) {
      svg.appendChild(s("circle", { class: "ro-dot" + (cat ? " ro-f1" : " ro-dot--em"), cx: sx(last), cy: sy(rows[last][ys[0]]), r: 4 }));
      const endText = f.format(rows[last][ys[0]], fm);
      const endW = textW(endText, env.S12, 500);
      const endY = Math.max(12, sy(rows[last][ys[0]]) - 10);
      svg.appendChild(s("rect", { class: "ro-patch", x: sx(last) - 10 - endW, y: endY - env.S12 + 1, width: endW + 6, height: env.S12 + 3, rx: 2 }));
      svg.appendChild(s("text", { class: "ro-val", x: sx(last) - 7, y: endY, "text-anchor": "end", text: endText }));
    }
    const cross = s("line", { class: "ro-cross", y1: top - 6, y2: H - bottom, visibility: "hidden" });
    svg.appendChild(cross);
    const dots = ys.map((c, i) => { const dot = s("circle", { class: "ro-dot" + (cat ? " ro-f" + (i + 1) : i === 0 ? " ro-dot--em" : ""), r: 4, visibility: "hidden" }); svg.appendChild(dot); return dot; });
    svg.appendChild(s("rect", { class: "ro-hit", x: 0, y: 0, width: plotW, height: H }));
    const points = rows.map((r, i) => {
      const tipRows = ys.map((c, k) => [labelOf(spec, c), withUnit(f.format(r[c], fm), isNum(r[c]) ? spec.unit : ""), keyCls(k)]);
      if (tcol) { tipRows.push([labelOf(spec, tcol), withUnit(f.format(r[tcol], fm), spec.unit), "ro-key-line ro-bg-target"]); }
      if (isNum(spec.target)) { tipRows.push([labelOf(spec, "target"), withUnit(f.format(spec.target, fm), spec.unit), "ro-key-line ro-bg-target"]); }
      if (band && isNum(r[band[0]])) { tipRows.push([labelOf(spec, "band"), f.format(r[band[0]], fm) + " to " + f.format(r[band[1]], fm), "ro-key-band"]); }
      return {
        cx: sx(i), cy: isNum(r[ys[0]]) ? sy(r[ys[0]]) : H / 2, title: cats[i], rows: tipRows,
        onShow: () => { cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("visibility", "visible"); dots.forEach((dot, k) => { if (isNum(r[ys[k]])) { dot.setAttribute("cx", sx(i)); dot.setAttribute("cy", sy(r[ys[k]])); dot.setAttribute("visibility", "visible"); } else { dot.setAttribute("visibility", "hidden"); } }); },
        onHide: () => { cross.setAttribute("visibility", "hidden"); dots.forEach((dot) => dot.setAttribute("visibility", "hidden")); }
      };
    });
    const legend = [];
    if (ys.length > 1 || band || tcol || isNum(spec.target)) {
      ys.forEach((c, i) => legend.push({ cls: keyCls(i), label: labelOf(spec, c) }));
      if (tcol || isNum(spec.target)) { legend.push({ cls: "ro-key-line ro-bg-target", label: labelOf(spec, tcol || "target") }); }
      if (band) { legend.push({ cls: "ro-key-band", label: labelOf(spec, "band") }); }
    }
    const cols = [[spec.x, spec.xFormat || "text"]].concat(ys.map((c) => [c, fm]), tcol ? [[tcol, fm]] : [], band ? band.map((c, i) => [c, fm, labelOf(spec, "band") + (i ? ", high" : ", low")]) : []);
    return { svg: svg, points: points, legend: legend, cols: cols, locate: (x) => (n > 1 ? Math.max(0, Math.min(n - 1, Math.round(((x - 5) / (plotW - 10)) * (n - 1)))) : 0) };
  }

  function drawSpark(values) {
    const W = 88;
    const H = 28;
    const svg = s("svg", { class: "ro-spark", viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    if (values.length < 2) { return svg; }
    const lo = Math.min.apply(null, values);
    const hi = Math.max.apply(null, values);
    const sx = (i) => 3 + (i * (W - 8)) / (values.length - 1);
    const sy = (v) => 4 + (1 - (v - lo) / ((hi - lo) || 1)) * (H - 8);
    svg.appendChild(s("path", { class: "ro-line ro-line--spark", d: values.map((v, i) => (i ? "L" : "M") + sx(i).toFixed(1) + "," + sy(v).toFixed(1)).join("") }));
    svg.appendChild(s("circle", { class: "ro-dot ro-dot--em", cx: sx(values.length - 1), cy: sy(values[values.length - 1]), r: 3 }));
    return svg;
  }

  /* ---------- hover, focus and keyboard: one tooltip, the same details either way ---------- */
  function interactive(g, body) {
    const svg = g.svg;
    const pts = g.points;
    const tip = h("div", { class: "ro-tip", hidden: true });
    const live = h("div", { class: "ro-sr", "aria-live": "polite" });
    body.appendChild(tip);
    body.appendChild(live);
    let active = -1;
    function clear() {
      if (active < 0) { return; }
      const p = pts[active];
      if (p.node) { p.node.classList.remove("ro-is-active"); }
      if (p.onHide) { p.onHide(); }
      svg.classList.remove("ro-has-active");
      tip.hidden = true;
      active = -1;
    }
    function show(i, announce) {
      if (i === active || !pts[i]) { return; }
      clear();
      active = i;
      const p = pts[i];
      if (p.node) { p.node.classList.add("ro-is-active"); svg.classList.add("ro-has-active"); }
      if (p.onShow) { p.onShow(); }
      tip.textContent = "";
      tip.appendChild(h("div", { class: "ro-tip-title", text: p.title }));
      p.rows.forEach((r) => tip.appendChild(h("div", { class: "ro-tip-row" }, [h("span", { class: "ro-key" }, [r[2] ? h("i", { class: r[2] }) : null, r[0]]), h("b", { text: r[1] })])));
      tip.hidden = false;
      const W = body.clientWidth;
      const left = p.cx + 14 + tip.offsetWidth > W ? p.cx - 14 - tip.offsetWidth : p.cx + 14;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = Math.max(0, Math.min(svg.getBoundingClientRect().height - tip.offsetHeight, p.cy - tip.offsetHeight / 2)) + "px";
      if (announce) { live.textContent = p.title + ". " + p.rows.map((r) => r[0] + " " + r[1]).join(". "); }
    }
    svg.setAttribute("tabindex", "0");
    svg.addEventListener("pointermove", (ev) => {
      if (g.locate) { const box = svg.getBoundingClientRect(); show(g.locate(ev.clientX - box.left)); return; }
      const i = ev.target.getAttribute && ev.target.getAttribute("data-i");
      if (i != null) { show(+i); }
    });
    svg.addEventListener("pointerleave", clear);
    svg.addEventListener("blur", clear);
    svg.addEventListener("keydown", (ev) => {
      let i = active;
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { i = Math.min(pts.length - 1, active + 1); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { i = Math.max(0, active < 0 ? 0 : active - 1); }
      else if (ev.key === "Home") { i = 0; }
      else if (ev.key === "End") { i = pts.length - 1; }
      else if (ev.key === "Escape") { clear(); return; }
      else { return; }
      ev.preventDefault();
      show(i, true);
    });
  }

  /* ---------- tables ---------- */
  function drawTable(tv, t, env, sortState) {
    const f = env.fmt;
    const cols = tv.columns;
    let rows = t.rows.slice();
    const sort = sortState.key != null ? sortState : (typeof tv.sort === "string" ? { key: tv.sort.replace(/^-/, ""), desc: tv.sort.charAt(0) === "-" } : null);
    if (sort && t.cols.indexOf(sort.key) >= 0) { rows.sort(compare(sort.key, sort.desc)); }
    const total = rows.length;
    if (isNum(tv.limit)) { rows = rows.slice(0, tv.limit); }
    const numeric = (c) => !c.status && c.format && c.format !== "text" && c.format !== "date" && c.format !== "day" && c.format !== "month";
    let shown = false;
    const head = h("tr", null, cols.map((c) => {
      const on = !shown && sort && sort.key === c.field && !c.status;
      if (on) { shown = true; }
      const label = (c.label || words(c.field)) + (c.unit ? " (" + c.unit + ")" : "");
      const btn = h("button", { class: "ro-th-btn", type: "button", "data-sort": c.field }, [label, on ? icon(sort.desc ? "down" : "up") : null]);
      return h("th", { scope: "col", class: numeric(c) ? "ro-r" : null, "aria-sort": on ? (sort.desc ? "descending" : "ascending") : null }, btn);
    }));
    const body = rows.map((r) => h("tr", null, cols.map((c) => {
      const level = c.status ? statusOf(r[c.status.field || c.field], c.status) : null;
      if (c.status) { return h("td", null, level ? chip(level, statusLabel(level, c.status)) : h("span", { class: "ro-muted", text: (isObj(c.status.labels) && c.status.labels.normal) || "Normal" })); }
      return h("td", { class: (numeric(c) ? "ro-r" : "") + (c.mono ? " ro-mono" : "") || null, text: f.format(r[c.field], c.format || (isNum(r[c.field]) ? "int" : "text")) });
    })));
    const wrap = h("div", { class: "ro-tablewrap" }, h("table", { class: "ro-table" }, [h("thead", null, head), h("tbody", null, body)]));
    const out = h("div", null, [wrap]);
    if (total > rows.length) { out.appendChild(h("p", { class: "ro-table-cap", text: "Showing " + rows.length + " of " + f.format(total, "int") + " rows." })); }
    return out;
  }

  /* ---------- page pieces ---------- */
  function seg(label, options, current, pick) {
    const box = h("div", { class: "ro-seg", role: "group", "aria-label": label });
    options.forEach((o) => {
      box.appendChild(h("button", { type: "button", "aria-pressed": String(o[0] === current), text: o[1], onclick: (ev) => { Array.prototype.forEach.call(box.children, (b) => b.setAttribute("aria-pressed", String(b === ev.currentTarget))); pick(o[0]); } }));
    });
    return box;
  }
  const SWITCH = {
    theme: ["data-theme", "Theme", [[null, "Auto"], ["light", "Light"], ["dark", "Dark"]]],
    style: ["data-style", "Style", [["soft", "Soft"], ["mono", "Mono"]]],
    density: ["data-density", "Density", [["comfortable", "Comfortable"], ["compact", "Compact"]]],
    contrast: ["data-contrast", "Contrast", [[null, "Standard"], ["more", "More"]]]
  };
  function renderHeader(mount, P, state, rerender) {
    const m = P.meta;
    const f = P.fmt;
    mount.textContent = "";
    mount.classList.add("ro-header");
    const line = [];
    line.push(m.asOf ? "As of " + f.format(m.asOf, "date") : null, m.source ? "Source: " + m.source : null);
    mount.appendChild(h("div", { class: "ro-header-main" }, [
      m.eyebrow ? h("p", { class: "ro-eyebrow", text: m.eyebrow }) : null,
      h("h1", { class: "ro-h1", text: m.title || "Untitled" }),
      m.subtitle ? h("p", { class: "ro-sub", text: P.fill(m.subtitle) }) : null,
      line.filter(Boolean).length ? h("p", { class: "ro-meta", text: line.filter(Boolean).join(" " + CH.dot + " ") }) : null
    ]));
    const controls = h("div", { class: "ro-controls" });
    if (isObj(m.views) && Array.isArray(m.views.options)) {
      controls.appendChild(seg(m.views.label || "View", [[null, m.views.all || "All"]].concat(m.views.options.map((o) => [o, String(o)])), state.view, (v) => { state.view = v; rerender(); }));
    }
    list(m.switches).forEach((name) => {
      const sw = SWITCH[name];
      if (!sw) { return; }
      controls.appendChild(seg(sw[1], sw[2], doc.documentElement.getAttribute(sw[0]), (v) => { if (v === null) { doc.documentElement.removeAttribute(sw[0]); } else { doc.documentElement.setAttribute(sw[0], v); } rerender(); }));
    });
    if (controls.children.length) { mount.appendChild(controls); }
  }
  function renderKpi(mount, id, P) {
    const k = P.kpis[id];
    const f = P.fmt;
    mount.textContent = "";
    mount.className = "ro-kpi";
    if (!k) { mount.appendChild(empty("No entry for \"" + id + "\" in kpis.")); return; }
    const spec = k.spec;
    const fm = spec.format || "int";
    if (spec.hero === true) { mount.classList.add("ro-kpi--hero"); }
    const level = statusOf(k.value, spec.status);
    mount.appendChild(h("div", { class: "ro-kpi-top" }, [h("span", { class: "ro-kpi-label", text: spec.label }), level ? chip(level, statusLabel(level, spec.status)) : null]));
    mount.appendChild(h("div", { class: "ro-kpi-value" }, [f.format(k.value, fm), spec.unit ? h("span", { class: "ro-kpi-unit", text: spec.unit }) : null]));
    if (spec.detail) { mount.appendChild(h("div", { class: "ro-kpi-detail", text: f.format(k.detail, spec.detail.format || "int") + " " + P.fill(spec.detail.text) })); }
    const foot = h("div", { class: "ro-kpi-foot" });
    if (spec.delta && isNum(k.value) && isNum(k.from)) {
      const d = k.value - k.from;
      const dir = d > 0 ? "up" : d < 0 ? "down" : "flat";
      const good = spec.delta.good;
      const tone = dir === "flat" || !good || good === "none" ? "" : dir === good ? " ro-delta--good" : " ro-delta--bad";
      const said = tone === " ro-delta--good" ? ", better" : tone === " ro-delta--bad" ? ", worse" : "";
      foot.appendChild(h("span", { class: "ro-delta" + tone, "aria-label": (dir === "flat" ? "No change " : dir === "up" ? "Up " : "Down ") + f.format(Math.abs(d), spec.delta.format || fm) + " " + spec.delta.label + said }, [icon(dir), f.format(d, spec.delta.format || fm, true), h("span", { class: "ro-delta-label", text: spec.delta.label })]));
    } else { foot.appendChild(h("span")); }
    if (k.spark && k.spark.length > 1) { foot.appendChild(drawSpark(k.spark)); }
    if (foot.children.length > 1 || foot.firstChild.childNodes.length) { mount.appendChild(foot); }
  }
  function renderCard(mount, id, P, state) {
    const c = P.cards[id];
    const f = P.fmt;
    mount.textContent = "";
    mount.classList.add("ro-card");
    if (!c) { mount.appendChild(empty("No entry for \"" + id + "\" in cards.")); return; }
    const spec = c.spec;
    const chart = isObj(spec.chart) ? spec.chart : null;
    const toggle = chart && c.ok ? h("button", { class: "ro-iconbtn", type: "button", "aria-pressed": String(!!state.tableOn[id]), onclick: () => { state.tableOn[id] = !state.tableOn[id]; renderCard(mount, id, P, state); mount.querySelector(".ro-iconbtn").focus(); } }, [icon(state.tableOn[id] ? "chart" : "table"), state.tableOn[id] ? "Chart" : "Table"]) : null;
    mount.appendChild(h("div", { class: "ro-card-head" }, [h("div", null, [h("h2", { class: "ro-card-title", text: P.fill(viewText(spec.title, state.view)) || "Untitled" }), spec.subtitle ? h("p", { class: "ro-card-sub", text: P.fill(spec.subtitle) }) : null]), toggle]));
    const body = h("div", { class: "ro-card-body" });
    const legendBox = h("div", { class: "ro-legend" });
    mount.appendChild(body);
    mount.appendChild(legendBox);
    if (spec.note) { mount.appendChild(h("p", { class: "ro-card-note", text: P.fill(viewText(spec.note, state.view)) })); }
    const src = spec.source || P.meta.source;
    const asOf = spec.asOf || P.meta.asOf;
    mount.appendChild(h("p", { class: "ro-card-foot" }, [src ? "Source: " + src : h("span", { class: "ro-missing", text: "Source not stated" }), " " + CH.dot + " ", asOf ? "As of " + f.format(asOf, "date") : h("span", { class: "ro-missing", text: "As-of time not stated" })]));
    const draw = () => {
      body.textContent = "";
      legendBox.textContent = "";
      legendBox.hidden = true;
      if (!c.ok) { body.appendChild(empty("This card has a problem. See the list at the top of the page.")); return; }
      const src2 = chart || spec.table;
      const t = P.eng.table(src2.data);
      if (!t || !t.rows.length) { body.appendChild(empty("No data for this view.")); return; }
      const sortState = state.sort[id] || {};
      if (!chart) {
        const tb = drawTable(spec.table, t, { fmt: f }, sortState);
        tb.addEventListener("click", (ev) => { const b = ev.target.closest && ev.target.closest("[data-sort]"); if (!b) { return; } const key = b.getAttribute("data-sort"); const cur = state.sort[id]; state.sort[id] = { key: key, desc: cur && cur.key === key ? !cur.desc : true }; draw(); const again = body.querySelector("[data-sort=\"" + key + "\"]"); if (again) { again.focus(); } });
        body.appendChild(tb);
        return;
      }
      const W = Math.floor(body.clientWidth);
      if (W < 40) { return; }
      const env = { W: W, fmt: f, compact: doc.documentElement.getAttribute("data-density") === "compact", S11: px("--ro-size-11"), S12: px("--ro-size-12"), chartH: px("--ro-chart-h"), label: P.fill(viewText(spec.title, state.view)) + (spec.subtitle ? ". " + P.fill(spec.subtitle) : "") + ". Use the arrow keys to read values, or switch to the table." };
      let rows = t.rows;
      if (chart.type === "pareto" || (chart.type === "bar" && (chart.sort === "desc" || chart.sort === "asc"))) { rows = rows.filter((r) => !r._other).sort(compare(chart.y, chart.type === "pareto" || chart.sort === "desc")).concat(rows.filter((r) => r._other)); }
      const g = chart.type === "line" ? drawLine(chart, rows, env) : chart.type === "histogram" ? drawBarV(chart, rows, env, true) : chart.type === "pareto" ? drawBarH(chart, rows, env, true) : chart.orient === "v" ? drawBarV(chart, rows, env, false) : drawBarH(chart, rows, env, false);
      if (state.tableOn[id]) {
        const cols = g.cols.map((x) => ({ field: x[0], label: x[2] || labelOf(chart, x[0]), format: x[1] }));
        if (chart.type === "pareto") { const total = sum(rows.map((r) => (isNum(r[chart.y]) ? r[chart.y] : 0))); let run = 0; rows = rows.map((r) => { run += isNum(r[chart.y]) ? r[chart.y] : 0; return Object.assign({}, r, { _share: total ? run / total : 0 }); }); cols.push({ field: "_share", label: "Cumulative", format: "pct0" }); }
        body.appendChild(drawTable({ columns: cols }, { cols: t.cols.concat(["_share"]), rows: rows }, { fmt: f }, {}));
        return;
      }
      body.appendChild(g.svg);
      interactive(g, body);
      g.legend.forEach((k) => legendBox.appendChild(h("span", { class: "ro-key" }, [k.icon ? icon(k.icon, "ro-ico--" + k.icon) : h("i", { class: k.cls }), k.label])));
      legendBox.hidden = !g.legend.length;
    };
    state.redraw[id] = { body: body, draw: draw, width: 0 };
    draw();
  }
  function renderFooter(mount, P, cfg) {
    const f = P.fmt;
    mount.textContent = "";
    mount.classList.add("ro-footer");
    const rows = list(P.meta.method).map((x) => [String(x[0]), String(x[1]), false]);
    const derive = isObj(cfg.derive) ? cfg.derive : {};
    Object.keys(derive).forEach((n) => { if (isObj(derive[n].add)) { Object.keys(derive[n].add).forEach((k) => rows.push([words(k), exprText(derive[n].add[k]), true])); } });
    if (rows.length) {
      const dl = h("dl");
      rows.forEach((r) => { dl.appendChild(h("dt", { text: r[0] })); dl.appendChild(h("dd", null, r[2] ? h("code", { text: r[1] }) : r[1])); });
      mount.appendChild(h("details", { class: "ro-method" }, [h("summary", { text: "Method and assumptions" }), dl]));
    }
    const notes = P.diag.items.filter((x) => x.level === "note");
    if (notes.length) {
      mount.appendChild(h("details", { class: "ro-notes" }, [h("summary", { text: notes.length + " review note" + (notes.length > 1 ? "s" : "") }), h("ol", null, notes.map((x) => h("li", { text: "[" + x.code + "] " + x.path + ": " + x.msg })))]));
    }
    const bits = [P.meta.marking ? String(P.meta.marking) : null, P.meta.source ? "Source: " + P.meta.source : null, P.meta.asOf ? "As of " + f.format(P.meta.asOf, "date") : null, "Readout " + VERSION];
    mount.appendChild(h("p", { text: bits.filter(Boolean).join(" " + CH.dot + " ") }));
  }
  function showErrors(page, after, items) {
    const old = doc.querySelector(".ro-diag");
    if (old) { old.remove(); }
    if (!items.length) { return; }
    const box = h("section", { class: "ro-diag", role: "alert" }, [h("h2", { text: "Readout found " + items.length + " problem" + (items.length > 1 ? "s" : "") }), h("ol", null, items.map((x) => h("li", { text: "[" + x.code + "] " + x.path + ": " + x.msg })))]);
    if (after && after.parentNode === page) { page.insertBefore(box, after.nextSibling); } else { page.insertBefore(box, page.firstChild); }
  }

  /* ---------- a brand overlay is checked in the page, so no other tool is needed ---------- */
  function parseColour(v) {
    const t = String(v).trim();
    let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
    if (m) { const x = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]; return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(t);
    return m ? [m[1] / 255, m[2] / 255, m[3] / 255] : null;
  }
  function luminance(c) { const l = c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
  function brandCheck(diag) {
    if (!doc.querySelector("style[data-readout-brand]")) { return; }
    const cs = root.getComputedStyle(doc.documentElement);
    const tok = (k) => parseColour(cs.getPropertyValue("--ro-" + k));
    const need = (fg, bgs, min) => bgs.forEach((bg) => {
      const a = tok(fg);
      const b = tok(bg);
      if (!a || !b) { diag.error("B02", "brand overlay", "--ro-" + (a ? bg : fg) + " must be a hex colour so it can be checked"); return; }
      const x = luminance(a);
      const y = luminance(b);
      const c = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      if (c < min) { diag.error("A01", "brand overlay", fg + " on " + bg + " is " + c.toFixed(2) + ":1 in this theme. It needs " + min + ":1."); }
    });
    ["text", "_text-2", "_text-3"].forEach((fg) => need(fg, ["page", "card", "fill", "raised"], 4.5));
    need("accent-text", ["page", "card", "accent-soft"], 4.5);
    need("on-accent", ["accent"], 4.5);
    need("on-marking", ["marking"], 4.5);
    need("border-strong", ["page", "card"], 3);
    need("accent", ["page", "card"], 3);
    need("emphasis", ["card"], 3);
    need("neutral", ["card"], 3);
  }

  /* ---------- start ---------- */
  function boot() {
    const el = doc.getElementById("readout-data");
    const ids = (attr) => Array.prototype.map.call(doc.querySelectorAll("[" + attr + "]"), (m) => m.getAttribute(attr));
    /* What the author wrote sits between the two layout markers. A host such as an artifact viewer may add
       scripts and styles of its own elsewhere in the document, and those are not the author's to answer for. */
    const authored = [];
    const walker = doc.createTreeWalker(doc.documentElement, 128);
    let from = null;
    let to = null;
    /* The marker text is joined here, never written whole, so that a search of the page for its markers finds only the markers and not this line. */
    const MARK = ["readout", "layout", ""].join(":");
    while (walker.nextNode()) { const mark = walker.currentNode.nodeValue.trim(); if (mark === MARK + "start") { from = walker.currentNode; } else if (mark === MARK + "end") { to = walker.currentNode; } }
    for (let node = from && to ? from.nextSibling : null; node && node !== to; node = node.nextSibling) { if (node.nodeType === 1) { authored.push(node); } }
    const countIn = (sel) => authored.reduce((a, node) => a + (node.matches(sel) ? 1 : 0) + node.querySelectorAll(sel).length, 0);
    const mounts = { kpis: ids("data-kpi"), cards: ids("data-card"), extraScripts: countIn("script:not([type=\"application/json\"]):not([type=\"text/csv\"])"), rawStyles: countIn("[style]") };
    let page = doc.querySelector(".ro-page");
    if (!page) { page = doc.body; }
    /* A page published without its own html line (the artifact form) carries its look on the page element instead. */
    ["data-style", "data-theme", "data-density", "data-contrast"].forEach((a) => { const v = page.getAttribute(a); if (v && !doc.documentElement.hasAttribute(a)) { doc.documentElement.setAttribute(a, v); } });
    let cfg = null;
    let parseError = el ? null : "there is no element with id readout-data";
    if (el) { try { cfg = JSON.parse(el.textContent); } catch (e) { parseError = e.message + ". Look for a trailing comma, a missing quote, or a raw < inside a string."; } }
    if (parseError) { showErrors(page, null, [{ code: "D01", path: "data block", msg: parseError }]); page.setAttribute("data-readout-result", "1 error(s), 0 note(s)"); return; }
    const state = { view: null, tableOn: {}, sort: {}, redraw: {} };
    let header = doc.querySelector("[data-header]");
    if (!header) { header = h("header", { "data-header": "" }); page.insertBefore(header, page.firstChild); }
    let footer = doc.querySelector("[data-footer]");
    if (!footer) { footer = h("footer", { "data-footer": "" }); page.appendChild(footer); }
    const lang = doc.documentElement.getAttribute("lang") || page.getAttribute("lang");
    const csv = {};
    Array.prototype.forEach.call(doc.querySelectorAll("script[type=\"text/csv\"][data-table]"), (c) => { csv[c.getAttribute("data-table")] = c.textContent; });
    function content() {
      const P = prepare(cfg, mounts, state.view, lang, csv);
      state.P = P;
      state.redraw = {};
      const guard = (mount, path, fn) => { try { fn(); } catch (e) { mount.textContent = ""; mount.appendChild(empty("Could not draw this. " + e.message)); P.diag.error("D00", path, "could not be drawn: " + e.message); } };
      Array.prototype.forEach.call(doc.querySelectorAll("[data-kpi]"), (m) => guard(m, "kpis." + m.getAttribute("data-kpi"), () => renderKpi(m, m.getAttribute("data-kpi"), P)));
      Array.prototype.forEach.call(doc.querySelectorAll("[data-card]"), (m) => guard(m, "cards." + m.getAttribute("data-card"), () => renderCard(m, m.getAttribute("data-card"), P, state)));
      brandCheck(P.diag);
      guard(footer, "footer", () => renderFooter(footer, P, cfg));
      const errors = P.diag.items.filter((x) => x.level === "error");
      showErrors(page, header, errors);
      root.Readout.diagnostics = P.diag.items;
      /* A plain-text result on the page element, so a tool that can only read the finished page still gets the verdict. */
      page.setAttribute("data-readout-result", errors.length + " error(s), " + (P.diag.items.length - errors.length) + " note(s)");
      return P;
    }
    root.Readout = Object.assign({ diagnostics: [] }, core);
    const first = prepare(cfg, mounts, null, lang, csv);
    if (first.meta.title) { doc.title = String(first.meta.title); }
    if (first.meta.marking && !doc.querySelector(".ro-marking")) { doc.body.insertBefore(h("div", { class: "ro-marking", text: String(first.meta.marking) }), doc.body.firstChild); }
    renderHeader(header, first, state, content);
    content();
    let queued = false;
    const resized = () => {
      if (queued) { return; }
      queued = true;
      root.requestAnimationFrame(() => { queued = false; Object.keys(state.redraw).forEach((id) => { const r = state.redraw[id]; const w = Math.floor(r.body.clientWidth); if (w !== r.width) { r.width = w; r.draw(); } }); });
    };
    Object.keys(state.redraw).forEach((id) => { state.redraw[id].width = Math.floor(state.redraw[id].body.clientWidth); });
    root.addEventListener("resize", resized);
    if (root.ResizeObserver) { new root.ResizeObserver(resized).observe(page); }
    root.addEventListener("beforeprint", () => { Array.prototype.forEach.call(doc.querySelectorAll("details.ro-method"), (d) => { d.open = true; }); });
  }
  if (doc.readyState === "loading") { doc.addEventListener("DOMContentLoaded", boot); } else { boot(); }
}(typeof window !== "undefined" ? window : globalThis));
