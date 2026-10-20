# -*- coding: utf-8 -*-
"""Páginas publicadas (docs/) de Radar & Spider Chart by TCViz.

Estilo, cabecera y buscador: los de Word Cloud (certificado), como Box & Whisker. El contenido describe lo que
hace el código; si cambia una función, cambiarla aquí y regenerar:   python tools/gen_docs.py
Para OKviz: "conditional formatting (fx)" y "dynamic format strings" van escritos tal cual (KPI Card 2.2 los perdió
por no estar escritos).
"""
import io, json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WC = r"C:\tcviz\dev\WordCloud\docs"
NAME = "Radar & Spider Chart by TCViz"
BASE = "https://tinocallarisa-web.github.io/radar-chart/"
REPO = "https://github.com/tinocallarisa-web/radar-chart"
VERSION = json.load(io.open(os.path.join(ROOT, "pbiviz.json"), encoding="utf-8"))["visual"]["version"]
FECHA = "19 October 2026"
VIDEO = "https://www.youtube.com/watch?v=WeIrnbHgZyk"

plantilla = io.open(os.path.join(WC, "privacy.html"), encoding="utf-8").read()
HEAD = plantilla[:plantilla.index("<body>")]
HEADER = plantilla[plantilla.index("<header>"):plantilla.index("</header>") + len("</header>")]
sup = io.open(os.path.join(WC, "support.html"), encoding="utf-8").read()
SCRIPT = sup[sup.rindex("<script"):sup.rindex("</script>") + len("</script>")]


def page(title, sub, body, nav="", search=False):
    head = HEAD.replace("Privacy Policy – Word Cloud by TCViz", f"{title} – {NAME}")
    hdr = HEADER.replace("Word Cloud by TCViz", NAME).replace(">Privacy Policy<", f">{html.escape(sub)}<")
    sb = ""
    if search:
        sb = '''<div class="searchbar">
  <div class="searchbox">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="docsearch" type="search" placeholder="Search the documentation — try &quot;scale&quot;, &quot;target&quot;, &quot;series&quot;…"
           autocomplete="off" aria-label="Search the documentation">
    <button id="searchclear" type="button" aria-label="Clear search" hidden>&times;</button>
  </div>
  <div id="searchstatus" class="search-status" role="status" aria-live="polite"></div>
</div>
'''
    foot = f'''<footer>
  <div style="margin-bottom:10px;">
    <a href="{BASE}support.html">Documentation</a>
    <a href="{BASE}privacy.html">Privacy Policy</a>
    <a href="{BASE}terms.html">Terms of Use</a>
    <a href="{BASE}changelog.html">Changelog</a>
    <a href="{REPO}/discussions" target="_blank">Discussions</a>
    <a href="{REPO}" target="_blank">GitHub</a>
    <a href="https://tcviz.com" target="_blank">tcviz.com</a>
  </div>
  <p>© 2026 TCViz · {NAME} · <a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</footer>
'''
    return (head + "<body>\n" + hdr + "\n" + nav + sb + body + foot + (SCRIPT if search else "") + "\n</body>\n</html>\n")


# ── Datos comunes ────────────────────────────────────────────────────────────

FIELDS = [
    ("Axis", "Grouping", "No*", "One spoke per value: skill, criterion, KPI. A hierarchy gives drilldown. 3 to 40 axes; with more, the first 40 are drawn and a note says so. *Without Axis, each measure in Values is an axis."),
    ("Values", "Measure", "Yes", "The score on each axis. With Axis and no Series, each measure is a series (like the radar chart by Microsoft). Without Axis, each measure is an axis, so survey data in columns works without unpivoting."),
    ("Series (legend)", "Grouping", "No, one field", "One shape per value: supplier, employee, product. Free draws the first 3 in legend order and the legend says “3 of N series”; Pro draws up to 12."),
    ("Target", "Measure", "No — Pro, one field", "Required level per axis: a dashed shape, the gap on every axis (green when the target is met, red when not) and the % of target scale."),
    ("Scale minimum / Scale maximum", "Measure", "No — Pro, one field each", "Range of each axis for the scale per axis, such as the maximum points of each question."),
    ("Axis group", "Grouping", "No — Pro, one field", "Groups of axes drawn as named arcs around the radar: technical, personal. Axes of the same group are kept together."),
    ("Note", "Measure", "No — Pro, one field", "A text measure shown next to the point as an annotation (up to 40 characters; the full text in the tooltip)."),
    ("Small multiples", "Grouping", "No — Pro, one field", "One radar per value, all on the same scale. Each panel draws the axes that have rows in it."),
    ("Tooltips", "Measure", "No", "Extra measures in the tooltip."),
]

FREE_PRO = [
    ("Radar with a common scale from zero; minimum and maximum can be fixed (for example 1 to 5)", "✓", "✓"),
    ("Axes stay in place: data order (respects Sort by column in the model), name, or value of the first series", "✓", "✓"),
    ("Empty values drawn as a gap in the outline, never as zero; negative values with the zero ring marked", "✓", "✓"),
    ("Measures as axes, without unpivoting", "✓", "✓"),
    ("Up to 3 series, with a legend that says how many are drawn", "✓", "✓"),
    ("Fill, line width, curved lines, marker size and shape (or one shape per series)", "✓", "✓"),
    ("Grid as polygon or circle, spokes, ring values, rotation", "✓", "✓"),
    ("Data labels, axis labels on two lines when long, legend top, bottom or right", "✓", "✓"),
    ("6 style templates, including IBCS style; setup guide", "✓", "✓"),
    ("Notes on the data: dominant axis that flattens the others, values outside a fixed scale", "✓", "✓"),
    ("Cross-filtering, highlight, bookmarks, drilldown, context menu, report tooltips, keyboard, high contrast", "✓", "✓"),
    ("Number format of the measure, dynamic format strings included; format on the canvas; 12 languages", "✓", "✓"),
    ("4 to 12 series", "—", "✓"),
    ("Target with the gap per axis", "—", "✓"),
    ("Scale per axis (from the data or from Scale minimum/maximum), each axis labelling its own rings", "—", "✓"),
    ("“Lower is better” reversed axes, marked with ↓ and in the tooltip", "—", "✓"),
    ("% of target scale", "—", "✓"),
    ("Bands (low, middle, high) and a reference ring", "—", "✓"),
    ("Small multiples, or one radar per series without a panel field", "—", "✓"),
    ("Axis groups as named arcs and annotations from a text measure", "—", "✓"),
    ("Marker colour with conditional formatting (fx) rules", "—", "✓"),
    ("Value table and mean of the axes", "—", "✓"),
]

FORMAT = [
    ("Style template", "Clean, Classic, Minimal, Contrast, Compact, IBCS style. A template only fills what you have not set yourself. Setup guide: turn it back on to see the guide again."),
    ("Series", "One colour per series; fill opacity; line width; curved lines (interpolated between neighbouring axes, so a curve never goes beyond the values of the two axes it joins)."),
    ("Markers", "Show; size; shape — circle, square, diamond, triangle or one per series; marker colour with conditional formatting (fx) rules (Pro). Power BI evaluates the rules per point when there is no Series field, like native charts with a Legend field; with Series the fx button is not offered."),
    ("Data labels", "Show; text size and colour."),
    ("Scale", "Common to all axes, Per axis (Pro) or % of target (Pro); start at zero; automatic range or minimum and maximum; rings; “Lower is better” axes (Pro), as axis names separated by commas."),
    ("Grid", "Polygon or circle; line colour; spokes; ring values; rotation in degrees; text size and colour."),
    ("Axis labels", "Show; text size and colour; font; bold; maximum characters (0 = automatic: long names wrap onto two lines)."),
    ("Axis order", "Data order, name, or value of the first series; descending."),
    ("Target", "Target colour; show the gap per axis; colours above and below target."),
    ("Bands", "Show bands (Pro), where the first and second band end in % of the scale; low, middle and high colours; opacity. Drawn on the common or % of target scale."),
    ("Reference ring", "Show (Pro); value; label; colour."),
    ("Axis groups", "Text size and colour of the group names."),
    ("Annotations", "Show; text size and colour."),
    ("Center", "Mean of the axes (Pro): the mean position of a series on the scale, in % — in the centre with one series, in the legend with several."),
    ("Legend", "Show; position top, bottom or right; text size and colour."),
    ("Value table", "Show (Pro), below the chart, up to 35 % of the height with its own scroll: value per axis and series, target and gap; text size and colour; header background and text colour; alternate row colour."),
    ("Small multiples", "One radar per series (Pro); columns (0 = automatic); space between panels; title size, colour, bold and alignment; panel background and border."),
    ("Background", "Colour of the whole visual."),
]

FAQ = [
    ("How do I read a radar chart?",
     "<p>Each spoke is a criterion, and the further a point is from the centre, the higher the score. The shape shows the profile: where a "
     "series is strong and where it is weak. Compare shapes axis by axis. The area of a shape depends on the order of the axes, so do not read "
     "it as a total — the visual never calculates or shows an area.</p>"),
    ("Why does the scale start at zero and not move when I filter?",
     "<p>A radar that rescales with every filter makes 57 look like 100. The scale starts at zero by default and you can fix the minimum and "
     "maximum (for example 1 to 5) in Format → Scale. Turn off Start at zero only when zero has no meaning for your data.</p>"),
    ("My axes have different units and some look flat",
     "<p>On a common scale, an axis in ppm or euros flattens axes in % or points, and the visual names it in a note. Options: show the axes in "
     "separate visuals, normalise them in DAX, or use <strong>Scale → Per axis</strong> (Pro), where every axis has its own range and labels its "
     "own rings. With <strong>Scale minimum / maximum</strong> in the field wells, each axis uses the range you give it.</p>"),
    ("Price or delivery time: lower is better",
     "<p>Type the axis names in <strong>Scale → Lower is better</strong> (Pro), separated by commas. Those axes are reversed, so outward is "
     "always better; they show ↓ next to the name and say so in the tooltip.</p>"),
    ("Why do some outlines have gaps?",
     "<p>A gap is an empty value. Drawing it as zero would invent a bad score, so the outline stops there. A real zero is drawn.</p>"),
    ("Why does the axis order change when I filter?",
     "<p>It does not with Data order or Name. With <strong>Value of the first series</strong> the order follows the values, so it changes with "
     "them. To fix any order, use Sort by column on the axis field in the model and keep Data order.</p>"),
    ("Should Values be Sum or Average?",
     "<p>For scores, use <strong>Average</strong>. With several evaluations per supplier and criterion, Sum adds them up and the scale no longer "
     "means 1 to 5.</p>"),
    ("I have more than 3 series",
     "<p>The free version draws the first 3 in legend order and the legend says “3 of N series”. Pro draws up to 12. More than 4 or 5 shapes on "
     "one radar is hard to read: try small multiples, or <strong>One radar per series</strong> (Pro).</p>"),
    ("Conditional formatting (fx) does not colour the markers",
     "<p>Power BI evaluates conditional formatting rules per point only when there is no field in <strong>Series</strong>, as it does for native "
     "charts with a Legend field. Without Series — one shape, or small multiples — the rule colours each marker by its value.</p>"),
    ("How many rows can it use?",
     "<p>Power BI sends up to 30,000 combinations of axis, series and panel at a time. In the Power BI service the visual asks for further "
     "blocks, up to 20 more; in Power BI Desktop it uses the first block. A warning icon in the visual header says when rows were left out.</p>"),
    ("Do bookmarks keep my settings?",
     "<p>Bookmarks keep the points you select and the filters of the page. Like every Power BI visual, they do not keep formatting.</p>"),
    ("What is the \"Pro preview\" watermark?",
     "<p>While you edit a report without a licence, Pro features you turn on are drawn working under a watermark that names them, and Power BI "
     "shows its licence notice. Reading view shows the free result, with a small note naming the Pro features it leaves out. Where Power BI "
     "provides no licence information (for example when you are not signed in to Power BI Desktop), the free result is shown.</p>"),
    ("How do I get Pro?",
     "<p>On the visual's Microsoft AppSource page, choose <strong>Buy now</strong> (not Install free). Licences are per user and managed by "
     "Microsoft; restart Power BI Desktop after the licence is assigned. See <a href=\"https://tcviz.com/licensing.html\">tcviz.com/licensing</a>.</p>"),
    ("How are numbers formatted?",
     "<p>With the number format of each measure from the model, <strong>dynamic format strings</strong> included, in the report's language. "
     "Averages that are not whole numbers show up to two decimals when the format has none.</p>"),
    ("Is my data sent anywhere?",
     "<p>No. The visual makes no network requests and stores nothing outside your report. The links on the start screen open only when you click "
     "them, through Power BI.</p>"),
]


def table(headers, rows):
    th = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>"


def support():
    nav = '''<nav>
  <a href="#quickstart" class="active">Quick Start</a>
  <a href="#read">How to read it</a>
  <a href="#fields">Field Wells</a>
  <a href="#freepro">Free and Pro</a>
  <a href="#format">Format Pane</a>
  <a href="#interaction">Selection</a>
  <a href="#accessibility">Accessibility</a>
  <a href="#faq">FAQ</a>
  <a href="changelog.html">Changelog</a>
  <a href="#contact">Contact</a>
</nav>
'''
    video = (f'<div class="video-wrap"><iframe src="https://www.youtube.com/embed/{VIDEO.split("v=")[-1]}" title="{NAME} video" '
             f'allowfullscreen></iframe></div>') if VIDEO else ""
    faq = "".join(f'<details><summary>{html.escape(q)}</summary><div class="faq-body">{a}</div></details>' for q, a in FAQ)
    body = f'''<div class="wrap">

<div class="verpill">Visual v{VERSION} &nbsp;·&nbsp; docs updated {FECHA} &nbsp;·&nbsp; <a href="changelog.html">what's new</a></div>

<p class="lead">A radar (spider) chart that reads honestly: a common scale from zero that does not move when you filter, axes that stay in
place, and gaps where values are missing. The free version compares up to 3 series. <strong>Pro</strong> adds more series, a target with
the gap on every axis, a scale per axis and reversed axes, bands, small multiples, axis groups, annotations, conditional formatting (fx)
rules and a value table.</p>
{video}
<h2 id="quickstart">Quick Start</h2>
<div class="card">
<ol style="padding-left:20px;font-size:14px;color:var(--t2)">
<li>Add <strong>{html.escape(NAME)}</strong> to the page. With no fields it shows a start screen with these steps.</li>
<li>Drag the criteria to <strong>Axis</strong> — quality, price, delivery — and the score to <strong>Values</strong>, set to Average.</li>
<li>Drag what you compare to <strong>Series (legend)</strong> — supplier, employee, product.</li>
<li>Or, with survey data in columns, leave Axis empty and drag each question to Values: each measure becomes an axis.</li>
<li>The setup guide in the corner lists the optional fields and the style templates. Pro: add a <strong>Target</strong> or <strong>Small multiples</strong>.</li>
</ol>
</div>

<h2 id="read">How to read it</h2>
<div class="card">
<figure style="margin:0 0 14px">
<svg viewBox="0 0 640 250" role="img" aria-label="Annotated radar chart: axes, rings, two series, target and a gap" style="width:100%;max-width:640px;display:block;margin:0 auto">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#535146">
    <g fill="none" stroke="#D6D4D0">
      <path d="M200 25 L287 75 L287 175 L200 225 L113 175 L113 75 Z"/><path d="M200 75 L243 100 L243 150 L200 175 L157 150 L157 100 Z"/>
      <path d="M200 125 L200 25 M200 125 L287 75 M200 125 L287 175 M200 125 L200 225 M200 125 L113 175 M200 125 L113 75"/>
    </g>
    <path d="M200 40 L270 85 L252 155 L200 190 L139 160 L130 85 Z" fill="#2B6CB0" fill-opacity="0.18" stroke="#2B6CB0" stroke-width="2"/>
    <path d="M200 60 L260 90 L270 165 L200 170 L150 154" fill="none" stroke="#3E9C5B" stroke-width="2"/>
    <path d="M200 50 L265 88 L265 162 L200 200 L135 162 L135 88 Z" fill="none" stroke="#3D3929" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="200" y="17" text-anchor="middle">Quality</text><text x="295" y="72">Delivery</text><text x="295" y="182">Price ↓</text><text x="200" y="240" text-anchor="middle">Sustainability</text>
<text x="105" y="182" text-anchor="end">Service</text><text x="105" y="72" text-anchor="end">Risk</text>
    <text x="340" y="40" font-weight="700" fill="#2B6CB0">Series</text><text x="340" y="56">one shape per supplier</text>
    <text x="340" y="86" font-weight="700" fill="#3D3929">Target (dashed, Pro)</text><text x="340" y="102">the gap is shown on every axis</text>
    <text x="340" y="132" font-weight="700" fill="#3E9C5B">Gap in the outline</text><text x="340" y="148">no value for Risk: never drawn as zero</text>
    <text x="340" y="178" font-weight="700">Rings</text><text x="340" y="194">the common scale, from zero; ↓ = lower is better</text>
  </g>
</svg>
</figure>
<p>Read the radar axis by axis: further from the centre is a higher score (or a better one on axes marked ↓). Compare shapes where they
cross. The area of a shape depends on the order of the axes, so it is not a total.</p>
</div>

<h2 id="fields">Field Wells</h2>
{table(["Field", "Kind", "Required", "What it does"], [(f"<strong>{a}</strong>", b, c, d) for a, b, c, d in FIELDS])}

<h2 id="freepro">Free and Pro</h2>
{table(["Capability", "Free", "Pro"], FREE_PRO)}
<p>Turn on a Pro capability without a licence while editing and it is drawn working under a "Pro preview" watermark that names it.
Reading view shows the free result. Pro is sold per user on Microsoft AppSource.</p>

<h2 id="format">Format Pane</h2>
{table(["Card", "Settings"], [(f"<strong>{a}</strong>", b) for a, b in FORMAT])}
<p>Format on the canvas: in format mode, click the shapes, the grid, the axis labels, the legend or the background to format them where they are.</p>

<h2 id="interaction">Selection and interaction</h2>
<div class="card">
<ul>
<li>Click a point to filter the rest of the page by its axis and series; click an axis label to select the whole axis, or a legend item to select the whole series. Ctrl/Cmd + click adds; click again or click the background to clear.</li>
<li>With a target, the gap per axis is shown for the selected series (always, with one series).</li>
<li>Highlight: when another visual filters this one, the highlighted values are drawn over a faded outline.</li>
<li>Bookmarks restore the selection. Right-click opens the Power BI context menu. A hierarchy in Axis gives drilldown.</li>
<li>When the report author turns interactions off, clicks do not filter.</li>
</ul>
</div>

<h2 id="accessibility">Accessibility</h2>
<div class="card">
<ul>
<li>Keyboard: Tab into the visual, arrows move between points, Home/End jump to the first/last, Enter or Space selects, Esc clears, the context-menu key opens the menu. The tooltip opens on the focused point.</li>
<li>Each point has a description for screen readers with its series, axis and value; the chart describes its axes and series.</li>
<li>High contrast: the visual uses the colours of the Windows contrast theme and tells series apart by line pattern; marker shapes can also differ per series.</li>
<li>The layout adapts to the size of the visual: labels wrap or shorten, the legend gives way, ring values and labels are dropped in small panels, and the start screen has three layouts.</li>
</ul>
</div>

<h2 id="faq">FAQ</h2>
{faq}

<h2 id="contact">Contact</h2>
<div class="contact-box"><div class="icon">✉</div><div>
<h3>Questions, bugs, ideas</h3>
<p>Write to <a href="mailto:support@tcviz.com">support@tcviz.com</a> or open a thread in <a href="{REPO}/discussions" target="_blank">GitHub Discussions</a>.</p>
</div></div>

</div>
'''
    return page("Documentation", "Documentation", body, nav=nav, search=True)


def privacy():
    body = f'''<div class="wrap prose">
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> {FECHA} (version {VERSION})</p>
<h2>1. Overview</h2>
<p>{NAME} is a Power BI custom visual developed by TCViz (Tino Callarisa). This policy describes how data is handled when you use it.</p>
<h2>2. Data collection</h2>
<p>The visual <strong>does not collect, transmit or store any data</strong>. Every calculation — scales, gaps to target, the value table —
happens inside Power BI, on the data of your report.</p>
<h2>3. No network access</h2>
<p>The visual declares <strong>no network privileges</strong> (<code>"privileges": []</code>), so Power BI does not let it make any web request.
The icon on the start screen is bundled inside the visual.</p>
<p>The <em>Guide</em> and <em>Product page</em> links on the start screen ask Power BI to open those pages in your browser, only when you click
them (Power BI Desktop asks first). The visual sends nothing.</p>
<h2>4. Cookies and storage</h2>
<p>No cookies and no browser storage. Formatting settings are saved in your report by Power BI, like those of any visual.</p>
<h2>5. Licensing</h2>
<p>To know whether you have a Pro licence, the visual asks Microsoft's licensing API in Power BI (<code>IVisualLicenseManager</code>). TCViz receives
no data from this check. See the <a href="https://privacy.microsoft.com/privacystatement">Microsoft Privacy Statement</a>.</p>
<h2>6. Third parties</h2>
<p>No analytics, tracking or advertising.</p>
<h2>7. Contact</h2>
<p><a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</div>
'''
    return page("Privacy Policy", "Privacy Policy", body)


def terms():
    free = "; ".join(r[0][0].lower() + r[0][1:] for r in FREE_PRO if r[1] == "✓")
    pro = "; ".join(r[0][0].lower() + r[0][1:] for r in FREE_PRO if r[1] == "—")
    body = f'''<div class="wrap prose">
<h1>Terms of Use</h1>
<p><strong>Effective date:</strong> {FECHA} &nbsp;·&nbsp; applies to version {VERSION} and later</p>
<h2>1. Acceptance</h2>
<p>By installing or using {NAME} ("the Visual"), you agree to these Terms of Use. If you do not agree, do not install or use the Visual.</p>
<h2>2. License grant</h2>
<p>TCViz grants you a non-exclusive, non-transferable, revocable license to use the Visual within Microsoft Power BI, subject to these Terms
and any applicable Microsoft AppSource subscription terms.</p>
<p><strong>Free tier:</strong> available to all users at no cost. Includes: {html.escape(free)}.</p>
<p><strong>Pro tier:</strong> available through a Microsoft AppSource subscription, licensed per user. Adds: {html.escape(pro)}.
Without an active licence, Pro features are shown in edit mode only, as a preview marked with a watermark; reading view shows the free result.</p>
<h2>3. Restrictions</h2>
<ul>
<li>Do not reverse-engineer, decompile or disassemble the Visual, except where applicable law permits it.</li>
<li>Do not redistribute, resell, sublicense or transfer the Visual.</li>
<li>Do not remove or alter proprietary notices, branding or watermarks.</li>
<li>Do not use the Visual in breach of applicable laws.</li>
</ul>
<h2>4. Intellectual property</h2>
<p>The Visual, including its source code, design and documentation, is the intellectual property of TCViz. The source code is published on
GitHub for transparency and review; publication does not grant a licence to copy it or to build competing products.</p>
<h2>5. Disclaimer of warranties</h2>
<p>The Visual is provided "as is", without warranty of any kind, express or implied, including merchantability, fitness for a particular
purpose and non-infringement. TCViz does not warrant that the Visual will be error-free or uninterrupted.</p>
<h2>6. Limitation of liability</h2>
<p>To the maximum extent permitted by law, TCViz shall not be liable for any indirect, incidental, special, consequential or punitive damages
arising from the use of, or inability to use, the Visual.</p>
<h2>7. Updates</h2>
<p>TCViz may update the Visual and these Terms. Updated Terms are posted at this address with a new date; continued use means acceptance.</p>
<h2>8. Governing law</h2>
<p>These Terms are governed by the laws of Spain. Any dispute shall be resolved in the courts of Barcelona, Spain.</p>
<h2>9. Contact</h2>
<p><a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</div>
'''
    return page("Terms of Use", "Terms of Use", body)


def changelog():
    md = io.open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
    partes = re.split(r"^## ", md, flags=re.M)[1:]
    bloques = []
    for p in partes:
        cab, _, cuerpo = p.partition("\n")
        items = "".join(f"<li>{html.escape(l[2:].strip())}</li>" for l in cuerpo.splitlines() if l.startswith("- "))
        bloques.append(f'<div class="card"><h3>{html.escape(cab.strip())}</h3><ul>{items}</ul></div>')
    body = f'<div class="wrap prose"><h1>Changelog</h1><p>{NAME} · current version {VERSION}</p>{"".join(bloques)}</div>\n'
    return page("Changelog", "Changelog", body)


def main():
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    for nombre, f in (("support.html", support), ("privacy.html", privacy), ("terms.html", terms), ("changelog.html", changelog)):
        io.open(os.path.join(ROOT, "docs", nombre), "w", encoding="utf-8", newline="\n").write(f())
    io.open(os.path.join(ROOT, "docs", "index.html"), "w", encoding="utf-8", newline="\n").write(
        f'<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=support.html"><title>{NAME}</title><a href="support.html">Documentation</a>\n')
    print("docs:", sorted(os.listdir(os.path.join(ROOT, "docs"))))


if __name__ == "__main__":
    main()
