#!/usr/bin/env node
/**
 * build-test.js — Radar & Spider Chart by TCViz
 *
 * Empaqueta una build de PRUEBA y restaura los fuentes al salir, pase lo que pase:
 *   node build-test.js          -> _test     (Pro forzado: isPro = true)
 *   node build-test.js --free   -> _testfree (licencia real: sin licencia = vista previa / gratuito)
 * Con el guid real, Power BI Desktop serviría la versión instalada desde AppSource y no la tuya.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const free = process.argv.includes("--free");
const PBIVIZ = path.join(__dirname, "pbiviz.json");
const VISUAL = path.join(__dirname, "src", "visual.ts");
const origP = fs.readFileSync(PBIVIZ, "utf8");
const origV = fs.readFileSync(VISUAL, "utf8");

let restored = false;
const restore = () => {
    if (restored) return;
    fs.writeFileSync(PBIVIZ, origP, "utf8");
    fs.writeFileSync(VISUAL, origV, "utf8");
    restored = true;
    console.log("  ↺ fuentes restaurados al estado de producción");
};
process.on("exit", restore);
process.on("SIGINT", () => { restore(); process.exit(1); });

const json = JSON.parse(origP);
if (json.visual.guid.endsWith("_test") || json.visual.guid.endsWith("_testfree")) {
    console.error("❌ El guid ya lleva sufijo de prueba: restaura pbiviz.json antes de seguir.");
    process.exit(1);
}
const suffix = free ? "_testfree" : "_test";
// Power BI Desktop guarda cada visual por guid + versión: con la misma versión sigue sirviendo el paquete
// anterior aunque importes uno nuevo. Cada build de prueba lleva su propio último dígito (contador local).
const CONTADOR = path.join(__dirname, ".tmp", "test-build-counter");
fs.mkdirSync(path.dirname(CONTADOR), { recursive: true });
const n = (parseInt(fs.existsSync(CONTADOR) ? fs.readFileSync(CONTADOR, "utf8") : "0", 10) || 0) + 1;
fs.writeFileSync(CONTADOR, String(n), "utf8");
const partes = json.visual.version.split(".");
partes[3] = String(Number(partes[3]) + n);
json.visual.version = partes.join(".");
json.visual.guid += suffix;
json.visual.displayName += free ? " (test free)" : " (test)";
fs.writeFileSync(PBIVIZ, JSON.stringify(json, null, 2) + "\n", "utf8");

const debug = process.argv.includes("--debug");
let vsrc = origV;
if (debug) {
    if (vsrc.indexOf("const DEBUG_SEL = false;") === -1) { console.error("❌ No encuentro DEBUG_SEL en visual.ts"); process.exit(1); }
    vsrc = vsrc.replace("const DEBUG_SEL = false;", "const DEBUG_SEL = true; // PATCHED BY build-test.js --debug");
    json.visual.guid += "DIAG";
    json.visual.displayName += " DIAG";
    fs.writeFileSync(PBIVIZ, JSON.stringify(json, null, 2) + "\n", "utf8");
    fs.writeFileSync(VISUAL, vsrc, "utf8");
}
if (!free) {
    const FIND = "    private isPro = false;";
    if (origV.indexOf(FIND) === -1) { console.error("❌ No encuentro '" + FIND.trim() + "' en visual.ts: actualiza build-test.js."); process.exit(1); }
    fs.writeFileSync(VISUAL, vsrc.replace(FIND, "    private isPro = true; // PATCHED BY build-test.js"), "utf8");
}
try {
    execSync("npx pbiviz package", { stdio: "inherit", cwd: __dirname });
    console.log("  ✓ Test build created: dist/" + json.visual.guid + "." + json.visual.version + ".pbiviz");
} catch (e) {
    console.error("❌ La build ha fallado.");
    process.exitCode = 1;
} finally {
    restore();
}
