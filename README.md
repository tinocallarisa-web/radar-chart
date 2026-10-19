# Radar & Spider Chart by TCViz

A Power BI custom visual: a radar (spider) chart that reads honestly — a common scale from zero that does not move when you filter,
axes that stay in place, and gaps where values are missing. The free version compares up to 3 series; Pro adds more series, a
target with the gap on every axis, a scale per axis and reversed axes, bands, small multiples, axis groups, annotations,
conditional formatting (fx) rules and a value table.

- Documentation: https://tinocallarisa-web.github.io/radar-chart/support.html
- Privacy: https://tinocallarisa-web.github.io/radar-chart/privacy.html · Terms: https://tinocallarisa-web.github.io/radar-chart/terms.html
- Questions: https://github.com/tinocallarisa-web/radar-chart/discussions · support@tcviz.com

## Build

```
npm ci
node build-test.js          # test package, Pro forced (_test)
node build-test.js --free   # test package, real licence (_testfree)
```

Texts and the Format pane are generated: `python tools/gen_capabilities.py`, `python tools/extract_ui.py`, `python tools/i18n.py`.
Documentation: `python tools/gen_docs.py`.

© 2026 TCViz. Source published for transparency and review; see the Terms of Use.
