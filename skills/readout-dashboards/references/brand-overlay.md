# Brand overlay

A brand overlay is one small CSS file that makes Readout pages look like they belong to an organisation. It is made once, from that organisation's own guidelines, and kept private.

## What it can and cannot change

- **Can:** the accent colour, the neutral greys, the typeface (installed fonts only), corner radius, the card outline, and which base style the pages use.
- **Cannot:** status colours, the categorical palette, the type scale, spacing, or any chart rule. Those are what keep pages readable and comparable, so they stay fixed.
- There is no logo slot in this version. Page markings such as Internal or Draft are text, set per page with `meta.marking`.

## Steps

1. **Read the official guidelines** the user points you to. Collect: the primary brand colour, any specified greys, the typeface names, whether corners are square or rounded, and whether the identity is led by black and white or by colour. Use only what the guidelines say. Do not guess from memory or from a logo.
2. **Choose the base.** `mono` when the identity is black, white and grey with colour used sparingly. `soft` otherwise.
3. **Copy `assets/brand.template.css`** to `readout.brand.css`. Make the first line say `base: soft` or `base: mono`.
4. **Fill it in, light mode first.** Delete every line you are not changing.
   - Typeface: the brand face first, then the system stack as fallback. If the face is not installed on readers' machines, leave the font line out. Never add `@font-face`, `url()` or `@import`: pages load nothing.
   - `--ro-accent-text` and `--ro-accent`: start from the brand colour. If it does not reach 4.5:1 on white and on the page colour, darken it in small steps, keeping its hue, until it does.
   - `--ro-on-accent`: white, or near-black if white does not reach 4.5:1 on the accent.
   - `--ro-accent-soft`: a very light tint of the same hue.
   - `--ro-emphasis`: the same as the accent.
5. **Then dark mode.** Do not reuse the light values. Take a lighter step of the same hue for `--ro-accent-text` and `--ro-emphasis`, a middle step for `--ro-accent`, and a very dark tint for `--ro-accent-soft`. Write the same values into both dark blocks. Copy the light values into the print block.
6. **Check it.** `node scripts/check.js --brand readout.brand.css` prints every pair that fails, with the ratio it reached and the ratio it needs. Without node, paste the overlay into a copy of `assets/specimen.html` (step 8) and open it: the page lists the same failures at the top. Adjust and repeat until it is clean in light and dark.
7. **Keep it private.** Save it as `~/.config/readout/brand.css` to use it for all your work, or as `readout.brand.css` in a project folder. Do not put it in this skill's folder, and do not commit it to a public repository. Where there is no lasting disk, keep the file with the project's own instructions.
8. **Apply it to a page.** Paste the file's contents between the `readout:brand` markers, wrapped as `<style data-readout-brand="Name">` and `</style>`. For a `mono` base also set `data-style="mono"` on the `<html>` element.

## If the brand colour cannot pass

Some brand colours (yellows, limes, pale blues) cannot reach 4.5:1 as text on a light surface however they are stepped. Do not force them. Use the `mono` base, leave the accent as ink, and say plainly to the user that the brand colour is too light to carry text or controls. Colour that fails contrast is not a brand asset on a dashboard.

## Why the selectors look odd

The template repeats `:root` four or five times in each selector. That is deliberate: it raises the overlay above every built-in theme, including monochrome dark and print, without `!important`. Four of the neutral roles are written with an underscore (`--ro-_text-2`, `--ro-_text-3`, `--ro-_hairline`, `--ro-_border`): set those names, so that the more-contrast setting can still promote them.
