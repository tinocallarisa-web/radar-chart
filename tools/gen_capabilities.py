# -*- coding: utf-8 -*-
"""Genera capabilities.json y tools/caps_en.json a partir de una sola definición.

Las demás lenguas salen de tools/i18n.py (mismas claves). Ejecutar desde la raíz del repo:
    python tools/gen_capabilities.py && python tools/extract_ui.py && python tools/i18n.py
"""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROLES = [
    ("axis", "Axis", "Grouping", "One spoke per value: skill, criterion, KPI. A hierarchy gives drilldown. Without it, each measure in Values is an axis."),
    ("values", "Values", "Measure", "The score on each axis. With Axis and no Series, each measure is a series."),
    ("series", "Series (legend)", "Grouping", "One shape per value: supplier, employee, product. Free shows 3; Pro up to 12."),
    ("target", "Target (Pro)", "Measure", "Required level per axis: a dashed shape and the gap on every axis."),
    ("scaleMin", "Scale minimum (Pro)", "Measure", "Bottom of the scale per axis, for a scale per axis."),
    ("scaleMax", "Scale maximum (Pro)", "Measure", "Top of the scale per axis, such as the maximum points of each question."),
    ("axisGroup", "Axis group (Pro)", "Grouping", "Groups of axes drawn as named arcs: technical, personal."),
    ("note", "Note (Pro)", "Measure", "A text measure shown next to the point as an annotation."),
    ("panel", "Small multiples (Pro)", "Grouping", "One radar per value, on a shared scale."),
    ("tooltips", "Tooltips", "Measure", "Extra values in the tooltip."),
]

def E(*items):
    return [{"value": v, "displayName": n, "displayNameKey": k} for v, k, n in items]

# (objeto, nombre, [(prop, nombre, tipo)])  tipo: bool | num | text | color | colorfx | enum:[...]
OBJECTS = [
    ("style", "Style template", [
        ("template", "Template", E(("clean", "Enum_tpl_clean", "Clean"), ("classic", "Enum_tpl_classic", "Classic"),
                                    ("minimal", "Enum_tpl_minimal", "Minimal"), ("contrast", "Enum_tpl_contrast", "Contrast"),
                                    ("compact", "Enum_tpl_compact", "Compact"), ("ibcs", "Enum_tpl_ibcs", "IBCS style"))),
        ("guide", "Setup guide", "bool"),
    ]),
    ("series", "Series", [
        ("fill", "Color", "color"),
        ("fillOpacity", "Fill opacity %", "num"),
        ("lineWidth", "Line width", "num"),
    ]),
    ("markers", "Markers", [
        ("show", "Show", "bool"),
        ("size", "Size", "num"),
        ("fill", "Marker color (Pro rules)", "colorfx"),
    ]),
    ("labels", "Data labels", [
        ("show", "Show", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
    ]),
    ("scale", "Scale", [
        ("mode", "Scale", E(("common", "Enum_sc_common", "Common to all axes"), ("perAxis", "Enum_sc_perAxis", "Per axis (Pro)"),
                             ("target", "Enum_sc_target", "% of target (Pro)"))),
        ("zero", "Start at zero", "bool"),
        ("auto", "Automatic range", "bool"),
        ("min", "Minimum", "num"),
        ("max", "Maximum", "num"),
        ("rings", "Rings", "num"),
        ("reversed", "Lower is better (Pro): axis names, comma separated", "text"),
    ]),
    ("grid", "Grid", [
        ("shape", "Shape", E(("polygon", "Enum_gr_polygon", "Polygon"), ("circle", "Enum_gr_circle", "Circle"))),
        ("color", "Line color", "color"),
        ("spokes", "Spokes", "bool"),
        ("ringLabels", "Ring values", "bool"),
        ("fontSize", "Text size", "num"),
        ("labelColor", "Text color", "color"),
    ]),
    ("axisLabels", "Axis labels", [
        ("show", "Show", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
        ("fontFamily", "Font", "text"),
        ("bold", "Bold", "bool"),
        ("maxChars", "Maximum characters (0 = automatic)", "num"),
    ]),
    ("axisOrder", "Axis order", [
        ("by", "Order axes by", E(("data", "Enum_ao_data", "Data order"), ("name", "Enum_ao_name", "Name"),
                                  ("value", "Enum_ao_value", "Value of the first series"))),
        ("descending", "Descending", "bool"),
    ]),
    ("target", "Target", [
        ("color", "Target color", "color"),
        ("showGap", "Show the gap per axis", "bool"),
        ("goodColor", "Above target color", "color"),
        ("badColor", "Below target color", "color"),
    ]),
    ("bands", "Bands", [
        ("show", "Show bands (Pro)", "bool"),
        ("low", "First band ends at %", "num"),
        ("high", "Second band ends at %", "num"),
        ("lowColor", "Low band color", "color"),
        ("midColor", "Middle band color", "color"),
        ("highColor", "High band color", "color"),
        ("opacity", "Band opacity %", "num"),
    ]),
    ("axisGroups", "Axis groups", [
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
    ]),
    ("annotations", "Annotations", [
        ("show", "Show", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
    ]),
    ("center", "Center", [
        ("axesMean", "Mean of the axes (Pro)", "bool"),
    ]),
    ("legend", "Legend", [
        ("show", "Show", "bool"),
        ("position", "Position", E(("top", "Enum_lg_top", "Top"), ("bottom", "Enum_lg_bottom", "Bottom"), ("right", "Enum_lg_right", "Right"))),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
    ]),
    ("valueTable", "Value table", [
        ("show", "Show table (Pro)", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
        ("headerBackground", "Header background", "color"),
        ("headerColor", "Header text color", "color"),
        ("banding", "Alternate row color", "color"),
    ]),
    ("smallMultiples", "Small multiples", [
        ("columns", "Columns (0 = automatic)", "num"),
        ("gap", "Space between panels", "num"),
        ("titleSize", "Title size", "num"),
        ("titleColor", "Title color", "color"),
        ("titleBold", "Bold title", "bool"),
        ("titleAlign", "Title alignment", E(("left", "Enum_al_left", "Left"), ("center", "Enum_al_center", "Center"))),
        ("background", "Panel background", "color"),
        ("border", "Panel border", "bool"),
        ("borderColor", "Panel border color", "color"),
    ]),
    ("background", "Background", [
        ("color", "Color", "color"),
    ]),
]

def ptype(t):
    if t == "bool": return {"bool": True}
    if t == "num": return {"numeric": True}
    if t == "text": return {"text": True}
    if t in ("color", "colorfx"): return {"fill": {"solid": {"color": True}}}
    return {"enumeration": t}

def main():
    en = {}
    roles = []
    for name, disp, kind, desc in ROLES:
        k = f"Role_{name}"
        en[k] = disp; en[k + "_Desc"] = desc
        roles.append({"name": name, "kind": kind, "displayName": disp, "displayNameKey": k,
                      "description": desc, "descriptionKey": k + "_Desc"})
    objects = {}
    for obj, disp, props in OBJECTS:
        en[f"Obj_{obj}"] = disp
        p = {}
        for prop, pd, t in props:
            key = f"Prop_{obj}_{prop}"
            en[key] = pd
            p[prop] = {"displayName": pd, "displayNameKey": key, "type": ptype(t)}
            if isinstance(t, list):
                for it in t: en[it["displayNameKey"]] = it["displayName"]
        objects[obj] = {"displayName": disp, "displayNameKey": f"Obj_{obj}", "properties": p}
    caps = {
        "dataRoles": roles,
        "dataViewMappings": [{
            "conditions": [{"values": {"max": 40}, "series": {"max": 1}, "target": {"max": 1}, "scaleMin": {"max": 1},
                            "scaleMax": {"max": 1}, "axisGroup": {"max": 1}, "note": {"max": 1}, "panel": {"max": 1}}],
            "categorical": {
                "categories": {
                    "select": [{"bind": {"to": "axis"}}, {"bind": {"to": "axisGroup"}}, {"bind": {"to": "panel"}}],
                    "dataReductionAlgorithm": {"window": {"count": 30000}},
                },
                "values": {
                    "group": {
                        "by": "series",
                        "select": [{"bind": {"to": "values"}}, {"bind": {"to": "target"}}, {"bind": {"to": "scaleMin"}},
                                   {"bind": {"to": "scaleMax"}}, {"bind": {"to": "note"}}, {"bind": {"to": "tooltips"}}],
                        "dataReductionAlgorithm": {"top": {"count": 60}},
                    }
                },
            },
        }],
        "objects": objects,
        "tooltips": {"supportedTypes": {"default": True, "canvas": True}, "roles": ["tooltips"]},
        "drilldown": {"roles": ["axis"]},
        "sorting": {"default": {}},
        "supportsHighlight": True,
        "supportsLandingPage": True,
        "supportsEmptyDataView": True,
        "supportsKeyboardFocus": True,
        "supportsMultiVisualSelection": True,
        "privileges": [],
        "supportsOnObjectFormatting": True,
        "enablePointerEventsFormatMode": True,
    }
    io.open(os.path.join(ROOT, "capabilities.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(caps, indent=2, ensure_ascii=False) + "\n")
    io.open(os.path.join(ROOT, "tools", "caps_en.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(en, indent=2, ensure_ascii=False) + "\n")
    print("capabilities.json:", len(roles), "roles,", len(objects), "objects,", len(en), "keys")

if __name__ == "__main__":
    main()
