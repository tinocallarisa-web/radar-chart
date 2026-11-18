# AppSource Listing — Radar & Spider Chart by TCViz 1.0.1.0

1.0.1.0 (18-11-2026): only the WHAT'S NEW IN 1.0.1 block is new in the Description; the rest is unchanged.

Description revised 17-11-2026 after App Advisor (3.5/5): BEST FOR block, plain-language glosses for jargon, Power BI fit
stated in the second paragraph. Same package; only the Description field changes in Partner Center.

Copy ready to paste into Partner Center, English only. **Editing this file does not change the offer**: every field
is pasted by hand in Partner Center.

Limits measured in Partner Center: *Search results summary* 100 characters, *Description* 5,000 characters (cut
silently), *Certification notes* 2,500 counted with CRLF and **cleared on every resubmission**.

Rules for this listing: no comparison with other marketplace visuals by name; compare only with what Power BI has
natively (no radar chart). No superlatives that cannot be proven. "Power BI" with capitals. "Conditional formatting
(fx)" and "dynamic format strings" written as such: OKviz looks for them.

---

## Offer name

```
Radar & Spider Chart by TCViz
```

## Search results summary (max 100)

```
Radar (spider) chart for Power BI: fixed scale, axes that stay put. Targets and 4+ series in Pro.
```

## Keywords (3)

```
radar chart
spider chart
skills assessment
```

- `radar chart` — the name of the type in most listings and in the radar chart by Microsoft people already know.
- `spider chart` — the other name, used in the community; whoever types it does not find visuals that only say radar.
- `skills assessment` — the problem most often cited (team competencies), like "outlier analysis" for Box & Whisker.
  Inferred, no volume data; alternative: `supplier scorecard`. Never `polar chart`: in AppSource that is another type.

## Description

```
A radar chart that changes its scale with every filter makes a 57 look like a 100. Two suppliers that score 3 and 4 out of 5 look like 1 and 5 when the axis starts where the data does. And an empty answer drawn as zero invents a bad score.

Radar & Spider Chart by TCViz compares several profiles on several criteria at once — suppliers, employees, products, teams — on a scale that does not move. Power BI has no built-in radar chart; this one starts at zero, keeps your axes in place and draws a gap where a value is missing. It filters, drills down, keeps bookmarks and shows tooltips like any built-in visual.

BEST FOR

• Supplier scorecards: quality, price, delivery and service on one scale
• Skills and competency assessments: each person against the role profile
• Product or option comparisons on several criteria before a decision
• Survey results by group, when each question is a column

READ IT HONESTLY

• A common scale from zero, with a minimum and maximum you can fix (1 to 5, 0 to 100)
• Axes keep their order when you filter: the order of the field (Sort by column), by name or by value
• Empty values drawn as a gap in the outline, never as zero; negative values with the zero ring marked
• A note names the axis that flattens the others, and counts values outside a fixed scale
• Measures as axes: when each criterion is its own column, as in most survey exports, use the columns as they are, without reshaping the table into rows

PRO

• 4 to 12 series (the free version draws 3)
• A target per axis, drawn dashed, with the gap on every axis in green or red
• A scale per axis, from the data or from minimum and maximum measures, and each axis labels its own rings
• "Lower is better" axes, reversed and marked, and a % of target scale
• Bands, a reference ring, small multiples (a grid of small radars, one per category) or one radar per series on a shared scale
• Axis groups drawn as named arcs, annotations from a text measure, a value table and the mean of the axes
• Marker colour with conditional formatting (fx) rules

FREE AND PRO

The free version is a complete radar chart: up to 3 series on a correct, fixed scale, with every reading aid. Pro adds ways to compare more and to measure against a target. Turn on a Pro capability while editing without a licence and it is drawn working, on your own data, under a "Pro preview" watermark that names it; reading view shows the free result.

WORKS LIKE A NATIVE VISUAL

• Click a point, an axis or a series to filter the page; Ctrl+click for several; highlight from other visuals; bookmarks restore the selection
• Drilldown on a hierarchy, Power BI context menu, standard and report tooltips
• Keyboard navigation, screen-reader descriptions and high contrast; marker shapes can differ per series
• The number format of each measure, dynamic format strings included, so labels match the rest of your report; the report language; Format pane and texts in 12 languages
• Six style templates, including an IBCS style (the international standard for business charts); curved lines, rotation, grid as polygon or circle; format on the canvas; a setup guide and a start screen

PRIVACY

The visual makes no network requests and declares no privileges, so Power BI does not let it send anything anywhere. Everything is computed inside your report.

GETTING STARTED

1. Axis: the criteria — quality, price, delivery.
2. Values: the score, set to Average.
3. Series (legend): what you compare — supplier, employee, product.

WHAT'S NEW IN 1.0.1
Dynamic format strings per value: labels, the value table, tooltips and ring values each use their own format. A new Accessibility card: high contrast on demand, focus colour and width, a minimum text size and line patterns per series. Measures as axes now draw one shape per series.

Documentation, how to read a radar chart and FAQ: https://tinocallarisa-web.github.io/radar-chart/support.html
Questions: https://github.com/tinocallarisa-web/radar-chart/discussions
Support: support@tcviz.com
```

## Plan

| Field | Value |
|---|---|
| Plan ID | **`radar-pro`** (exactly this: the code accepts it and any other paid plan of this offer) |
| Plan name | Radar & Spider Chart Pro |
| Price | 0.99 USD per user per month, 9.99 USD per user per year (round local prices with `utillaje/redondear_precios.py`) |
| Trial | None, as Box & Whisker, until Microsoft resolves the licence case |
| Plan description | Pro adds 4 to 12 series, a target with the gap per axis, a scale per axis and "lower is better" axes, % of target, bands and a reference ring, small multiples or one radar per series, axis groups, annotations, conditional formatting (fx) rules on markers, a value table and the mean of the axes. Includes everything in the free version. |

## Offer setup

| Field | Value |
|---|---|
| Offer ID | `radar-tcviz` (the code expects `tino_callarisa.radar-tcviz.<plan>`) |
| Categories | Comparison; Distribution (or the closest available) |
| Industries | Manufacturing; Professional services |
| Video | https://www.youtube.com/watch?v=WeIrnbHgZyk |
| Support / documentation | https://tinocallarisa-web.github.io/radar-chart/support.html |
| Privacy | https://tinocallarisa-web.github.io/radar-chart/privacy.html |
| Terms (EULA) | https://tinocallarisa-web.github.io/radar-chart/terms.html |
| Logo | `assets/logo_300x300.png` |
| Screenshots | `assets/` (1366x768) |
