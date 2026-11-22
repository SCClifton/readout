---
name: readout-dashboards
description: Readout is a dashboard design system and theme set that produces calm, typographic, accessible dashboards as single HTML files with no dependencies and no network access. Use this skill whenever the user asks for a dashboard, KPI or metrics page, scorecard, status or operations report, or several charts and tables on one page, and whenever they ask to restyle, review, theme or brand one, even if they never say "dashboard" or name Readout. It ships a starter page with an embedded chart runtime, so tiles, charts and tables are written as short configuration rather than hand-drawn, plus four themes (light or dark, soft or monochrome), density and contrast switches, design tokens, a brand overlay method and a checker.
license: MIT, and MIT-0 for everything in assets/. Complete terms in LICENSE.txt
compatibility: Needs file tools, and works best with a shell, to build a page from the starter. Node is optional, for scripts/check.js. Nothing is installed and nothing is fetched from the network.
---

# Readout dashboards

A dashboard is read in seconds by someone busy. Readout exists to put the answer in front of them first and keep everything else quiet: neutral by default, colour only where attention is needed, type doing the work of hierarchy.

**How it works.** You do not draw charts or write CSS. You write two short regions of a starter page: a layout, and one JSON block that holds the data and says what to show. A script already inside the page draws everything, applies the chart rules, and reports its own problems. The result is one file that loads nothing and, opened as a file, cannot reach the network.

**If a general data-visualisation skill is also loaded:** let it help you choose the chart form. Build with this skill's starter, tokens and look, and do not hand-draw a chart the runtime already offers. Inside a Readout page, Readout's visual choices win so the page reads as one system.

## Workflow

1. **Find the answer before the layout.** What question does the reader bring, what is the one number that answers it, and what would they do about it? That number is the hero tile. Embed the rows and let the page derive the figures: a CSV export pastes in unchanged. Use real tools, where you have them, to cross-check or to work out what the page cannot. Never do arithmetic in your head, and never retype a table by hand.
2. **Read `references/build.md` once.** It is the whole contract: the two regions, tables, pipelines, tiles, the four chart types, formats. Paths here are relative to this skill's folder.
3. **Write the two regions as small files of your own and assemble the page** with the command in build.md, section 1. `assets/starter.html` supplies the rest. Never print or read a whole page: its style and script are two generated lines, each tens of thousands of characters. Only for work moving through stages that each have a throughput and a target time, start from `assets/examples/excess-wip.html` and adapt it.
4. **Check.** Unless the user has said node is not available, run `node --version` once. With node: `node scripts/check.js <name>.html`. Without it, run the page in a headless browser, or open it in one (build.md, section 11). Errors show in a red panel at the top and notes in the footer. The reader sees both, so clear every error and every note, or tell the user why a note stays. Do not install anything to make a check run.
5. **Hand over.** Say what the page shows, where the data came from, what will and will not update if the data is replaced, and what you could not check (for example, "not opened in a browser").

With no shell, copy the starter with your file tools and edit between its markers (build.md, section 1). With no file tools at all, say so, then give the user the two regions to paste into their own copy of `assets/starter.html`.

## Judgement the runtime cannot make for you

These are the calls that decide whether a page is good. Each has an ID so reviews can cite it (`references/rules.md` has all of them with reasons).

- **P01 Lead with the answer.** One hero tile. Card titles state findings ("Test holds half the excess"), not measures ("WIP by stage"). Someone who reads only the titles should still get the story.
- **P02 Summary before detail.** Tiles, then the trend, then the breakdown, then the table.
- **C01 Neutral by default.** Leave marks grey. Use `highlight` or `status` only for what needs attention. When everything is coloured, nothing stands out.
- **C03 Status colours mean status.** Use `status` with your own words in `labels` for thresholds a reader must act on, never for decoration or to tell ordinary series apart.
- **V01 Choose the form by the job.** Compare categories: bar. Actual against target: bar with `target`. Change over time: line. Shape of a spread: histogram. The few that matter: pareto. Exact values or many attributes: table. When unsure, a table.
- **L03 Three to five tiles, each with a comparison.** A number alone says nothing: give `delta` or `detail`.
- **N01 Every number has a unit, N02 a source and an as-of time.** Set `unit`, `meta.source`, `meta.asOf`.
- **N03 No typed figures.** A number or name in a title or note comes from the data: quote a fact as `{name}` (build.md, section 4) so it stays true when the data changes.
- **N07 Say when data is not real.** Set `meta.marking` for sample, synthetic, draft or restricted pages.
- **W02 Plain words.** Subtitles give measure, unit and period. Sentence case. No abbreviation the reader would not use.
- **V13 Cap what a chart carries.** At most four lines and about twelve bars. Fold the rest with `top`.
- **X02 Leave the generated blocks alone.** No edits to the style or script, no extra scripts, inline styles or raw colours. If the mounts cannot draw it, use a custom card (`references/design-system.md`).

## What the runtime already guarantees

Do not spend effort policing these: bars start at zero; there is no second axis, pie, gauge or 3D; colours and contrast come from validated tokens; status always carries a shape and words as well as a colour; every chart has a tooltip, keyboard reading and a table view; the page reflows to a phone, prints in light mode, and honours reduced motion, more contrast and forced colours; every card shows its source and as-of time, or says they are missing.

## Themes, density, contrast

Set attributes on the `<html>` element (line 2 of the page):

| Attribute | Values | Default |
|---|---|---|
| `data-style` | `soft` (tinted greys, blue accent) or `mono` (black, white and grey) | `soft` |
| `data-theme` | `light` or `dark`; leave it out to follow the reader's system | follows system |
| `data-density` | `comfortable` or `compact` | `comfortable` |
| `data-contrast` | `more` | standard |

The four themes are Daylight (soft light), Midnight (soft dark), Paper (mono light) and Graphite (mono dark). Use mono for formal, print-like or black-and-white house styles, and compact for dense operational pages. `"switches": ["theme"]` in `meta` gives the reader a control.

## Brand

Before building, look for `./readout.brand.css`, then `~/.config/readout/brand.css`. If one exists, paste its contents between the `readout:brand` markers as `<style data-readout-brand="Name">...</style>`. To make one from a company's guidelines, follow `references/brand-overlay.md`. A brand overlay is private to whoever made it: never add one to this skill's folder.

## Publishing as a Claude artifact

A finished page also works as a Claude artifact. The artifact host wraps the file in a document of its own, so give it the page without its wrapper lines:

```
sed -e '1,6d' -e '/^<\/head>$/d' -e '/^<body>$/d' -e '/^<\/body>$/d' -e '/^<\/html>$/d' page.html > page.artifact.html
```

Then copy any `lang`, `data-style`, `data-density` or `data-contrast` from the old `<html>` line onto the `<div class="ro-page">` element. In this form the page has no security policy of its own and relies on the host's, so keep the full file for every other use. `scripts/check.js` accepts both forms.

## Where to read more

| When you are | Read |
|---|---|
| Building or editing any page | `references/build.md` |
| Building a page about work moving through stages with target times | `references/patterns/flow-wip.md` |
| Adding a custom card, custom SVG, or working with another chart tool | `references/design-system.md` |
| Creating or applying a company brand | `references/brand-overlay.md` |
| Reviewing a page, or looking up a rule ID from a message | `references/rules.md` |

`assets/specimen.html` shows every component in every theme. `assets/tokens.json` holds the tokens for other tools.
