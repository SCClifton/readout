# Readout

A dashboard design system and theme set, packaged as a skill for Claude.

Readout dashboards are calm and typographic: neutral by default, colour only where attention is needed, one clear number first. Each dashboard is a single HTML file with no dependencies. It loads nothing, and a content security policy inside the file stops it reaching the network at all. (Published as a Claude artifact, the page drops its own wrapper and the host's policy applies instead.)

## What is in it

- **A starter page with a chart runtime built in.** Claude writes a short layout plus one block of JSON and assembles them into a copy of it. The page draws the tiles, charts and tables, and reports its own problems.
- **Four themes.** Daylight and Midnight (soft, light and dark), Paper and Graphite (monochrome, light and dark), each with comfortable and compact density and a more-contrast setting.
- **Design tokens** in three tiers, in `tokens.json` and `tokens.css`, with every text and mark colour checked for contrast in every theme and the data palette checked for colour-blind readers.
- **Rules with reasons.** About sixty, each with a stable ID. The runtime enforces most of them.
- **A brand overlay method,** so an organisation's colours and typeface can be applied privately without touching the public skill.
- **A worked example:** a dashboard that estimates excess work in progress, on synthetic data.

Open `skills/readout-dashboards/assets/specimen.html` to see every component, and `assets/examples/excess-wip.html` for the example.

## Install

| Where | How |
|---|---|
| Claude Code, as a plugin | `/plugin marketplace add SCClifton/readout`, then `/plugin install readout@readout` |
| Claude Code, as a plain skill | Copy `skills/readout-dashboards` into `~/.claude/skills/` (or a project's `.claude/skills/`) |
| Claude apps | Customize, Skills, +, Create skill, Upload a skill, with `readout-dashboards.zip` from the latest release |
| No skills available | Give Claude `assets/starter.html` and `references/build.md` and ask for a dashboard |

On Claude Code 2.1.275 or later the plugin installs in one step:

```
/plugin install readout --marketplace SCClifton/readout
```

Installed as a plugin, the skill is `readout:readout-dashboards`. Claude loads it by itself when you ask for a dashboard. An organisation can restrict custom skills and outside marketplaces, so check before relying on either at work.

Nothing is installed and nothing is downloaded when the skill runs. Node is optional, for the command-line check. Without it, a page is checked by running it in a headless browser.

## Use

Ask for a dashboard. For example: "Build a dashboard from this export that shows where orders are getting stuck." To check a page yourself:

```
node skills/readout-dashboards/scripts/check.js my-dashboard.html
```

## Repository layout

```
src/                         sources: tokens.json, schema.json, components.css, runtime.js, pages, example data
tools/                       build.mjs, validate-tokens.mjs, derive-palette.mjs, budget.mjs, test/run.mjs
skills/readout-dashboards/   the skill: SKILL.md, references/, scripts/check.js, assets/ (generated)
.claude-plugin/              plugin and marketplace manifests, so the repository installs as a Claude Code plugin
```

Everything under `assets/` except `brand.template.css` is generated. Edit `src/` and run the build.

## Checks

```
node tools/build.mjs --check                   generated files are current
node tools/validate-tokens.mjs                 contrast, colour-blind separation, originality
node tools/test/run.mjs                        runtime logic, every diagnostic, hostile inputs, broken pages
node src/examples/excess-wip/verify.mjs        every number in the example, recomputed independently
node tools/budget.mjs                          documentation size, plain ASCII, colours quoted in docs
```

## Design notes

Readout's look draws on widely published interface guidance, including Apple's Human Interface Guidelines and long-standing practice in statistical graphics. It is an independent work. It is not affiliated with or endorsed by Apple or any other company, and it ships no third-party fonts, icons or colour values: pages use whatever system typeface the reader already has, and the palette was derived from scratch (see `tools/derive-palette.mjs`).

## Licence

MIT, with one exception made for the people who use it. Everything a dashboard is made from (the starter page, the script and stylesheet inside it, the tokens and the brand template, in `skills/readout-dashboards/assets/`, and their sources in `src/`) is MIT-0, which asks for nothing. Pages you make with Readout and brand overlays you write carry no notice requirement. See `LICENSE` and `LICENSE-MIT-0`.
