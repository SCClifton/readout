# The design system

Read this when the mounts cannot draw what you need (custom cards, custom SVG), when you need a token, or when another chart tool has to match Readout.

## Principles

1. **Lead with the answer.** The first thing on the page is the number the reader came for.
2. **Neutral by default.** Grey is the resting state. Colour is spent only on what needs attention, so it still means something when it appears.
3. **Type carries the hierarchy.** One system typeface, a short scale, weight and size instead of boxes, rules and decoration.
4. **One system.** Every colour, size and space is a token. Nothing is invented per page.
5. **Honest numbers.** Bars from zero, units stated, source and time shown, formulas printed, sample data labelled.
6. **Respect the reader.** Readable by keyboard, by screen reader, in high contrast, on a phone and on paper. Nothing moves that does not need to.

## Themes

Two axes make four themes: style (`soft` or `mono`) and mode (light or dark). Daylight, Midnight, Paper, Graphite. Style changes the chrome only: surfaces, ink, lines, accent, corner radius and card outline. The data palette and the status colours are the same in both styles and are re-stepped for dark mode, not inverted. More contrast promotes each ink and line role one step and makes the toolbar opaque. It introduces no new colours.

## Tokens

CSS custom properties, all prefixed `--ro-`. Use roles. Never write a hex value, a pixel font size or a one-off spacing value.

| Group | Roles |
|---|---|
| Surfaces | `page` behind everything, `card` for cards and chart surfaces, `fill` for control tracks and quiet fills, `raised` for tooltips |
| Ink | `text`, `text-2` secondary, `text-3` captions and axis labels. All three pass 4.5:1 on every surface |
| Lines | `hairline` dividers and gridlines, `border` outlines, `border-strong` baselines (3:1) |
| Accent | `accent` fills, `on-accent` text on them, `accent-text` links and focus, `accent-soft` tints |
| Data | `neutral` ordinary marks, `neutral-2` context, `emphasis` the one highlight, `band`, `cat-1` to `cat-8`, `seq-1` to `seq-7`, `div-neg-3` to `div-pos-3` with `div-mid` |
| Status | `good`, `warning`, `serious`, `critical`, each with `-text` and `-soft` |
| Space | `space-0-5` 2px, `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24, `space-8` 32, `space-10` 40, `space-12` 48, `space-16` 64 |
| Shape | `radius-xs` 4, `radius-sm` 6, `radius-md` 10, `radius-lg` 14, `radius-xl` 20, and per style `radius-card`, `radius-control`, `radius-chip`, `card-border` |
| Type | `size-11` `12` `13` `15` `17` `20` `22` `28` `34` `40` `48`; `weight-regular` `medium` `semibold` `bold`; `leading-tight` `snug` `normal`; `tracking-display` `title` `caps` |
| Density | `gap`, `pad-card`, `pad-page`, `row`, `control`, `chart-h`, `text-body`, `text-label`, `text-title`, `text-page`, `text-kpi`, `text-hero` |

Type roles: caption 11 (the smallest size allowed), footnote 12, label 13, body 15, card title 17 semibold, section heading 20 semibold, page title 28 bold, tile value 34 semibold, hero value 48 bold. Weights never go below regular. Tabular figures in tables and on axes only: large standalone numbers keep proportional figures.

## Custom cards

A custom card is plain markup in the layout region that uses these classes. It has no mount and no entry in the data block.

```html
<article class="ro-card ro-span-6">
  <div><h2 class="ro-card-title">The finding, as a sentence</h2><p class="ro-card-sub">Measure, unit, period</p></div>
  <div class="ro-stack">
    <p class="ro-callout">The one sentence a reader should leave with.</p>
    <p>Body text. <span class="ro-muted">Secondary text.</span></p>
  </div>
  <p class="ro-card-foot">Source: order system export &middot; As of 31 Jan 2026</p>
</article>
```

| Purpose | Classes |
|---|---|
| Arrange | `ro-stack` (column), `ro-row` (wrapping row), `ro-span-3` to `ro-span-9` on the card |
| Text | `ro-eyebrow`, `ro-h1`, `ro-h2`, `ro-card-title`, `ro-card-sub`, `ro-card-note`, `ro-card-foot`, `ro-muted`, `ro-num` (tabular figures) |
| Blocks | `ro-callout`, `ro-empty` (an empty or unavailable state, in words), `ro-toolbar` (a sticky bar: the only translucent surface) |
| Status chip | `ro-chip` with `ro-chip--good`, `--warning`, `--serious` or `--critical`. Put the shape first, then the word |
| Table | `ro-tablewrap` around `table.ro-table`; `ro-r` right-aligns numbers; `ro-mono` for identifiers |
| Legend | `ro-legend` holding `ro-key` items, each an `<i>` swatch then a label. Swatch modifiers: `ro-key-line`, `ro-key-band`, `ro-key-tick`, `ro-bg-em`, `ro-bg-1` to `ro-bg-4` |
| Hidden text | `ro-sr` for screen-reader-only text |

Status shapes, so that level never rests on colour. Use inside `<svg class="ro-ico" viewBox="0 0 12 12" aria-hidden="true"><path d="..."/></svg>`:
good, a circle `M6 1.2a4.8 4.8 0 1 0 0 9.6a4.8 4.8 0 0 0 0-9.6z`; warning, a triangle `M6 1l5.2 9.6H0.8z`; serious, a diamond `M6 0.6L11.4 6L6 11.4L0.6 6z`; critical, a square `M1.6 1.6h8.8v8.8H1.6z`.

Limits. No `style` attributes, no style blocks, no scripts, no images or fonts from the network (the page's policy blocks them). A figure in a custom card is typed text, so compute it with a real tool, state its source, and recheck it when the data changes.

## Custom SVG

When a chart form is not offered, draw it by hand inside a custom card, with the chart classes so it matches.

```html
<svg class="ro-chart" viewBox="0 0 320 120" role="img" aria-label="What the chart shows, in a sentence"> ... </svg>
```

| Element | Classes |
|---|---|
| Marks | `ro-mark` (neutral), `ro-mark--em` (the highlight), `ro-mark--ctx` (context), `ro-mark--good`, `--warning`, `--serious`, `--critical` |
| Series | fills `ro-f1` to `ro-f8`, strokes `ro-s1` to `ro-s8`, used in slot order and never skipped or cycled |
| Lines | `ro-line` with `ro-line--em`, `ro-line--ctx` or `ro-line--target`; end points `ro-dot`, `ro-dot--em` |
| Reference | `ro-band` (a range), `ro-target` (a tick), `ro-ref` (a marker line), `ro-grid-line`, `ro-base-line` |
| Text | plain `<text>` is an axis label; `ro-cat` a category; `ro-val` a value; `ro-ann` an annotation |

Mark rules. Bars at most 24px thick, 4px rounded at the tip and square at the baseline, always from zero. Lines 2px with round joins. End dots radius 4 with a 2px ring in the card colour. Touching marks are separated by a 2px gap, never by an outline. Gridlines are solid hairlines and few. Label values at the bar tip or the line end, and put value-axis labels on the trailing side. Text is never drawn in a data colour. Give the SVG an accessible name and put the same numbers in a table nearby.

## Matching another chart tool

If a general data-visualisation method is in use, these are Readout's parameters for it. Colours are light then dark.

| Parameter | Value |
|---|---|
| Categorical order | 1 blue `#2964c6` `#4683e8`, 2 orange `#cd7111` `#d67612`, 3 teal `#118e7a` `#118e7a`, 4 pink `#d464ae` `#d464ae`, 5 gold `#ad9012` `#ad9012`, 6 red `#c9484c` `#c9484c`, 7 violet `#6e61d0` `#8479eb`, 8 green `#2c983a` `#3ca546` |
| Series limits | Four series in one chart. A fifth folds into Other or the chart splits into small multiples |
| Default mark | Neutral grey, with one series or bar in `emphasis`. Categorical colour only when the series themselves are the subject |
| Sequential | One hue, `seq-1` to `seq-7` in blue, lightest nearest the surface |
| Diverging | Blue and red arms around a neutral grey midpoint, three steps each |
| Status | good `#149e71` `#1ac18b`, warning `#d69716` `#f3b02e`, serious `#cf630f` `#e16c12`, critical `#be222a` `#cc3336`. Fixed: never themed, never used for a series, always with shape and words |
| Chart surface | `#ffffff` light; `#191d24` soft dark, `#1d1d1d` mono dark |
| Second channel | Shape and words for status, direct labels, and a table view for every chart. No texture fills |
| Filters | One switch in the page header that scopes every tile, chart and table |

Where Readout is deliberately stricter or different: pies, donuts, gauges and 3D are not offered at all; histogram bars fill their bins instead of stopping at 24px, because a spread reads as a shape; value-axis labels sit on the trailing side so the plot lines up with the card's text.

Validation, for anyone checking: neighbouring categorical slots are at least 9.2 apart for red-green colour-blind readers and 19.3 in normal vision (OKLab distance times 100), the first four slots stay at least 9.0 and 18.7 apart in every pairing, every slot reaches 3:1 on the card in both modes, and the four status colours are at least 9.5 apart from each other under the same simulation. Amber warning is 2.5:1 on white, which is why status always carries a shape and words.
