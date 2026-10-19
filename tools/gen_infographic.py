# -*- coding: utf-8 -*-
"""Infografías de la ficha (1366x768): docs/infographic.html y docs/infographic-pro.html, y sus PNG en assets/.

Imágenes de entrada (tools/img/): free.png (simulador: 3 proveedores, escala fija 0-5), pro.png (simulador: objetivo,
diferencia por eje y bandas) y desktop.png (Power BI Desktop: un radar por proveedor). python tools/gen_infographic.py
"""
import asyncio, base64, io, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "tools", "img")


def data_uri(name, width):
    im = Image.open(os.path.join(IMG, name)).convert("RGB")
    # Las capturas del simulador llevan un marco gris: se recorta al contenido.
    from PIL import ImageChops
    fondo = Image.new("RGB", im.size, im.getpixel((1, 1)))
    caja = ImageChops.difference(im, fondo).point(lambda v: 255 if v > 6 else 0).getbbox()
    if caja and name != "desktop.png":
        im = im.crop(caja)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


CSS = """
:root{--bg:#FAF9F5;--bg2:#EDE9DE;--line:#DAD9D4;--t1:#3D3929;--t2:#535146;--t3:#83827D;--acc:#2B6CB0;--accd:#1F4E80;--acc2:#3E9C5B;--acc2l:#E3F2E8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#888;font-family:'Segoe UI',system-ui,sans-serif}
#infographic{background:var(--bg);color:var(--t1);width:1366px;height:768px;overflow:hidden;padding:22px 34px 16px;display:flex;flex-direction:column;gap:14px}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.head h1{font-family:Poppins,'Segoe UI',sans-serif;font-size:32px;font-weight:700;line-height:1.05}
.head h1 span{color:var(--acc)}
.head p{font-size:15px;color:var(--t2);margin-top:6px;max-width:760px}
.brand{font-size:12px;color:var(--t3);text-align:right;line-height:1.5}
.brand b{color:var(--acc)}
.grid{display:grid;gap:16px;flex:1;min-height:0}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-height:0}
.card h3{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px}
.shot{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;min-height:0}
.shot img{width:100%;height:100%;object-fit:contain;display:block;min-height:0;flex:1}
.shot .cap{font-size:12px;color:var(--t3);padding:6px 4px 0}
.steps{list-style:none;display:grid;gap:7px}
.steps li{display:grid;grid-template-columns:24px 1fr;gap:8px;font-size:13.5px;color:var(--t2);align-items:start}
.steps b.n{width:22px;height:22px;border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px}
.steps strong{color:var(--t1)}
ul.l{list-style:none;display:grid;gap:5px}
ul.l li{font-size:13px;color:var(--t2);padding-left:18px;position:relative;line-height:1.35}
ul.l li::before{content:"";position:absolute;left:2px;top:6px;width:8px;height:8px;border-radius:2px;background:var(--acc)}
ul.l.pro li::before{background:var(--acc2)}
.big ul.l{gap:14px} .big ul.l li{font-size:15px} .big ul.l li::before{top:7px}
.chip{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.8px;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:middle}
.chip.free{background:#E6EEF8;color:var(--accd)} .chip.pro{background:var(--acc2l);color:#2F7A47}
.foot{display:flex;justify-content:space-between;font-size:12px;color:var(--t3)}
.foot b{color:var(--t2)}
"""

DIAGRAMA = """<svg viewBox="0 0 360 225" style="width:100%;display:block" aria-hidden="true">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#535146">
    <g fill="none" stroke="#D6D4D0">
      <path d="M130 20 L217 70 L217 170 L130 220 L43 170 L43 70 Z"/><path d="M130 70 L173 95 L173 145 L130 170 L87 145 L87 95 Z"/>
      <path d="M130 120 L130 20 M130 120 L217 70 M130 120 L217 170 M130 120 L130 220 M130 120 L43 170 M130 120 L43 70"/>
    </g>
    <path d="M130 35 L200 80 L182 150 L130 185 L69 155 L60 80 Z" fill="#2B6CB0" fill-opacity="0.18" stroke="#2B6CB0" stroke-width="2"/>
    <path d="M130 55 L190 85 L200 160 L130 165 L80 149" fill="none" stroke="#3E9C5B" stroke-width="2"/>
    <path d="M130 45 L195 83 L195 157 L130 195 L65 157 L65 83 Z" fill="none" stroke="#3D3929" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="236" y="40" font-weight="700" fill="#2B6CB0">Series</text><text x="236" y="54" font-size="11">one shape each</text>
    <text x="236" y="86" font-weight="700" fill="#3D3929">Target (Pro)</text><text x="236" y="100" font-size="11">gap on every axis</text>
    <text x="236" y="132" font-weight="700" fill="#3E9C5B">Gap</text><text x="236" y="146" font-size="11">empty, never zero</text>
    <text x="236" y="178" font-weight="700">Rings</text><text x="236" y="192" font-size="11">fixed scale from 0</text>
  </g></svg>"""


def page(title, body):
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>{title}</title>'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&display=swap">'
            f'<style>{CSS}</style></head><body><div id="infographic">{body}</div></body></html>\n')


def general():
    body = f"""
<div class="head"><div><h1>Radar &amp; Spider Chart <span>by TCViz</span></h1>
<p>Compare suppliers, people or products on several criteria at once — on a scale that does not move when you filter.</p></div>
<div class="brand"><b>tcviz.com</b><br>Power BI custom visual · no network requests</div></div>
<div class="grid" style="grid-template-columns:400px 1fr">
  <div style="display:flex;flex-direction:column;gap:14px;min-height:0">
    <div class="card"><h3>How to read it</h3>{DIAGRAMA}
      <p style="font-size:12.5px;color:var(--t2);margin-top:4px">Further out is better. Axes keep their order when you filter; the area is never read as a total.</p></div>
    <div class="card"><h3>Start in 3 steps</h3><ol class="steps">
      <li><b class="n">1</b><span><strong>Axis</strong> · the criteria: quality, price, delivery</span></li>
      <li><b class="n">2</b><span><strong>Values</strong> · the score, set to Average</span></li>
      <li><b class="n">3</b><span><strong>Series</strong> · what you compare: supplier, employee</span></li></ol></div>
    <div class="card" style="flex:1"><h3>Free <span class="chip free">FREE</span></h3><ul class="l">
      <li>3 series, fixed scale from zero, gaps for blanks</li><li>Measures as axes, no unpivoting</li>
      <li>6 templates incl. IBCS style; curves, shapes</li><li>Filtering, bookmarks, keyboard, 12 languages</li></ul></div>
  </div>
  <div class="shot"><img src="{data_uri('free.png', 1300)}" alt=""><div class="cap">Supplier evaluation, scored 1 to 5: Acme leads on quality and service, Borealis on delivery and sustainability. Free version, data labels on.</div></div>
</div>
<div class="foot"><span><b>Pro</b> adds up to 12 series, targets with the gap per axis, a scale per axis, bands, small multiples, axis groups, annotations and a value table.</span><span>Documentation: tinocallarisa-web.github.io/radar-chart</span></div>
"""
    return page("Radar & Spider Chart by TCViz — Visual Guide", body)


def pro():
    body = f"""
<div class="head"><div><h1>Radar &amp; Spider Chart <span>Pro</span></h1>
<p>Measure every profile against a target, on the scale each criterion needs — on your own data, in Power BI.</p></div>
<div class="brand"><b>tcviz.com</b><br>Pro preview while you edit · licence on Microsoft AppSource</div></div>
<div class="grid" style="grid-template-columns:850px 1fr">
  <div style="display:flex;flex-direction:column;gap:14px;min-height:0">
    <div class="shot" style="flex:none"><img src="{data_uri('desktop.png', 1300)}" alt="" style="height:auto"><div class="cap">Power BI Desktop · one radar per supplier, same scale, no panel field needed.</div></div>
    <div class="card big" style="flex:1"><h3>Pro <span class="chip pro">PRO</span></h3><ul class="l pro" style="grid-template-columns:1fr 1fr;column-gap:22px;row-gap:14px;margin-top:6px">
      <li>Up to <strong>12 series</strong></li>
      <li><strong>Target</strong> with the gap per axis</li>
      <li><strong>Scale per axis</strong>; lower-is-better axes</li>
      <li>Bands and a reference ring</li>
      <li><strong>Small multiples</strong> or one radar per series</li>
      <li>Axis groups, annotations, value table</li>
      <li>Conditional formatting (fx) on markers</li></ul></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;min-height:0">
    <div class="shot" style="flex:none"><img src="{data_uri('pro.png', 900)}" alt="" style="height:auto"><div class="cap">One supplier against the required level: the gap on every axis, in green or red.</div></div>
    <div class="card big" style="flex:1"><h3>Try it on your data</h3><ul class="l">
      <li>Turn on any Pro feature while editing: it is drawn working on your own data, under a “Pro preview” watermark.</li>
      <li>Free stays a complete, correct radar: Pro adds ways to compare, not the right answer.</li>
      <li>Everything is computed inside your report. No network requests.</li></ul></div>
  </div>
</div>
"""
    return page("Radar & Spider Chart by TCViz — Pro", body)


async def render(html_path, png_path):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1366, "height": 768})
        await pg.goto("file:///" + html_path.replace("\\", "/"))
        await pg.wait_for_timeout(800)
        el = await pg.query_selector("#infographic")
        await el.screenshot(path=png_path)
        await b.close()


def main():
    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    for nombre, f, png in (("infographic.html", general, "infographic.png"), ("infographic-pro.html", pro, "infographic-pro.png")):
        h = os.path.join(ROOT, "docs", nombre)
        io.open(h, "w", encoding="utf-8", newline="\n").write(f())
        asyncio.run(render(h, os.path.join(ROOT, "assets", png)))
        print(nombre, "->", png, Image.open(os.path.join(ROOT, "assets", png)).size)


if __name__ == "__main__":
    main()
