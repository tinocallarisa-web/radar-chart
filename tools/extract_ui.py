# -*- coding: utf-8 -*-
"""Saca de src/visual.ts las claves de texto propias (t("Clave", "inglés")) que no están en capabilities."""
import io, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.path.join(ROOT, "src", "visual.ts"), encoding="utf-8").read()
caps = json.load(io.open(os.path.join(ROOT, "tools", "caps_en.json"), encoding="utf-8"))
ui = {}
for m in re.finditer(r'(?:this\.t|\bT)\(\s*"([A-Za-z0-9_]+)"\s*,\s*"([^"]*)"', src):
    k, v = m.group(1), m.group(2)
    if k not in caps:
        ui.setdefault(k, v)
io.open(os.path.join(ROOT, "tools", "ui_en.json"), "w", encoding="utf-8", newline="\n").write(json.dumps(ui, indent=1, ensure_ascii=False) + "\n")
if __name__ == "__main__":
    print(len(caps), "claves de capabilities,", len(ui), "propias")
    for k, v in ui.items():
        print(k, "=", v)
