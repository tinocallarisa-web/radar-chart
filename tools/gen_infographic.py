# -*- coding: utf-8 -*-
"""Infografías y capturas de la ficha del Radar (1366x768, assets/) con la plantilla común de la web.

Plantilla: C:/tcviz/datos/demo_rtm/infografias.py (la misma del Treemap). El texto de la infografía general sale de la
ficha web (C:/tcviz/web/src/data.js, producto radar-chart); lo que allí sigue en 1.0.0 (las seis plantillas propias)
se corrige aquí abajo en FICHA_1_0_1 hasta que se actualice la ficha web.
Las imágenes son del simulador (tools/simulador/capturas/60_* a 62_*), que carga el visual real con
test_visuales/Radar/evaluacion_proveedores.csv; ninguna lleva la marca de agua "Pro preview" (la build de prueba fuerza Pro).
Por eso ningún pie dice "Power BI Desktop".

    node build-test.js && cp -r .tmp/drop .tmp/drop_pro && python tools/simulador/harness.py ficha && python tools/gen_infographic.py
Salida: assets/infographic.png, infographic-pro.png, Screenshot_1..4.png; docs/infographic.html e infographic-pro.html
(autocontenidos, imágenes incrustadas). Los HTML de trabajo y los PNG 2x quedan en .tmp/ficha (no se suben a la web:
la infografía de tcviz.com es otra, hecha desde Desktop con Begudes Nord).
"""
import base64, html, mimetypes, os, re, shutil, subprocess, sys, tempfile
sys.path.insert(0, r"C:\tcviz\datos\demo_rtm")
import infografias as I
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, "tools", "simulador", "capturas")
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, ".tmp", "ficha")
os.makedirs(OUT, exist_ok=True)
e = html.escape
CSS = I.CSS % {"pop": I.uri(os.path.join(I.BASE, "tema", "Poppins"))}
LOGO = I.uri(os.path.join(I.WEB, "logos", "tcviz-logo-light.svg"))
cap = lambda n: I.uri(os.path.join(CAP, n + ".png"))

P = {p["id"]: p for p in I.productos()}["radar-chart"]
# 1.0.1: estilos de la colección en lugar de las seis plantillas propias (la ficha web aún dice "6 templates incl. IBCS").
for f in P["features"]:
    if f["id"] == "F07":
        f["name"] = "Report theme or 6 collection styles"
# Los tres pozos principales y el resto en una línea: con los nueve, la plantilla corta la tarjeta de campos.
RESTO = [r["role"] for r in P["dataRoles"][3:]]
P["dataRoles"] = P["dataRoles"][:3]
# En la columna Pro la plantilla corta a dos líneas: la de los grupos de ejes no cabía.
P["freemium"]["pro"] = [x.replace("Axis groups, annotations, a value table and the mean of the axes", "Axis groups, annotations, value table, axes mean")
                        for x in P["freemium"]["pro"]]
DATOS = "Sample data: supplier evaluation scored 1 to 5, fictitious companies"


def autocontenido(h_html, destino):
    """Copia el HTML con cada file:/// incrustado como data URI, para que docs/ no apunte a C:/."""
    t = open(h_html, encoding="utf-8").read()

    def incrusta(m):
        ruta = m.group(1).replace("file:///", "").replace("/", os.sep)
        tipo = mimetypes.guess_type(ruta)[0] or ("font/ttf" if ruta.endswith(".ttf") else "application/octet-stream")
        return "data:%s;base64,%s" % (tipo, base64.b64encode(open(ruta, "rb").read()).decode())
    t = re.sub(r"(file:///[^'\")\s]+)", incrusta, t)
    open(destino, "w", encoding="utf-8", newline="\n").write(t)


def render(h_html, nombre):
    png2x = os.path.join(OUT, nombre + "@2x.png")
    png1x = os.path.join(ASSETS, nombre + ".png")
    subprocess.run([I.EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    "--allow-file-access-from-files", f"--screenshot={png2x}", "--window-size=1366,768", I.uri(h_html)],
                   capture_output=True, timeout=90)
    Image.open(png2x).convert("RGB").resize((1366, 768), Image.LANCZOS).save(png1x, optimize=True)
    print("  ", os.path.relpath(png1x, ROOT))


def cabecera(titulo, sub, tier='<span class="pill free">Free</span><span class="pill pro">Pro</span>'):
    return (f'<div class="cab"><img class="logo" src="{LOGO}"><div class="sep"></div>'
            f'<div><h1>{e(titulo)}</h1><p>{e(sub)}</p></div><div class="tier">{tier}</div></div><div class="raya"></div>')


PIE = (f'<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span>'
       f'<span>{e(DATOS)} · drawn by the visual, Report theme</span></div>')


def pagina(nombre, cuerpo, extra_css=""):
    h = os.path.join(OUT, nombre + ".html")
    open(h, "w", encoding="utf-8").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{extra_css}</style></head><body>{cuerpo}</body></html>')
    return h


# 1. Infografía general: plantilla común de la web, con la imagen principal en el centro
tmp = tempfile.mkdtemp()
try:
    shutil.copy(os.path.join(CAP, "60_central.png"), os.path.join(tmp, "central_99.png"))
    exp, I.EXP = I.EXP, tmp
    ficha = I.ficha(P, 99, "Which supplier meets the required level?")
    I.EXP = exp
    viejo = "Sample report on Begudes Nord, a fictitious drinks company — Power BI Desktop, TCViz theme"
    assert viejo in ficha   # la imagen es del simulador y con otros datos: el pie de la plantilla mentiría
    ficha = ficha.replace(viejo, DATOS + " — drawn by the visual, Report theme; target and bands are Pro")
    fin_campos = '</div></div>\n<div class="der">'
    assert ficha.count(fin_campos) == 1
    ficha = ficha.replace(fin_campos, f'<div class="mas">+ {len(RESTO)} more: {e(", ".join(RESTO))}</div>' + fin_campos)
    h1 = os.path.join(OUT, "infographic.html")
    open(h1, "w", encoding="utf-8").write(ficha)
    render(h1, "infographic")
    autocontenido(h1, os.path.join(ROOT, "docs", "infographic.html"))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# 2. Free frente a Pro con el mismo dato
DOS = """.dos{position:absolute;left:24px;right:24px;top:115px;bottom:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dos .card{padding:14px 16px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.dos .im{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center}
.dos img{max-width:100%;max-height:100%;border-radius:4px;display:block;border:1px solid #EEE}
.dos h2{font-size:16px} .dos .f h2{color:#3E9C5B} .dos .p h2{color:#2B6CB0}
.dos ul{list-style:none;margin-top:10px;columns:2;column-gap:18px}
.dos li{font-size:12.5px;line-height:1.35;padding-left:16px;position:relative;margin-bottom:6px;break-inside:avoid}
.dos .f li:before{content:'✓';color:#3E9C5B;position:absolute;left:0;font-weight:700}
.dos .p li:before{content:'+';color:#2B6CB0;position:absolute;left:0;font-weight:700}
.sub{font-size:12.5px;color:#666;margin:-4px 0 8px}"""
free_items = ["Up to 3 series on a fixed scale from zero", "Axes keep their order when you filter", "Gaps for empty values, never zeros",
              "Measures as axes, no unpivoting", "Report theme or 6 collection styles", "Filtering, bookmarks, keyboard, 12 languages"]
li = lambda xs: "".join(f"<li>{e(x)}</li>" for x in xs)
h2 = pagina("infographic-pro", cabecera("Free compares three. Pro measures all of them.", f'{P["name"]} — the same supplier evaluation, without and with a licence.') + f"""
<div class="dos">
<div class="card f"><h2>Free — a complete radar chart</h2><div class="sub">Three suppliers on one scale from 0 to 5, labels on.</div>
<div class="im"><img src="{cap('60_free')}"></div><ul>{li(free_items)}</ul></div>
<div class="card p"><h2>Pro — one radar per supplier, against the target</h2><div class="sub">All five suppliers, the same scale, the required level dashed.</div>
<div class="im"><img src="{cap('60_pro_sm')}"></div><ul>{li(P["freemium"]["pro"])}</ul></div>
</div>
<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span><span>Without a licence, Pro features are drawn working under a "Pro preview" watermark while you edit.</span></div>""", DOS)
render(h2, "infographic-pro")
autocontenido(h2, os.path.join(ROOT, "docs", "infographic-pro.html"))

# 3. Capturas de la ficha: una idea por imagen
UNA = """.una{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:flex;gap:16px}
.una .card{padding:14px;display:flex;align-items:center;justify-content:center;flex:1;min-width:0}
.una img{max-width:100%;max-height:100%;display:block}
.una .lado{flex:0 0 330px;flex-direction:column;align-items:flex-start;justify-content:flex-start}
.una .lado h2{font-size:17px;margin-bottom:8px} .una .lado p{font-size:13.5px;line-height:1.45;color:#444;margin-bottom:10px}
.tres{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:1.55fr 1fr;grid-template-rows:322px 1fr;gap:14px}
.tres .card{padding:10px;display:flex;flex-direction:column;align-items:flex-start;min-height:0;overflow:hidden}
.tres .l{grid-row:1 / span 2}
.tres img{display:block;border:1px solid #EEE}
.tres b{font-size:12.5px;margin-bottom:6px;color:#555}
.est{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:12px}
.est .card{padding:8px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.est img{flex:1 1 auto;min-height:0;width:100%;object-fit:contain;display:block;border-radius:3px} .est b{font-size:12.5px;margin-top:5px;color:#555}"""


def una(n, titulo, sub, img, lado_h, lado_p):
    ps = "".join(f"<p>{e(x)}</p>" for x in lado_p)
    h = pagina(f"Screenshot_{n}", cabecera(titulo, sub) + f"""<div class="una"><div class="card"><img src="{cap(img)}"></div>
<div class="card lado"><h2>{e(lado_h)}</h2>{ps}</div></div>""" + PIE, UNA)
    render(h, f"Screenshot_{n}")


una(1, "Which supplier meets the required level?", "Three suppliers on one fixed scale, the required level dashed and bands for low, middle and high (Pro).",
    "60_hero", "Read it in one pass",
    ["Further out is better. The scale starts at zero and stays at 0 to 5 when you filter, so a 3 always looks like a 3.",
     "The dashed shape is the required level on every axis: Borealis Parts clears it on delivery, price and sustainability; Cobalt & Co only on price, and meets it on delivery.",
     "The green ring marks 4 to 5, the amber one 2.5 to 4.",
     "Free draws the same radar with up to three series; the target and the bands are Pro."])
una(2, "The gap on every axis", "Target (Pro): one supplier against the required level, the difference written on each axis.",
    "60_pro_gap", "Where it falls short, in numbers",
    ["Drop the required level into Target: it is drawn as a dashed shape on the same scale.",
     "Each axis shows the gap: green where the supplier meets or beats it, red where it falls short.",
     "Acme Metals is 0.9 short on delivery and 0.8 on sustainability, and above target on quality and risk.",
     "With several series, the gaps appear for the series you select; a % of target scale is also available."])
w = lambda px: f"{px * 0.82:.0f}px"   # las tres a la misma escala: 0,82 px de imagen por px del visual
h3 = pagina("Screenshot_3", cabecera("Readable at any size", "The same visual and settings in a large, medium and small slot, all at the same scale: axis names shorten and the legend keeps what fits.") + f"""
<div class="tres"><div class="card l"><b>Large · 900 × 520</b><img src="{cap('61_size_l')}" style="width:{w(900)}"></div>
<div class="card"><b>Medium · 520 × 330</b><img src="{cap('61_size_m')}" style="width:{w(520)}"></div>
<div class="card"><b>Small · 300 × 170</b><img src="{cap('61_size_s')}" style="width:{w(300)}"></div></div>""" + PIE, UNA)
render(h3, "Screenshot_3")
est = "".join(f'<div class="card"><img src="{cap("62_style_" + s)}"><b>{s.title()}</b></div>'
              for s in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"))
h4 = pagina("Screenshot_4", cabecera("Six collection styles, free", "The same looks as the rest of TCViz, so a page with other TCViz visuals reads as one report. Or keep the Report theme.") +
            f'<div class="est">{est}</div>' + PIE.replace(", Report theme", ""), UNA)
render(h4, "Screenshot_4")
print("ok")
