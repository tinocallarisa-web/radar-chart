# -*- coding: utf-8 -*-
"""Simulador Playwright del radar: formato dinámico, accesibilidad, marca de agua y las dos formas de datos sin Eje.

Carga un bundle de prueba con un host simulado y un dataView categorical construido desde
test_visuales/Radar/evaluacion_proveedores.csv (media de Score por proveedor y criterio, Required como objetivo).
No reproduce el motor de Power BI: tooltips, menús, licencia y la FORMA REAL del dataView solo se ven en Desktop.

Bundles (copias de .tmp/drop tras cada build):
    node build-test.js --free && cp -r .tmp/drop .tmp/drop_free
    node build-test.js        && cp -r .tmp/drop .tmp/drop_pro
    .tmp/old = el 1.0.0.0 publicado (_releases/), para comparar el fallo de "medidas como ejes + Serie".
Uso:  python tools/simulador/harness.py   → tools/simulador/capturas/*.png
      python tools/simulador/harness.py estilos   → solo los estilos de la colección (50_*)
"""
import asyncio, csv, io, json, os, sys
from collections import OrderedDict
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
DATA = r"C:\tcviz\test_visuales\Radar\evaluacion_proveedores.csv"
ROWS = list(csv.DictReader(io.open(DATA, encoding="utf-8-sig")))

STUB = r"""
window.__ev = [];
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
window.__mk = function(LIC){
 const PAL = ['#118DFF','#12239E','#E66C37','#6B007B','#E044A7','#744EC2','#D9B300','#D64550','#197278','#1AAB40'];
 let pi = 0; const pmap = {};
 function mkId(k){ return { __k:k, getKey(){return k;}, getSelector(){return {k};}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && o.__k===k; } }; }
 window.__menu = [];
 const h = {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push('X'); console.error('FAILED', m); } },
  createSelectionManager(){ return { select(){ return Promise.resolve([]); }, clear(){ return Promise.resolve(); }, getSelectionIds(){ return []; },
     hasSelection(){ return false; }, registerOnSelectCallback(){}, showContextMenu(id){ __menu.push(id && id.__k || '{}'); return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ const k=[]; return { withCategory(c,i){ k.push(c.source.queryName+'='+c.values[i]); return this; },
     withMeasure(m){ k.push(m); return this; }, withSeries(v,g){ k.push('g='+g.name); return this; }, createSelectionId(){ return mkId(k.join('|')); } }; },
  createLocalizationManager(){ return { getDisplayName(k){ return k; } }; },
  tooltipService: { show(){}, move(){}, hide(){} },
  subSelectionService: { subSelect(){}, updateRegionOutlines(){} },
  hostCapabilities: { allowInteractions: true }, locale: 'en-US',
  colorPalette: { isHighContrast:false, foreground:{value:'#252423'}, background:{value:'#FFFFFF'}, foregroundSelected:{value:'#1AEBFF'},
    getColor(k){ if (!(k in pmap)) pmap[k] = PAL[(pi++) % PAL.length]; return {value: pmap[k]}; } },
  fetchMoreData(){ return false; }, persistProperties(){}, launchUrl(){}, displayWarningIcon(){}, hideWarningIcon(){},
 };
 if (LIC) h.licenseManager = { getAvailableServicePlans(){ return Promise.resolve({ plans: [], isLicenseUnsupportedEnv: false, isLicenseInfoAvailable: true }); },
   notifyFeatureBlocked(){}, notifyLicenseRequired(){}, clearLicenseNotification(){ return Promise.resolve(true); } };
 return h;
};
// Convierte la especificación JSON en un dataView con values.grouped().
window.__dv = function(spec){
 if (!spec) return null;
 const cat = spec.categorical;
 let vals = cat.values;
 const groups = spec.groups;
 if (groups) {
   // Como Desktop (DIAG 18-11): cada grupo con su identity, y values.source = la columna de Serie.
   vals = []; groups.forEach(g => { g.identity = g.identity || { key: 'grp:' + g.name }; g.values.forEach(c => { c.source.groupName = g.name; vals.push(c); }); });
   vals.grouped = () => groups;
   if (spec.seriesSource) vals.source = spec.seriesSource;
 } else { vals.grouped = () => [{ values: vals }]; }
 cat.values = vals;
 return spec;
};
"""


def src(name, query, role, fmt=None, measure=False):
    s = {"displayName": name, "queryName": query, "roles": {role: True}}
    if fmt: s["format"] = fmt
    if measure: s["isMeasure"] = True
    return s


def agg():
    """Media de Score y de Required por (proveedor, criterio), en orden de aparición."""
    acc = OrderedDict()
    for r in ROWS:
        k = (r["Supplier"], r["Criterion"])
        a = acc.setdefault(k, [0.0, 0, 0.0, 0])
        a[0] += float(r["Score"]); a[1] += 1
        if r["Required"]: a[2] += float(r["Required"]); a[3] += 1
    sup = list(OrderedDict.fromkeys(k[0] for k in acc))
    crit = list(OrderedDict.fromkeys(k[1] for k in acc))
    return acc, sup, crit


def dv_con_eje(n_sup=3, dyn=None, target=True, objects=None):
    """Axis = Criterion, Series = Supplier (valores agrupados), Values = Score, Target = Required."""
    acc, sup, crit = agg()
    sup = sup[:n_sup]
    axis = {"source": src("Criterion", "T.Criterion", "axis"), "values": crit}
    groups, cols = [], [axis["source"], src("Supplier", "T.Supplier", "series")]
    for s in sup:
        sc = {"source": src("Score", "Avg(T.Score)", "values", "0", True), "values": [round(acc[(s, c)][0] / acc[(s, c)][1], 2) for c in crit]}
        if dyn:
            sc["objects"] = [{"general": {"formatString": dyn(c)}} for c in crit]
        g = {"name": s, "values": [sc]}
        if target:
            g["values"].append({"source": src("Required", "Avg(T.Required)", "target", "0", True),
                                "values": [round(acc[(s, c)][2] / max(1, acc[(s, c)][3]), 2) for c in crit]})
        groups.append(g)
        cols.append(sc["source"])
    return {"metadata": {"columns": cols, "objects": objects or {}}, "categorical": {"categories": [axis]}, "groups": groups}


def dv_medidas_agrupadas(n_sup=3):
    """Forma A: sin Eje, una medida por criterio y la Serie como agrupación de valores (sin categorías)."""
    acc, sup, crit = agg()
    groups, cols = [], [src("Supplier", "T.Supplier", "series")]
    for s in sup[:n_sup]:
        vs = [{"source": src(c, "Avg(" + c + ")", "values", "0.0", True), "values": [round(acc[(s, c)][0] / acc[(s, c)][1], 2)]} for c in crit]
        groups.append({"name": s, "values": vs})
        cols += [v["source"] for v in vs]
    return {"metadata": {"columns": cols, "objects": {}}, "categorical": {}, "groups": groups}


def dv_medidas_serie_categoria(n_sup=3):
    """Forma B: sin Eje, la Serie llega como columna de categoría (una fila por proveedor) y una columna por medida."""
    acc, sup, crit = agg()
    sup = sup[:n_sup]
    sc = {"source": src("Supplier", "T.Supplier", "series"), "values": sup}
    vs = [{"source": src(c, "Avg(" + c + ")", "values", "0.0", True), "values": [round(acc[(s, c)][0] / acc[(s, c)][1], 2) for s in sup]} for c in crit]
    return {"metadata": {"columns": [sc["source"]] + [v["source"] for v in vs], "objects": {}},
            "categorical": {"categories": [sc], "values": vs}}


async def shot(browser, bundle, name, dv, W=760, H=480, view=0, lic=False, hc=False, keys=None, menu=False, clicks=None):
    drop = os.path.join(ROOT, ".tmp", bundle)
    guid = json.load(io.open(os.path.join(drop, "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]
    pg = await browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.set_content(f"<html><body style='margin:0;background:#FFFFFF'><div id='host' style='position:relative;width:{W}px;height:{H}px;overflow:hidden'></div></body></html>")
    await pg.add_style_tag(path=os.path.join(drop, "visual.css"))
    await pg.add_script_tag(content=STUB)
    await pg.add_script_tag(path=os.path.join(drop, "visual.js"))
    await pg.evaluate("""([g, lic, hc]) => { window.__host = __mk(lic);
        if (hc) Object.assign(__host.colorPalette, { isHighContrast: true, foreground:{value:'#FFFF00'}, background:{value:'#000000'}, foregroundSelected:{value:'#00FFFF'} });
        window.__v = powerbi.visuals.plugins[g].create({ element: document.getElementById('host'), host: __host }); }""", [guid, lic, hc])
    await pg.evaluate("([dv, W, H, vm]) => __v.update({ dataViews: dv ? [__dv(dv)] : [], viewport: {width: W, height: H}, type: 2, operationKind: 0, viewMode: vm })",
                      [dv, W, H, view])
    await pg.wait_for_timeout(500)
    for sel in clicks or []:
        await pg.click(sel)
        await pg.wait_for_timeout(200)
    if keys:
        await pg.focus("g[data-pt][tabindex='0']")
        for k in keys: await pg.keyboard.press(k)
        await pg.wait_for_timeout(200)
    info = await pg.evaluate("""() => ({ shapes: document.querySelectorAll('g[data-shape]').length,
        legend: document.querySelectorAll('g[data-series]').length,
        labels: Array.from(document.querySelectorAll('g[data-pt] text')).slice(0, 3).map(t => t.textContent),
        rings: Array.from(document.querySelectorAll('.tcrd-rings text')).slice(0, 3).map(t => t.textContent),
        table: Array.from(document.querySelectorAll('.tcrd-table td.num')).slice(0, 3).map(t => t.textContent),
        dashes: Array.from(document.querySelectorAll('g[data-shape] path[stroke-dasharray]')).map(p => p.getAttribute('stroke-dasharray')).filter(Boolean).length,
        wm: (document.querySelector('.tcviz-wm') || {}).textContent || '',
        oldwm: !!document.querySelector('.tcrd-watermark'),
        minFont: Math.min(...Array.from(document.querySelectorAll('svg text, svg g[font-size]')).map(t => parseFloat(t.getAttribute('font-size') || '99'))),
        bg: getComputedStyle(document.querySelector('.tcrd')).backgroundImage !== 'none' ? 'degradado' : getComputedStyle(document.querySelector('.tcrd')).backgroundColor,
        font: getComputedStyle(document.querySelector('.tcrd')).fontFamily.split(',')[0],
        series: Array.from(document.querySelectorAll('g[data-series] line')).map(l => l.getAttribute('stroke')),
        chips: Array.from(document.querySelectorAll('.tcrd-g-chip')).map(c => c.textContent + (c.getAttribute('aria-pressed') === 'true' ? '*' : '')),
        focus: document.activeElement && document.activeElement.getAttribute('data-pt') ? getComputedStyle(document.activeElement.querySelector('.tcrd-hit')).stroke + ' ' + getComputedStyle(document.activeElement.querySelector('.tcrd-hit')).strokeWidth : '' })""")
    if menu:
        info["menu"] = await pg.evaluate("""(axes) => { for (const ax of axes) for (const g of document.querySelectorAll('g[data-pt]')) {
            if (g.getAttribute('data-pt').split('\\u0001')[1] === ax) g.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); }
            return __menu; }""", menu)
    await pg.screenshot(path=os.path.join(OUT, name + ".png"))
    ev = await pg.evaluate("() => __ev.join('')")
    await pg.close()
    print(f"  {name:34s} {bundle:10s} eventos {ev}  {json.dumps(info, ensure_ascii=False)}  {'ERRORES: ' + '; '.join(errs[:3]) if errs else ''}")


async def main():
    os.makedirs(OUT, exist_ok=True)
    # Formato dinámico de ejemplo: el criterio Price en euros y el resto en puntos (como haría una medida con
    # "Formato dinámico" en el modelo). La cadena estática de la columna es "0".
    dyn = lambda c: '"€"0.00' if c == "Price" else '0.0" pts"'
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # Estilos de la colección (1.0.1): los siete, con objetivo, bandas, anillo de referencia, etiquetas y tabla.
        full = {"labels": {"show": True}, "valueTable": {"show": True}, "bands": {"show": True}, "reference": {"show": True, "value": 3}}
        print("Estilos de la colección:")
        for k in ["clean", "boardroom", "ledger", "editorial", "signal", "aurora", "terrace"]:
            await shot(b, "drop_pro", "50_estilo_" + k, dv_con_eje(n_sup=3, objects={"style": {"template": k, "guide": False}, **full}), H=560)
        sm = dv_medidas_serie_categoria(4)
        sm["metadata"]["objects"] = {"style": {"template": "aurora"}}
        await shot(b, "drop_pro", "51_aurora_serie_sin_eje", sm)
        for old, new in [("classic", "ledger"), ("ibcs", "ledger"), ("compact", "clean")]:
            await shot(b, "drop_pro", f"52_guardado_{old}_se_lee_{new}", dv_con_eje(n_sup=3, objects={"style": {"template": old, "guide": False}}))
        # Un ajuste puesto a mano gana al estilo; alto contraste gana a todo.
        await shot(b, "drop_pro", "53_boardroom_rejilla_a_mano", dv_con_eje(objects={"style": {"template": "boardroom", "guide": False}, "grid": {"color": {"solid": {"color": "#FF0000"}}}}))
        await shot(b, "drop_pro", "54_boardroom_alto_contraste", dv_con_eje(objects={"style": {"template": "boardroom", "guide": False}}), hc=True)
        # Guía, paso de estilos (editando): rejilla con los siete.
        await shot(b, "drop_free", "55_guia_estilos", dv_con_eje(objects={"style": {"template": "ibcs"}}), view=1, lic=True, clicks=[".tcrd-g-main"])
        if "estilos" in sys.argv:
            await b.close(); return
        print("Bug 5 — medidas como ejes + Serie:")
        await shot(b, "old", "05a_bug_formaB_1.0.0.0", dv_medidas_serie_categoria())
        await shot(b, "drop_pro", "05b_fix_formaB_1.0.1", dv_medidas_serie_categoria(5))
        await shot(b, "old", "05c_formaA_1.0.0.0", dv_medidas_agrupadas())
        await shot(b, "drop_pro", "05d_formaA_1.0.1", dv_medidas_agrupadas(5))
        print("F11 — formato dinámico:")
        await shot(b, "old", "11a_dinamico_1.0.0.0", dv_con_eje(dyn=dyn, objects={"labels": {"show": True}, "valueTable": {"show": True}}))
        await shot(b, "drop_pro", "11b_dinamico_1.0.1", dv_con_eje(dyn=dyn, objects={"labels": {"show": True}, "valueTable": {"show": True}}))
        await shot(b, "drop_pro", "11c_dinamico_por_eje_1.0.1", dv_con_eje(n_sup=1, dyn=dyn, objects={"labels": {"show": True}, "scale": {"mode": "perAxis"}}))
        print("D10 — accesibilidad:")
        await shot(b, "drop_pro", "10a_patrones", dv_con_eje(n_sup=5, target=False, objects={"accessibility": {"patterns": True}}))
        await shot(b, "drop_pro", "10b_alto_contraste_on", dv_con_eje(n_sup=4, target=False, objects={"accessibility": {"highContrast": "on"}}))
        await shot(b, "drop_pro", "10c_alto_contraste_windows", dv_con_eje(n_sup=4, target=False), hc=True)
        await shot(b, "drop_pro", "10d_texto_minimo_14", dv_con_eje(objects={"style": {"template": "compact"}, "labels": {"show": True}, "accessibility": {"minTextSize": 14}}))
        await shot(b, "drop_pro", "10e_foco_rojo_4px", dv_con_eje(objects={"accessibility": {"focusColor": {"solid": {"color": "#D13438"}}, "focusWidth": 4}}), keys=["ArrowRight"])
        print("Marca de agua común (free, editando, sin licencia):")
        await shot(b, "drop_free", "20_marca_agua_comun", dv_con_eje(n_sup=5), view=1, lic=True)
        print("Menú contextual (eje en dos grupos = un punto con dos filas):")
        mm = dv_con_eje(n_sup=1, target=False)
        crit = mm["categorical"]["categories"][0]["values"]
        mm["categorical"]["categories"] = [{"source": src("Criterion", "T.Criterion", "axis"), "values": crit + [crit[0]]},
                                           {"source": src("Area", "T.Area", "axisGroup"), "values": ["A"] * len(crit) + ["B"]}]
        for g in mm["groups"]:
            for c in g["values"]: c["values"] = c["values"] + [None]
        await shot(b, "old", "30a_menu_varias_filas_1.0.0.0", mm, menu=[crit[0], crit[1]])
        await shot(b, "drop_pro", "30b_menu_varias_filas_1.0.1", mm, menu=[crit[0], crit[1]])
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
