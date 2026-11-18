# Changelog

All notable changes to Radar & Spider Chart by TCViz. Power BI four-part version numbers.

## 1.0.1.0 — 2026-11-18

- Measures as axes with a field in Series: one shape per series and the legend, as with an Axis field (it drew a single shape).
- Dynamic format strings per value: data labels, the value table, the tooltip and the ring values use the format of each value.
- New Accessibility card in the Format pane: high contrast automatic or on, focus colour and width, minimum text size, and line patterns per series to tell series apart without colour.
- Marker colour: a fixed colour is stored once for the whole visual, and Reset to default on each card clears it; the conditional formatting (fx) rules work as before.
- Right-click on a point that groups several rows opens the context menu for all of them.
- The "Pro preview" watermark is the one shared by all TCViz visuals.
- Style templates: Report theme and the six TCViz collection styles (Boardroom, Ledger, Editorial, Signal, Aurora, Terrace), the same as in Treemap and Line Chart, all free. A report saved with a 1.0.0 template opens with the closest style (Classic as Ledger, Minimal and IBCS style as Editorial, Contrast as Signal, Compact as Report theme); dashed series lines now come only from Accessibility → Line patterns per series.

## 1.0.0.0 — 2026-10-19

- First release: one spoke per axis, a common scale from zero with a fixable minimum and maximum, axes that keep their order when you filter, and empty values drawn as gaps.
- Measures as axes: without an Axis field, each measure in Values is an axis, so survey data in columns works without unpivoting.
- Up to 3 series free; Pro draws up to 12.
- Pro: target with the gap per axis, scale per axis (from the data or from Scale minimum/maximum) with each axis labelling its own rings, reversed "lower is better" axes, % of target scale, bands, a reference ring, small multiples or one radar per series, axis groups as named arcs, annotations from a text measure, marker colour with conditional formatting (fx) rules, a value table and the mean of the axes.
- Curved lines that never go beyond the neighbouring values, marker shapes (or one per series), grid as polygon or circle, rotation, data labels, long axis labels on two lines.
- Notes on the data: an axis that flattens the others, and values outside a fixed scale.
- Six style templates, including IBCS style, and a setup guide.
- Cross-filtering by point, axis or series, highlight, bookmarks, drilldown, context menu, report tooltips, keyboard navigation, screen-reader descriptions and high contrast.
- The number format of each measure, dynamic format strings included; format on the canvas; start screen; Format pane and texts in 12 languages.
- No network requests; Pro licence through Microsoft AppSource.
