# Pattern: flow and work in progress

For pages about work moving through a fixed sequence of stages, where each stage has a throughput and a target time: production lines, order fulfilment, claims handling, approvals. The worked example is `assets/examples/excess-wip.html`. Start from it instead of the starter: take its two regions out (build.md, section 1), then replace the data.

It does not fit a plain list of items with no stages or targets, such as a ticket export. Build that from the starter.

## The questions readers bring

1. Is there more work in progress than the system needs, and how much?
2. Where is it sitting?
3. Is it getting better or worse?
4. How old is it?
5. What is driving it, and which items should someone look at today?

One card answers each, in that order, under a hero tile that answers the first.

## Definitions

Use these words exactly and print them in `meta.method`, because readers argue about definitions, not charts.

- **Throughput:** units completed per day at a stage, averaged over a stated window.
- **Target cycle time:** the days a unit should spend at a stage.
- **Target WIP** = throughput x target cycle time. This is Little's Law (WIP = throughput x cycle time) read as a target.
- **Excess WIP** = max(0, WIP - target), worked out per stage, and per line where lines cannot share work.
- **Implied cycle time** = total WIP / throughput of the last stage.
- **Age ratio** = days in the current stage / that stage's target cycle time. It puts fast and slow stages on one scale.

## Traps

- **Do not net.** A shortfall at one stage does not cancel an excess at another: sum the excesses (rule N09). Compute excess at the lowest level first, then add up. In pipeline terms: `add` in one pipeline, then `group` in a second.
- **Units and value are different stories.** Late stages hold fewer, costlier units. Show units in the charts and value as a second tile.
- **Age in days misleads across stages.** Bin the age ratio, not days.
- **Titles go stale and change with the view.** A finding for all lines can be false for one. Quote facts in titles (build.md, section 4), or give titles per view (section 9) and recompute them whenever the data changes.
- **Label the estimate.** Target WIP is a model. Say which throughput window and whose target cycle times.

## Tables to embed

| Table | One row per | Columns |
|---|---|---|
| `stages` | line and stage | line, stage, wip, throughput, targetCt, unitCost |
| `orders` | open work order | id, line, stage, family, qty, ageDays, targetCt, unitCost, excessRate |
| `trend` | line and week | week, line, wip, target, lower, upper, excess |

Keep `stages.wip` equal to the sum of `orders.qty` for that stage, and the last `trend` row equal to today's totals, or the cards will disagree. `excessRate` is each stage's excess divided by its WIP: it shares a stage's excess across its orders in proportion to quantity, which is what lets you rank contributors.

## Pipelines

```json
"stageCalc": { "from": "stages", "where": { "line": "$view" },
  "add": { "target": ["mul", "throughput", "targetCt"], "excess": ["pos", ["sub", "wip", "target"]],
           "lower": ["mul", "target", 0.9], "upper": ["mul", "target", 1.1], "excessValue": ["mul", "excess", "unitCost"] } },
"byStage":   { "from": "stageCalc", "group": "stage",
  "agg": { "wip": ["sum", "wip"], "target": ["sum", "target"], "lower": ["sum", "lower"], "upper": ["sum", "upper"], "excess": ["sum", "excess"] } },
"byStageLoad": { "from": "byStage", "add": { "load": ["div", "wip", "target"] } },
"orderCalc": { "from": "orders", "where": { "line": "$view" },
  "add": { "ageRatio": ["div", "ageDays", "targetCt"], "excessQty": ["mul", "qty", "excessRate"] } },
"ageBins":   { "from": "orderCalc", "bin": "ageRatio", "step": 0.5, "agg": { "units": ["sum", "qty"] } },
"byFamily":  { "from": "orderCalc", "group": "family", "agg": { "excess": ["sum", "excessQty"] }, "sort": "-excess", "top": 6 }
```

## The page

| Question | Card | Configuration |
|---|---|---|
| How much | Hero tile | `["sum", "byStage.excess"]`, with `detail` as a share of all WIP and `delta` against last week (`good: "down"`) |
| Where | Bar, width 7 | `byStageLoad`: `y` wip, `target`, `band` [lower, upper], `status` on `load` with your own threshold words. Keep stage order: do not sort |
| Trend | Line, width 5 | weekly WIP with the target `band`, and one `annotate` where it left the band |
| How old | Histogram, width 6 | `ageBins`: `x` lo, `y` units, `refs` at 1 and 2, `status` at the same points |
| What drives it | Pareto, width 6 | `byFamily` |
| Act on | Table, full width | `orderCalc` sorted by `-ageRatio`, `limit` 10, a `status` column in words |

Supporting tiles: value of the excess, implied cycle time against target, units aged past twice target.
