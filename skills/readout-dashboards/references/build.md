# Building a page: the whole contract

Read this once before you edit a page. Fields marked `*` are required. Anything not listed here does not exist, and the page will say so.

## 1. The two regions

A page is `assets/starter.html` with two regions rewritten: the layout and the data. Everything else in it is generated, in lines tens of thousands of characters long: never print, read or edit those. Write each region as a small file of your own, then assemble the page:

```
cp assets/starter.html page.html     # once
{ sed -n -e 's|^<title>.*|<title>Orders</title>|' -e '1,/^<!-- readout:layout:start/p' page.html
  cat page.layout.html; printf '\n%s\n' '<!-- readout:layout:end -->' '<!-- readout:data:start -->'
  echo '<script type="application/json" id="readout-data">'; cat page.data.json; printf '\n</script>\n'
  echo '<script type="text/csv" data-table="tickets">'; cat tickets.csv; printf '\n</script>\n'   # one line per CSV file, or none
  sed -n '/^<!-- readout:data:end/,$p' page.html
} > page.tmp && mv page.tmp page.html
```

Run it again after every change: your two files are the source, not the page. Anything you set above the layout marker (theme attributes on line 2, a brand block) is kept. To change an existing page, or to start from the example, take its regions out first:

```
sed -n '/^<!-- readout:layout:start/,/^<!-- readout:layout:end/p' page.html | sed '1d;$d' > page.layout.html
sed -n '/^<script type="application\/json"/,/^<\/script>/p' page.html | sed '1d;$d' > page.data.json
```

With no shell, copy the starter with your file tools, search the copy for `^<!-- readout:` to find the marker lines, read only those line ranges, and edit between the markers. Set the `<title>` on line 7 too.

**Layout region.** Where things go. It holds no numbers.

```html
<div class="ro-page">
  <header data-header></header>
  <section class="ro-kpis" aria-label="Key figures">
    <div data-kpi="latest"></div>
    <div data-kpi="attain"></div>
    <div data-kpi="total"></div>
  </section>
  <section class="ro-grid">
    <article data-card="trend" class="ro-span-8"></article>
    <article data-card="byRegion" class="ro-span-4"></article>
    <article data-card="detail"></article>
  </section>
  <footer data-footer></footer>
</div>
```

- `data-kpi="id"` and `data-card="id"` are mounts. Each needs an entry with the same id in the data block. Leave nothing between a mount's tags.
- Cards sit on a 12-column grid. `ro-span-3` to `ro-span-9` set a card's width and no class means full width. Make each row add to 12. Narrow screens stack the cards for you.
- Order carries the argument: tiles, then the trend, then the breakdown, then the detail table.
- `data-header` draws the title block and switches. `data-footer` draws the Method panel and review notes. Both are added if you leave them out.
- For anything the mounts cannot draw, add a custom card: see `design-system.md`.

**Data block region.** One JSON object with these keys, plus `facts` (section 4).

```json
{
  "meta":   { "title": "Orders", "asOf": "2026-01-31", "source": "Order system export" },
  "data":   { "monthly": { "cols": ["month", "orders"], "rows": [["2025-12", 502], ["2026-01", 529]] } },
  "derive": { "byRegion": { "from": "orders", "group": "region", "agg": { "orders": ["sum", "qty"] } } },
  "kpis":   { "latest": { "label": "Orders this month", "value": ["last", "monthly.orders"], "unit": "orders" } },
  "cards":  { "trend": { "title": "Orders rose for the third month", "chart": { "type": "line", "data": "monthly", "x": "month", "y": "orders" } } }
}
```

Strict JSON: double quotes, no trailing commas, no comments. Inside a string write `<` as `\u003c`. A key that starts with `_` is ignored, so `"_note": "..."` works as a comment.

## 2. meta

<!-- fields:meta -->
- `title`* (text): Page title: what this page is about.
- `subtitle` (text): One line: scope and period.
- `eyebrow` (text): Small label above the title, such as an area or team.
- `asOf` (text): When the data was current. ISO date or date-time. Shown on every card.
- `source` (text): Where the data came from. Shown on every card.
- `marking` (text): Banner text, such as Synthetic data, Draft or Internal.
- `locale` (text): Locale for numbers and dates. Default en, which writes Jan 31, 2026. Use en-GB or en-AU for 31 Jan 2026.
- `currency` (text): ISO 4217 code for currency formats. Default USD.
- `views` (views object): One page-wide switch over a column.
- `switches` (list of: theme, style, density, contrast): Viewer controls to show in the header.
- `method` (list of pairs): Rows for the Method panel: [[term, explanation], ...]. Derived columns are added automatically.

`views`, one page-wide switch that filters every pipeline that opts in:

<!-- fields:views -->
- `field`* (text): Column the switch filters. A pipeline opts in with where: {column: "$view"}.
- `options`* (list of text): Values to offer, in order.
- `label` (text): Name of the control, such as Line.
- `all` (text): Label for the unfiltered choice. Default All.

## 3. Data tables

`"data": { "name": { "cols": ["a", "b"], "rows": [["x", 1], ["y", 2]] } }`

- One array per row, in column order. Numbers as numbers, not text. Dates as ISO text: `2026-01-31`, `2026-01` or `2026-01-31T17:00+11:00`.
- Embed the rows you were given, or the output of a real computation. Do not retype figures from memory and do not do arithmetic in your head. Let the page derive (next section).
- A few hundred rows is comfortable. Aggregate anything bigger first with a real tool and say so in `meta.method`.

**A CSV export goes in as it is.** Do not retype it as JSON. It sits in a block of its own in the data region, beside the JSON block, with the file's text unchanged. The assembly command in section 1 puts it there with `cat`, so that no row is copied by hand:

```html
<script type="text/csv" data-table="tickets">
id,opened,team,status,hours
T-4001,2026-01-05,Billing,Closed,2.5
</script>
```

The first line names the columns. Numbers are read as numbers, empty cells as missing, the rest as text. The table then works like any other (`"from": "tickets"`), and `data` can be left out when every table comes from a CSV block.

## 4. Deriving numbers

A pipeline makes a new table from an existing one. Its steps always run in this order, however you write them: `where`, `add`, `group` or `bin`, `sort`, `top`, `cum`. When you need another order, such as a ratio of two sums, chain a second pipeline with `from` set to the first.

<!-- fields:derive -->
- `from`* (table): Source table: a data table or another derived table.
- `where` (object): Keep rows where column equals a value, is in a list, or matches "$view".
- `add` (object): New columns from row arithmetic, such as {"excess": ["pos", ["sub", "wip", "target"]]}. Operations are listed below.
- `group` (column or list of columns): One row per distinct value. With no agg, each row gets a count.
- `agg` (object): Aggregates per group or bin, such as {"units": ["sum", "qty"]}.
- `bin` (column): Bin this numeric column. Needs step. Adds bin, lo, hi and count.
- `step` (number): Bin width.
- `sort` (text): Column to sort by. Prefix with - for descending.
- `top` (number): Keep this many rows and fold the rest into one Other row.
- `other` (text): Label for the folded row. Default Other.
- `cum` (column): Adds running total, share and cumulative share for this column.

**Row operations** for `add` are lists, innermost first: `["div", ["sub", "actual", "plan"], "plan"]`. Operands are column names or numbers, and a bare number is itself a valid value (`"target": 4` adds a constant column).
- Arithmetic: `add` `sub` `mul` `div` `min` `max` `abs` `neg`, `round` (value, places), `pos` (zero when negative). Dividing by zero gives no value, shown as n/a.
- Comparisons, giving 1 or 0: `gt` `gte` `lt` `lte` on numbers, and `["is", "status", "Open"]` to match a column against text or a number. Sum a 0 or 1 column to count matches: `["mul", "qty", ["gte", "age", 30]]` keeps quantity only where age is 30 or more.
- Dates, on an ISO date column: `["week", "opened"]` gives the Monday of its week, `["month", "opened"]` gives `2026-01`, `["age", "opened"]` gives whole days from that date to `meta.asOf`, and `["until", "due"]` gives whole days from `meta.asOf` to that date. Group by a week or month column to build a trend from raw rows.
- Formulas run in the order written, so one can use a column that an earlier one made. A blank cell stays blank through arithmetic and comparisons (no value, not 0), and `is` gives 0 for it.

**Aggregates** for `agg` and for scalars: `sum` `mean` `median` `min` `max` need a numeric column and skip its blanks, so a mean divides by the rows that have a value. `min` and `max` also take a column of ISO dates, as the earliest and the latest. `count` counts the values present in a column of any type, and `["count"]` in `agg` or `["count", "table"]` as a scalar counts rows. `first` `last` `prev` (the one before last) take whatever is there.

**A scalar** is one number, used by KPI tiles: `["sum", "table.column"]`, `["count", "table"]`, a bare number, or arithmetic on scalars such as `["div", ["sum", "t.late"], ["count", "t"]]`.

Notes. `group` gives one row per distinct value in first-seen order, so sort if order matters. `bin` gives `bin`, `lo`, `hi`, `count` and any `agg`: a value sits in the bin where lo <= value < hi. `top` folds the remaining rows into one Other row by adding their numeric columns, so fold sums and counts, never ratios. `cum: "x"` adds `xCum`, `xShare` and `xCumShare`. Every `add` formula is printed for the reader in the Method panel.

**Facts** are named figures that text can quote, so a title never holds a typed number and stays true when the data changes:

```json
"facts": { "open": { "value": ["count", "openTickets"] }, "worst": { "value": ["first", "byTeamSorted.team"] } },
"cards": { "byTeam": { "title": "{worst} holds the most of the {open} open tickets", "...": "..." } }
```

<!-- fields:fact -->
- `value`* (scalar): A scalar. first, last, min and max may also pick text or a date, such as the top row's name.
- `format` (format): Number format, or date, day or month for a date. Default int.

`{name}` works in a card's `title`, `subtitle` and `note`, in a tile's `detail.text` and in `meta.subtitle`. Facts follow the view switch.

## 5. KPI tiles

<!-- fields:kpi -->
- `label`* (text): What the number is. Sentence case, no colon.
- `value`* (scalar): A scalar such as ["sum", "stages.excess"].
- `format` (format): Number format. Default int.
- `unit` (text): Unit shown after the value, such as units or days.
- `hero` (bool): The one number the page leads with. At most one.
- `detail` (detail object): A computed second line, such as a share of the whole.
- `delta` (delta object): Change against a named comparison.
- `spark` (spark object): A small trend line.
- `status` (status object): Thresholds on the value. Shows a labelled status chip.

`detail`:
<!-- fields:detail -->
- `value`* (scalar): A scalar.
- `format` (format): Number format. Default int.
- `text`* (text): Words after the number, such as of all WIP.

`delta`:
<!-- fields:delta -->
- `from`* (scalar): The comparison value. The change shown is value minus from.
- `label`* (text): What it is compared with, such as vs last week.
- `format` (format): Default: the tile's format.
- `good` (up or down or none): Which direction is good. Default none (shown neutral).

`spark`:
<!-- fields:spark -->
- `data`* (table): Table holding the trend.
- `y`* (column): Column to draw, in row order.

`status`, used by tiles, bars, histograms and table columns. A level applies when the value is at or past its threshold, or only past it with `strict`. It always shows a shape and your words as well as a colour:
<!-- fields:status -->
- `field` (column): Column to test. Default: the bar's value, or a histogram's bin start. Omit on a KPI tile.
- `warning` (number): Threshold for warning.
- `serious` (number): Threshold for serious.
- `critical` (number): Threshold for critical.
- `direction` (above or below): Whether values above or below a threshold trigger it. Default above.
- `strict` (bool): true: a level applies only past its threshold, not at it. Default false (at or past).
- `labels` (object): Words for each level used, such as {"warning": "Above target band"}. In a table column, normal names the rest.

## 6. Cards and charts

<!-- fields:card -->
- `title`* (text or view map): States the finding, not the measure. With a view switch, give {"*": default, "view value": text}.
- `subtitle` (text): Measure, unit and period.
- `chart` (chart object): A chart. Give chart or table, not both.
- `table` (tableView object): A table. Give chart or table, not both.
- `note` (text or view map): One line of context under the chart.
- `source` (text): Overrides meta.source for this card.
- `asOf` (text): Overrides meta.asOf for this card.

Pick the chart by the job. There are four types, and no others.

**bar**: compare categories. Add `target` for actual against target.
<!-- fields:bar -->
- `type`* (bar): Compare categories, or actual against target.
- `data`* (table): Table to draw.
- `x`* (column): Category column.
- `y`* (column): Value column. Bars always start at zero.
- `orient` (h or v): h (default) for categories, v for time buckets.
- `xFormat` (format): Format for x values, such as day or month. Default text.
- `target` (column or number): Target, drawn as a tick on each bar: a column, or one number for every bar.
- `band` ([column, column]): [low column, high column] drawn as a shaded range behind each bar.
- `highlight` (any): Category or list of categories to draw in the accent, or max or min.
- `status` (status object): Thresholds that colour bars and add a shape and a legend.
- `sort` (none or desc or asc): Default none, which keeps row order.
- `format` (format): Number format. Default int.
- `unit` (text): Unit shown in tooltips.
- `labels` (object): Display names for columns, such as {"wip": "WIP"}. Use the keys band and target to name those marks.

**line**: change over time.
<!-- fields:line -->
- `type`* (line): Change over time.
- `data`* (table): Table to draw, rows in time order.
- `x`* (column): Time or sequence column.
- `y`* (column or list of columns): One to four value columns. The first is emphasised.
- `band` ([column, column]): [low column, high column] drawn as a shaded range.
- `target` (column or number): A reference line.
- `zero` (bool): Force the value axis to include zero.
- `colors` (emphasis or categorical): emphasis (default): first series accent, others grey. categorical: one hue each.
- `annotate` (list): Marked moments: [{"x": value, "text": "words"}].
- `xFormat` (format): Format for x values. Default text.
- `format` (format): Number format. Default int.
- `unit` (text): Unit shown in tooltips.
- `labels` (object): Display names for columns. Use the keys band and target to name those marks.

**histogram**: the shape of a spread. Make its table with a `bin` pipeline.
<!-- fields:histogram -->
- `type`* (histogram): Shape of a distribution. Feed it a bin pipeline.
- `data`* (table): A table made with bin.
- `x`* (column): Bin start column. Use lo.
- `y`* (column): Count column. Use count.
- `refs` (list): Vertical markers: [{"x": number, "label": "words"}].
- `status` (status object): Thresholds on the bin start that colour bins.
- `xFormat` (format): Format for bin edges. Default int.
- `format` (format): Number format for counts. Default int.
- `unit` (text): Unit of the counted thing, shown in tooltips.
- `xUnit` (text): Unit of the binned measure, such as days.
- `labels` (object): Display names for columns. The key bin names the bins in the table view.

**pareto**: the few contributors that make up most of a total. Bars are sorted for you and the cumulative share is printed beside them.
<!-- fields:pareto -->
- `type`* (pareto): Which few contributors make up most of a total.
- `data`* (table): Table to draw. Sorted for you, largest first.
- `x`* (column): Contributor column.
- `y`* (column): Value column.
- `cut` (number): Share at which to draw the cut line. Default 0.8.
- `format` (format): Number format. Default int.
- `unit` (text): Unit shown in tooltips.
- `labels` (object): Display names for columns.

Bars are neutral grey unless you set `highlight` or `status`. That is deliberate: colour is kept for the thing that needs attention. Every chart gets a tooltip, keyboard reading and a Table button without any configuration. `labels` names any column a chart uses, the x column included, wherever it is shown: legend, tooltip and table view.

## 7. Tables

A card with `table` instead of `chart`:
<!-- fields:tableView -->
- `data`* (table): Table to show.
- `columns`* (list of column objects): Columns to show, in order.
- `sort` (text): Starting sort column. Prefix with - for descending.
- `limit` (number): Rows to show. A caption states how many were left out.

Each column:
<!-- fields:column -->
- `field`* (column): Column to show.
- `label` (text): Header text. Default: the column name in words.
- `format` (format): Number format. Numbers align right.
- `unit` (text): Unit added to the header in brackets.
- `mono` (bool): Monospace, for identifiers.
- `status` (status object): Show a labelled status chip instead of the number.

Readers can sort by any column. Use a pipeline to choose and order rows, and `limit` to cap them.

## 8. Formats

<!-- formats -->
`int` 1,284 | `dec1` 1,284.5 | `dec2` 1,284.50 | `pct0` 18% (value 0.18) | `pct1` 18.4% (value 0.184) | `cur0` $1,284 (currency from meta.currency) | `cur2` $1,284.50 | `compact` 1.3K | `curCompact` $1.3M | `days0` 12 d | `days1` 12.5 d | `x1` 1.4x | `date` 20 Nov 2026 (value 2026-11-20) | `day` 20 Nov | `month` Nov 2026 | `text` as written

Percent formats expect a fraction (0.18 shows as 18%). Put the unit in `unit`, not in the label.

## 9. Titles that change with the view

With `meta.views`, a finding that is true for all lines may be false for one. Give `title` (and `note`) as a map from view value to text, with `*` as the default: `"title": { "*": "Test and Integrate hold most of the excess", "Line 1": "Line 1 is within its target band" }`.

## 10. Pages that are refreshed

A page is a snapshot. To refresh one, replace the rows (the CSV file, or the `rows` of a table), change `meta.asOf` and assemble again. Everything derived in the page follows. Two things do not: a table that was aggregated before it was embedded, and any title written as a fixed sentence. For a page that will be refreshed, derive in the page and write titles with facts. Every `age` is counted to `asOf`, so a stale `asOf` makes them all wrong: the page raises note `N11` when a row is dated after it. Tell the user in your handover which parts, if any, will not update.

`meta.title` becomes the browser tab title when the page runs. The `<title>` element is what a file listing or an artifact gallery shows, which is why the assembly command sets it.

## 11. When the page reports a problem

`node scripts/check.js page.html` prints what the page itself shows when opened. Errors appear in a red panel at the top and stop only the piece concerned. Notes collect in the footer as "review notes", where the reader sees them too: clear each one, or be ready to say why it stays. A page with nothing to report shows neither.

Without node, any Chromium browser (Chrome, Edge) runs the page from the command line and prints the same messages. This is the macOS path. Elsewhere the program is `google-chrome`, `chromium`, `chrome.exe` or `msedge.exe`:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --dump-dom "file://$PWD/page.html" | grep -oE 'data-readout-result="[^"]*"|<li>\[[A-Z][0-9]{2}\][^<]*'
```

The verdict comes first, such as `data-readout-result="0 error(s), 1 note(s)"`, then each message. No verdict at all means the script did not run, so a generated line was damaged: copy the starter again and reassemble. Add `--screenshot=page.png --window-size=1440,2400` in place of `--dump-dom` to look at the page. In a browser tool that runs script, `window.Readout.diagnostics` is the same list as data.

- `D01` the data block is not valid JSON. `D02` a mount and an entry do not match. `D03` something required is missing. `D04` a table or column name is wrong: the message lists the real ones. `D05` an unknown field, format, operation or chart type: the message lists what exists. `D06` values are the wrong shape.
- A code with a letter and two digits that is not `D` (such as `C07`, `V03`, `V04`, `N02`, `L03`) cites a design rule: look it up in `rules.md`.
- Fix the data block or layout. Never edit the generated style or script to make a message go away: the page will stop running.
