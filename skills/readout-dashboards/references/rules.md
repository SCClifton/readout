# Rules

Every rule has a stable ID, what to do, what not to do, and the reason. Use this file to review a page, or to look up an ID that a message cites (`grep -n "^\*\*V03" references/rules.md`).

**[R]** means the runtime enforces the rule: you cannot break it by accident, and a breach is reported with the ID. **[J]** means it is your judgement.

Contents: P principles. L layout. C colour. T type. V charts. N numbers. W writing. S states. A access. X integrity. B brand. D diagnostic codes.

## P. Principles

**P01 Lead with the answer [J].** Do: one hero tile, and titles that state findings. Don't: open with filters, or title a card with its measure. Why: most readers leave after the first screen, and many read only the titles.
**P02 Summary before detail [J].** Do: tiles, trend, breakdown, table, in that order. Don't: put the detail table first. Why: each layer answers the question the one above raises.
**P03 One idea per card [J].** Do: split a card that needs "and" in its title. Don't: stack unrelated measures in one chart. Why: a card is read as a single claim.
**P04 Everything earns its place [J].** Do: remove any element that does not change what the reader understands. Don't: add icons, pictures, borders or colour for interest. Why: decoration competes with the data for attention.

## L. Layout

**L01 Twelve columns [J].** Do: make the spans in each row add to 12. Don't: leave a ragged row. Why: aligned edges are what make a page look ordered.
**L02 One hero [R note].** Do: mark one tile `hero`. Don't: mark two. Why: two leads are no lead.
**L03 Three to five tiles [R note].** Do: keep the tile row to what fits a glance. Don't: tile every available metric. Why: past five, the row stops being a summary.
**L04 One switch, above what it scopes [R].** Do: use `meta.views` for a page-wide filter. Don't: filter one chart alone. Why: figures that disagree across cards destroy trust.
**L05 Card anatomy [R].** Do: give title, subtitle, and let source and time show. Don't: hide the footer. Why: a chart without provenance cannot be acted on.
**L06 Density is a page choice [J].** Do: pick `comfortable` or `compact` for the whole page. Don't: mix. Why: rhythm comes from consistent spacing.

## C. Colour

**C01 Neutral by default [J].** Do: leave marks grey and highlight the one that matters. Don't: give each bar or tile its own colour. Why: colour that is everywhere signals nothing.
**C02 One accent [R].** Do: let the accent mark selection and emphasis. Don't: add a second highlight colour. Why: two accents compete.
**C03 Status colours mean status [J].** Do: use `status` for thresholds the reader must act on. Don't: use green, amber or red for ordinary series. Why: the meaning is only as strong as its consistency.
**C04 Never colour alone [R].** Do: supply `status.labels` in the reader's words. Don't: rely on red and green. Why: about one man in twelve cannot tell them apart, and print loses them.
**C05 Tokens only [R note].** Do: use classes and roles. Don't: write a hex value or an inline style. Why: every token is contrast-checked in every theme; a raw colour is checked in none.
**C06 Fixed slot order [R].** Do: let series take slots in order. Don't: reorder or skip. Why: the order is what keeps neighbours distinguishable for colour-blind readers.
**C07 Four series at most [R error].** Do: fold the rest into Other or split the chart. Don't: draw a fifth line. Why: past four, readers match colours to a legend instead of reading the data.
**C08 Text is never a data colour [R].** Do: let a mark beside the label carry identity. Don't: colour the label. Why: several data colours fail contrast as text.
**C09 Dark is its own palette [R].** Do: use the dark tokens. Don't: invert a light page. Why: inverted colours glare and lose their order.
**C10 No effects on data [R].** Do: flat fills. Don't: gradients, glows or shadows on marks. Why: effects add ink that is not data.

## T. Type

**T01 System typeface [R].** Do: use the reader's system face, or an installed brand face through an overlay. Don't: load a web font. Why: pages load nothing, and system type is the most legible type on each machine.
**T02 Sizes from the scale, never under 11 [R].** Do: use the type roles. Don't: shrink text to fit. Why: text below 11 is not read.
**T03 Regular weight or heavier [R].** Don't: thin or light weights. Why: they fail on low-quality displays.
**T04 Tabular figures in columns only [R].** Do: tables and axes. Don't: large standalone numbers. Why: columns must align; a hero number set in equal-width digits looks loose.
**T05 Sentence case [J].** Do: capitalise the first word and proper nouns. Don't: Title Case or capitals for emphasis. Why: sentence case reads fastest.

## V. Charts

**V01 Form by job [J].** Compare: bar. Against target: bar with `target`. Over time: line. Spread: histogram. The few that matter: pareto. Exact values: table. Why: the wrong form hides the answer.
**V02 Bars start at zero [R].** Why: a bar's length is the number; a cut axis makes small differences look large.
**V03 One value axis [R error].** Do: two charts, or index both series to a common base. Don't: a second axis. Why: the crossing points of two scales are arbitrary, yet readers treat them as meaningful.
**V04 No pie, donut, gauge, radar or 3D [R error].** Do: sorted bars, a tile with a delta, or a bar with a target. Why: angles and areas are judged far less accurately than lengths.
**V05 Target as a tick, range as a band [R].** Why: actual, target and tolerance read in one glance on one scale.
**V06 Pareto without a second axis [R].** Do: sorted bars with cumulative share as text. Why: the classic form needs two axes (V03).
**V07 Label sparingly [R].** Do: bar tips and line ends. Don't: a number on every point. Why: labels work because there are few.
**V08 Legend only when needed [R].** Why: one series needs no key; the title names it.
**V09 Few, solid gridlines [R].** Don't: dashes or heavy rules. Why: the grid is a guide, not content.
**V10 Even time steps [J].** Do: give rows in time order with no missing periods. Don't: skip empty weeks. Why: uneven spacing bends the trend.
**V11 Equal bins [R].** Why: unequal bins change the shape of a spread.
**V12 Sort by value unless order has meaning [J].** Do: `sort` for categories; keep natural order for stages or time. Why: sorting is free insight.
**V13 Fold the long tail [R note].** Do: `top` with Other at about twelve bars. Why: the tail hides the head.
**V14 A table behind every chart [R].** Why: some readers need the numbers, and some cannot see the chart.
**V15 Tooltips add, never gate [R].** Why: touch and print have no hover.

## N. Numbers

**N01 A unit on every number [R note].** Do: set `unit`. Don't: put it only in the title.
**N02 Source and as-of time [R note, shown on the card].** Do: set `meta.source` and `meta.asOf`. Why: a number of unknown age is a rumour.
**N03 No typed figures [J].** Do: derive from the data block, and quote facts as `{name}` in titles and notes. Don't: write a number into a title, note or custom card from memory. Why: typed figures drift from the data and nobody notices.
**N04 One format per measure [J].** Don't: show the same measure as 1,284 in one card and 1.3K in another.
**N05 Name every comparison [R error].** Do: `delta.label` such as "vs last week". Why: a change without a baseline is noise.
**N06 Say which direction is good [J].** Do: set `delta.good`. Don't: colour a change when direction has no meaning. Why: up is not always good.
**N07 Label data that is not real [J].** Do: `meta.marking` for synthetic, sample or draft.
**N08 Show the method for an estimate [R].** Do: add plain-language rows in `meta.method`; formulas are printed for you.
**N09 Do not net opposites [J].** Do: sum excess and shortfall separately. Don't: let a shortfall in one place cancel an excess in another. Why: stock in the wrong place does not help the right place.
**N10 Round for the reader [J].** Do: whole units in tiles, detail in the table. Don't: decimals that carry no decision.
**N11 The as-of date moves with the data [R note].** Do: change `meta.asOf` whenever the rows are replaced, and use `until` for dates that lie ahead. Why: every age is counted to it, so a stale date makes them all wrong without a sign.

## W. Writing

**W01 Titles state the finding [J, R note on length].** "Test holds half the excess", not "WIP by stage". Keep it under about ninety characters as the reader sees it, facts filled in.
**W02 Subtitles state measure, unit and period [J].**
**W03 Plain words [J].** Don't: abbreviations or internal jargon the reader would not use themselves.
**W04 Labels in sentence case with no colon or full stop [J].**
**W05 States explain themselves [R].** An empty or failed card says what happened in words.

## S. States

**S01 Empty is stated, not blank [R].** **S02 Errors appear on the page, with a fix [R].** **S03 A page that did not run says so [R].** **S04 Old data is flagged by its as-of time [J]:** if the data is older than the reader would expect, say so in the subtitle.

## A. Access

**A01 Contrast [R].** Text 4.5:1 and marks 3:1 on every surface, in every theme. **A02 Keyboard [R].** Every control and every chart value is reachable without a mouse. **A03 Motion is optional [R].** **A04 Forced colours [R].** The page stays readable when the system overrides its colours. **A05 Reflow [R].** No sideways scrolling at phone width. **A06 Page language set [R note].**

## X. Integrity

**X01 No network [R error].** The page's policy blocks every outside request. Do not add links to scripts, styles, images or fonts.
**X02 Generated blocks untouched [R error].** Editing the script stops it running, because its fingerprint is pinned. Use a custom card instead.
**X03 Labels are text [R].** Data is never inserted as markup.
**X04 No extra scripts or event handlers [R].** They are blocked.

## B. Brand

**B01 A brand changes chrome only [R].** **B02 Brand colours are hex and pass contrast [R error].** **B03 A brand overlay is private [J]:** keep it out of public skills and repositories.

## D. Diagnostic codes

`D00` something could not be computed or drawn; the message says what. `D01` the data block is not valid JSON. `D02` a mount and an entry do not match. `D03` a required field is missing or the wrong shape. `D04` an unknown table or column, with the real names listed. `D05` an unknown field, format, operation or chart type, with the valid ones listed. `D06` data values are the wrong shape, or a result has no number.
