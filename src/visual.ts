"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
    SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";
import { Scale, frac, ringScale } from "./scale";
import { STRINGS } from "./strings";
import { LANDING_ICON } from "./landingIcon";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

const SVG = "http://www.w3.org/2000/svg";

// ─── Licencia ─────────────────────────────────────────────────────────────────

/** Plan de pago. El Service ID que llega es editor.oferta.plan; se acepta también el Plan ID solo. */
const PLAN_IDS = ["radar-pro"];
/** Y cualquier otro plan de pago de esta oferta (tramos, anual, privados) sin sacar versión. */
const OFFER_PREFIX = "tino_callarisa.radar-tcviz.";
const STATE_ACTIVE = 1;
const STATE_WARNING = 2;
/** LicenseNotificationType.General: const enum, en runtime hace falta el número. */
const NOTIFY_GENERAL = 0;
/** Diagnóstico de selección: build-test.js --debug lo pone a true. En producción, siempre false. */
const DEBUG_SEL = false;

/** Series que dibuja la versión gratuita (decisión de Tino, 19-10-2026) y tope del Pro. */
const FREE_SERIES = 3;
const MAX_SERIES = 12;
const MAX_AXES = 40;

function matchesPlan(sp: string, planId: string): boolean {
    return sp === planId || sp.endsWith("." + planId);
}
function isOurPaidPlan(spIdentifier: unknown): boolean {
    const sp = String(spIdentifier ?? "");
    if (PLAN_IDS.some(id => matchesPlan(sp, id))) return true;
    return sp.startsWith(OFFER_PREFIX) && !/free/i.test(sp.slice(OFFER_PREFIX.length));
}

/** Enlaces de la pantalla de inicio. ?ref= cuenta en la web las visitas que llegan desde el visual. */
const URL_GUIDE = "https://tinocallarisa-web.github.io/radar-chart/support.html";
const URL_PRODUCT = "https://tcviz.com/product/radar-chart/?ref=visual-radar";
const URL_VIDEO = "";

// ─── Ajustes ──────────────────────────────────────────────────────────────────

interface Settings {
    template: string; guide: boolean;
    fillOpacity: number; lineWidth: number;
    markers: boolean; markerSize: number; markerColor: string;
    labels: boolean; labelFont: number; labelColor: string;
    scaleMode: string; zero: boolean; auto: boolean; min: number; max: number; rings: number; reversed: string;
    gridShape: string; gridColor: string; spokes: boolean; ringLabels: boolean; gridFont: number; gridLabelColor: string;
    axLabels: boolean; axFont: number; axColor: string; axFamily: string; axBold: boolean; axMaxChars: number;
    orderBy: string; descending: boolean;
    targetColor: string; showGap: boolean; goodColor: string; badColor: string;
    bands: boolean; bandLow: number; bandHigh: number; bandLowColor: string; bandMidColor: string; bandHighColor: string; bandOpacity: number;
    groupFont: number; groupColor: string;
    notes: boolean; noteFont: number; noteColor: string;
    axesMean: boolean;
    legend: boolean; legendPos: string; legendFont: number; legendColor: string;
    table: boolean; tableFont: number; tableColor: string; tableHeaderBg: string; tableHeaderColor: string; tableBanding: string;
    smCols: number; smGap: number; smTitleSize: number; smTitleColor: string; smTitleBold: boolean; smTitleAlign: string;
    smBackground: string; smBorder: boolean; smBorderColor: string;
    background: string;
}

const DEFAULTS: Settings = {
    template: "clean", guide: true,
    fillOpacity: 18, lineWidth: 2,
    markers: true, markerSize: 3.5, markerColor: "",
    labels: false, labelFont: 10, labelColor: "#3D3929",
    scaleMode: "common", zero: true, auto: true, min: 0, max: 5, rings: 5, reversed: "",
    gridShape: "polygon", gridColor: "#D6D4D0", spokes: true, ringLabels: true, gridFont: 9, gridLabelColor: "#83827D",
    axLabels: true, axFont: 11, axColor: "#3D3929", axFamily: "", axBold: false, axMaxChars: 0,
    orderBy: "data", descending: false,
    targetColor: "#3D3929", showGap: true, goodColor: "#107C10", badColor: "#C4314B",
    bands: false, bandLow: 50, bandHigh: 80, bandLowColor: "#E8A39B", bandMidColor: "#F2D38B", bandHighColor: "#A9D8B8", bandOpacity: 30,
    groupFont: 11, groupColor: "#2B6CB0",
    notes: true, noteFont: 9, noteColor: "#605E5C",
    axesMean: false,
    legend: true, legendPos: "top", legendFont: 11, legendColor: "#605E5C",
    table: false, tableFont: 11, tableColor: "#3D3929", tableHeaderBg: "#F3F2F1", tableHeaderColor: "", tableBanding: "",
    smCols: 0, smGap: 8, smTitleSize: 12, smTitleColor: "#3D3929", smTitleBold: true, smTitleAlign: "left",
    smBackground: "", smBorder: false, smBorderColor: "#E1DFDD",
    background: "",
};

/**
 * Plantillas: un punto de partida. Solo rellenan lo que el usuario no ha tocado: un ajuste escrito
 * a mano (presente en metadata.objects) gana siempre a la plantilla.
 */
const TEMPLATES: Record<string, Partial<Settings>> = {
    clean: {},
    classic: { gridShape: "circle", fillOpacity: 10, lineWidth: 2, gridColor: "#C8C6C4" },
    minimal: { fillOpacity: 0, spokes: false, markers: false, ringLabels: false, gridColor: "#E6E4E0" },
    contrast: { fillOpacity: 35, lineWidth: 3, gridColor: "#A19F9D", axBold: true, axColor: "#252423" },
    compact: { axFont: 9, gridFont: 8, markerSize: 2.5, legendFont: 9, lineWidth: 1.5 },
    // Estética de IBCS (sobria, grises, sin adornos). Es un estilo: no afirma cumplimiento del estándar.
    ibcs: { fillOpacity: 0, lineWidth: 1.5, gridColor: "#D9D9D9", targetColor: "#000000", axColor: "#262626",
        gridLabelColor: "#595959", legendColor: "#262626", tableColor: "#262626", markers: true, markerSize: 3 },
};

/** Tonos de gris para el estilo IBCS: las series se distinguen por gris y trazo, no por colores del tema. */
const IBCS_GREYS = ["#262626", "#7F7F7F", "#BFBFBF", "#404040", "#A6A6A6", "#595959"];
const HC_DASH = ["", "6 3", "2 3", "8 3 2 3", "1 2", "10 4"];

type Objects = powerbi.DataViewObjects | undefined;

function readSettings(objects: Objects): Settings {
    const tplName = (objects?.["style"]?.["template"] as string) || DEFAULTS.template;
    const tpl = TEMPLATES[tplName] || {};
    const pick = <K extends keyof Settings>(obj: string, prop: string, key: K): Settings[K] => {
        const raw = objects?.[obj]?.[prop];
        if (raw !== undefined && raw !== null) {
            if (typeof raw === "object" && (raw as any).solid) return (raw as any).solid.color as Settings[K];
            return raw as Settings[K];
        }
        return (tpl[key] !== undefined ? tpl[key] : DEFAULTS[key]) as Settings[K];
    };
    return {
        template: tplName, guide: pick("style", "guide", "guide"),
        fillOpacity: pick("series", "fillOpacity", "fillOpacity"), lineWidth: pick("series", "lineWidth", "lineWidth"),
        markers: pick("markers", "show", "markers"), markerSize: pick("markers", "size", "markerSize"), markerColor: pick("markers", "fill", "markerColor"),
        labels: pick("labels", "show", "labels"), labelFont: pick("labels", "fontSize", "labelFont"), labelColor: pick("labels", "color", "labelColor"),
        scaleMode: pick("scale", "mode", "scaleMode"), zero: pick("scale", "zero", "zero"), auto: pick("scale", "auto", "auto"),
        min: pick("scale", "min", "min"), max: pick("scale", "max", "max"), rings: pick("scale", "rings", "rings"), reversed: pick("scale", "reversed", "reversed"),
        gridShape: pick("grid", "shape", "gridShape"), gridColor: pick("grid", "color", "gridColor"), spokes: pick("grid", "spokes", "spokes"),
        ringLabels: pick("grid", "ringLabels", "ringLabels"), gridFont: pick("grid", "fontSize", "gridFont"), gridLabelColor: pick("grid", "labelColor", "gridLabelColor"),
        axLabels: pick("axisLabels", "show", "axLabels"), axFont: pick("axisLabels", "fontSize", "axFont"), axColor: pick("axisLabels", "color", "axColor"),
        axFamily: pick("axisLabels", "fontFamily", "axFamily"), axBold: pick("axisLabels", "bold", "axBold"), axMaxChars: pick("axisLabels", "maxChars", "axMaxChars"),
        orderBy: pick("axisOrder", "by", "orderBy"), descending: pick("axisOrder", "descending", "descending"),
        targetColor: pick("target", "color", "targetColor"), showGap: pick("target", "showGap", "showGap"),
        goodColor: pick("target", "goodColor", "goodColor"), badColor: pick("target", "badColor", "badColor"),
        bands: pick("bands", "show", "bands"), bandLow: pick("bands", "low", "bandLow"), bandHigh: pick("bands", "high", "bandHigh"),
        bandLowColor: pick("bands", "lowColor", "bandLowColor"), bandMidColor: pick("bands", "midColor", "bandMidColor"),
        bandHighColor: pick("bands", "highColor", "bandHighColor"), bandOpacity: pick("bands", "opacity", "bandOpacity"),
        groupFont: pick("axisGroups", "fontSize", "groupFont"), groupColor: pick("axisGroups", "color", "groupColor"),
        notes: pick("annotations", "show", "notes"), noteFont: pick("annotations", "fontSize", "noteFont"), noteColor: pick("annotations", "color", "noteColor"),
        axesMean: pick("center", "axesMean", "axesMean"),
        legend: pick("legend", "show", "legend"), legendPos: pick("legend", "position", "legendPos"),
        legendFont: pick("legend", "fontSize", "legendFont"), legendColor: pick("legend", "color", "legendColor"),
        table: pick("valueTable", "show", "table"), tableFont: pick("valueTable", "fontSize", "tableFont"),
        tableColor: pick("valueTable", "color", "tableColor"), tableHeaderBg: pick("valueTable", "headerBackground", "tableHeaderBg"),
        tableHeaderColor: pick("valueTable", "headerColor", "tableHeaderColor"), tableBanding: pick("valueTable", "banding", "tableBanding"),
        smCols: pick("smallMultiples", "columns", "smCols"), smGap: pick("smallMultiples", "gap", "smGap"),
        smTitleSize: pick("smallMultiples", "titleSize", "smTitleSize"), smTitleColor: pick("smallMultiples", "titleColor", "smTitleColor"),
        smTitleBold: pick("smallMultiples", "titleBold", "smTitleBold"), smTitleAlign: pick("smallMultiples", "titleAlign", "smTitleAlign"),
        smBackground: pick("smallMultiples", "background", "smBackground"), smBorder: pick("smallMultiples", "border", "smBorder"),
        smBorderColor: pick("smallMultiples", "borderColor", "smBorderColor"),
        background: pick("background", "color", "background"),
    };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

// ─── Modelo ───────────────────────────────────────────────────────────────────

interface Axis {
    key: string; name: string; group: string | null;
    format: string | undefined;      // formato propio (medidas como ejes); si no, el de la serie
    reversed: boolean;
}

interface Series {
    key: string; name: string; color: string;
    format: string | undefined;
    selector: powerbi.data.Selector | undefined;   // para el color por serie en el panel de formato
}

interface Pt {
    key: string; panel: string | null; axis: string; si: number;
    value: number | null; hl: number | null; target: number | null; smin: number | null; smax: number | null;
    note: string; ids: ISelectionId[]; rule: string | null;
    tips: { name: string; value: string }[];
}

interface ProFeature { id: string; label: string; }

// ─── Visual ───────────────────────────────────────────────────────────────────

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLDivElement;
    private svg: SVGSVGElement;
    private tableEl: HTMLDivElement;
    private landingEl: HTMLDivElement;
    private watermarkEl: HTMLDivElement;
    private noteEl: HTMLDivElement;
    private guideEl: HTMLDivElement;
    private selectionManager: ISelectionManager;
    private events: powerbi.extensibility.IVisualEventService;
    private loc: powerbi.extensibility.ILocalizationManager;
    private s: Settings = DEFAULTS;
    private axes: Axis[] = [];
    private series: Series[] = [];
    private panels: (string | null)[] = [null];
    private pts = new Map<string, Pt>();
    private totalSeries = 0;
    private totalAxes = 0;
    private measuresAsAxes = false;
    private hasTarget = false;
    private hasHighlights = false;
    private allInt = true;
    private ruleColorsUsed = false;
    private lastOptions: VisualUpdateOptions | null = null;
    private lastDv: DataView | undefined;
    private hasData = false;
    private focusKey = "";
    private restoredIds: ISelectionId[] = [];
    /** Clave de identidad -> punto, para casar selecciones y marcadores sin recorrer miles de identidades. */
    private idToPt = new Map<string, string>();
    private keySeq = 0;
    private keyboardNav = false;
    /** Formato desde el lienzo (on-object): el clic selecciona qué formatear, no filtra datos. */
    public visualOnObjectFormatting: powerbi.extensibility.visual.VisualOnObjectFormatting;
    private subSelectionHelper: HtmlSubSelectionHelper;
    private formatMode = false;
    /** Paso del asistente (2 = campos, 3 = estilo). El 1 es la pantalla de inicio. */
    private guideStep = 2;
    /** Filas por bloques: Power BI entrega 30.000 cada vez; el visual pide las siguientes. */
    private lastFetchCount = 0;
    private fetchRounds = 0;
    private truncatedAt = 0;
    private readonly MAX_FETCH_ROUNDS = 20;

    // Licencia
    private isPro = false;
    private licenseRequested = false;
    private licenseResolved = false;
    private licenseEnvUnsupported = false;
    private lastBlockedNotice = "";
    private licenseIconShown = false;
    private licenseIconTimer: number | null = null;
    private destroyed = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.loc = options.host.createLocalizationManager();
        this.selectionManager = options.host.createSelectionManager();

        this.root = document.createElement("div");
        this.root.className = "tcrd";
        options.element.appendChild(this.root);
        this.svg = document.createElementNS(SVG, "svg") as SVGSVGElement;
        this.svg.setAttribute("role", "listbox");
        this.svg.setAttribute("aria-multiselectable", "true");
        this.root.appendChild(this.svg);
        this.tableEl = document.createElement("div");
        this.tableEl.className = "tcrd-table";
        this.root.appendChild(this.tableEl);
        this.landingEl = document.createElement("div");
        this.landingEl.className = "tcrd-landing";
        this.root.appendChild(this.landingEl);
        this.noteEl = document.createElement("div");
        this.noteEl.className = "tcrd-note";
        this.root.appendChild(this.noteEl);
        this.watermarkEl = document.createElement("div");
        this.watermarkEl.className = "tcrd-watermark";
        this.watermarkEl.setAttribute("aria-hidden", "true");
        this.root.appendChild(this.watermarkEl);
        this.guideEl = document.createElement("div");
        this.guideEl.className = "tcrd-guide";
        this.root.appendChild(this.guideEl);

        this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
            hostElement: options.element,
            subSelectionService: options.host.subSelectionService,
            selectionIdCallback: () => undefined,
        });
        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subs) => this.getSubSelectionStyles(subs),
            getSubSelectionShortcuts: (subs) => this.getSubSelectionShortcuts(subs),
            getSubSelectables: (filter) => this.subSelectionHelper.getAllSubSelectables(filter),
        };

        this.svg.addEventListener("click", (e) => {
            if ((e.target as Element).closest?.("[data-pt],[data-axis],[data-series]")) return;
            if (!this.canInteract || this.formatMode) return;
            this.selectionManager.clear().then(() => this.paintSelection());
        });
        this.svg.addEventListener("contextmenu", (e) => {
            if ((e.target as Element).closest?.("[data-pt]")) return;
            e.preventDefault();
            if (!this.canInteract) return;
            this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
        });
        // Marcadores y selección hecha desde fuera: solo repintar. Nunca persistProperties aquí.
        // Al restaurar un marcador Power BI pasa aquí los IDs; getSelectionIds() puede no tenerlos todavía.
        this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => { this.restoredIds = ids || []; this.paintSelection(); });
    }

    public destroy(): void {
        this.destroyed = true;
        this.cancelLicenseIcon();
    }

    private get canInteract(): boolean {
        // hostCapabilities es donde la API 5.x lo pone; host.allowInteractions solo existía en versiones antiguas.
        const h: any = this.host;
        return (h.hostCapabilities?.allowInteractions ?? h.allowInteractions) !== false;
    }

    // ── Textos ────────────────────────────────────────────────────────────────

    /**
     * Primero la tabla del bundle (src/strings.ts): Power BI Desktop solo traduce con getDisplayName
     * las claves declaradas en capabilities.json, y los textos propios del visual no lo están.
     */
    private t(key: string, fallback: string): string {
        const own = this.stringsFor()?.[key];
        if (own) return own;
        try { const v = this.loc.getDisplayName(key); return v && v !== key ? v : fallback; } catch { return fallback; }
    }

    private stringsFor(): Record<string, string> | undefined {
        const loc = String((this.host as any)?.locale || "");
        if (!loc || /^en/i.test(loc)) return undefined;
        if (STRINGS[loc]) return STRINGS[loc];
        const lang = loc.split("-")[0].toLowerCase();
        const k = Object.keys(STRINGS).sort().find(x => x.toLowerCase().startsWith(lang + "-"));
        return k ? STRINGS[k] : undefined;
    }

    private get culture(): string { return (this.host as any).locale; }

    // ── Update ────────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            this.lastOptions = options;
            const dv = options.dataViews?.[0];
            this.lastDv = dv;
            this.s = readSettings(dv?.metadata?.objects);
            this.formatMode = !!(options as any).formatMode;
            this.subSelectionHelper.setFormatMode(this.formatMode);
            if (dv && this.streamSegments(options, dv)) {
                // Se ha pedido el siguiente bloque: Power BI volverá a llamar a update() con todo junto.
                this.events.renderingFinished(options);
                return;
            }
            this.hasData = this.readData(dv);
            if (this.hasData) this.requestLicense();
            this.draw();
            this.updateOutlines(options);
            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
            console.error("[Radar]", e);
        }
    }

    private get isDesktop(): boolean {
        const env = Number((this.host as any)?.hostEnv);
        return isFinite(env) && env > 0 ? (env & 4) !== 0 : false;
    }

    private streamSegments(options: VisualUpdateOptions, dv: DataView): boolean {
        const op = (options as any).operationKind;
        if (op !== 1 && op !== 2) { this.lastFetchCount = 0; this.fetchRounds = 0; }   // Append y Segment continúan; el resto empieza de cero
        this.truncatedAt = 0;
        if (!dv.metadata?.segment) return false;
        const loaded = dv.categorical?.categories?.[0]?.values?.length ?? 0;
        if (!this.isDesktop && loaded > this.lastFetchCount && this.fetchRounds < this.MAX_FETCH_ROUNDS) {
            this.lastFetchCount = loaded;
            this.fetchRounds++;
            if (this.host.fetchMoreData(true)) return true;
        }
        this.truncatedAt = loaded;
        return false;
    }

    // ── Pro: qué se pide y qué se dibuja ──────────────────────────────────────

    private isEditing(): boolean {
        const vm = (this.lastOptions as any)?.viewMode;
        return typeof vm === "number" && vm !== 0;
    }

    /** Vista previa: sin licencia, editando y con la licencia ya leída. En lectura, siempre el resultado gratuito. */
    private isPreview(): boolean {
        return !this.isPro && this.isEditing() && this.licenseResolved && !this.licenseEnvUnsupported;
    }

    private get proActive(): boolean {
        return this.isPro || this.isPreview();
    }

    private roleBound(role: string): boolean {
        return !!this.lastDv?.metadata?.columns?.some(c => c.roles?.[role]);
    }

    /** Funciones de pago que el informe está pidiendo ahora (con nombre para la marca y el aviso). */
    private attemptedPro(): ProFeature[] {
        const s = this.s, out: ProFeature[] = [];
        const add = (on: boolean, id: string, key: string, fb: string) => { if (on) out.push({ id, label: this.t(key, fb) }); };
        add(this.totalSeries > FREE_SERIES, "series", "Feat_series", "more than 3 series");
        add(this.roleBound("target"), "target", "Feat_target", "target");
        add(s.scaleMode === "perAxis" || s.scaleMode === "target" || this.roleBound("scaleMin") || this.roleBound("scaleMax"), "scale", "Feat_scale", "scale per axis");
        add(!!s.reversed.trim(), "reversed", "Feat_reversed", "reversed axes");
        add(s.bands, "bands", "Feat_bands", "bands");
        add(this.roleBound("panel"), "panel", "Feat_panel", "small multiples");
        add(this.roleBound("axisGroup"), "groups", "Feat_groups", "axis groups");
        add(this.roleBound("note"), "notes", "Feat_notes", "annotations");
        add(this.ruleColorsUsed, "rules", "Feat_rules", "color rules");
        add(s.table, "table", "Feat_table", "value table");
        add(s.axesMean, "mean", "Feat_mean", "mean of the axes");
        return out;
    }

    /** Ajustes que se dibujan: sin Pro activo, cada función de pago vuelve a su valor gratuito. */
    private effective(): Settings {
        if (this.proActive) return this.s;
        const s = { ...this.s };
        s.scaleMode = "common"; s.reversed = ""; s.bands = false; s.table = false; s.axesMean = false;
        return s;
    }

    // ── Datos ─────────────────────────────────────────────────────────────────

    private name(v: any): string {
        return (v === null || v === undefined || v === "") ? this.t("UI_Blank", "(Blank)") : (v instanceof Date ? v.toLocaleDateString(this.culture) : String(v));
    }

    private num(v: any): number | null {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * Ejes, series y puntos. Dos formas de datos:
     *  · Con Eje: un radio por valor del campo; las series salen de Serie (o, sin Serie, de cada medida).
     *  · Sin Eje: cada medida de Valores es un eje (encuestas en columnas, sin despivotar).
     * false = no hay nada que dibujar (pantalla de inicio).
     */
    private readData(dv: DataView | undefined): boolean {
        this.axes = []; this.series = []; this.panels = [null]; this.pts.clear(); this.idToPt.clear();
        this.totalSeries = 0; this.totalAxes = 0; this.hasTarget = false; this.hasHighlights = false; this.allInt = true;
        this.ruleColorsUsed = false;
        const cat = dv?.categorical;
        const vcols = cat?.values;
        if (!cat || !vcols || !vcols.length) return false;
        const pro = this.proActive;
        const s = this.effective();
        const cats = cat.categories || [];
        const axisCols = cats.filter(c => c.source.roles?.["axis"]);
        const groupCol = pro ? cats.find(c => c.source.roles?.["axisGroup"]) : undefined;
        const panelCol = pro ? cats.find(c => c.source.roles?.["panel"]) : undefined;
        const seriesBound = !!dv.metadata?.columns?.some(c => c.roles?.["series"]);
        const groups = vcols.grouped();
        const role = (cols: DataViewValueColumn[], r: string) => cols.find(c => c.source.roles?.[r]);
        const reversedSet = new Set(s.reversed.split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
        const axisIndex = new Map<string, Axis>();
        const panelSet: string[] = [];
        const addAxis = (name: string, group: string | null, format: string | undefined) => {
            let a = axisIndex.get(name);
            if (!a) { a = { key: name, name, group, format, reversed: reversedSet.has(name.toLowerCase()) }; axisIndex.set(name, a); }
            return a;
        };
        const addPanel = (p: string | null) => { if (p !== null && panelSet.indexOf(p) < 0) panelSet.push(p); };
        const fmtCol = (c: DataViewValueColumn | undefined) => c ? this.formatOf(c) : undefined;
        const tipsOf = (cols: DataViewValueColumn[], i: number) => cols.filter(c => c.source.roles?.["tooltips"]).map(c => {
            const v = c.values[i];
            const n = this.num(v);
            return { name: c.source.displayName, value: n !== null ? this.formatter(this.formatOf(c), undefined)(n) : (v === null || v === undefined ? "" : String(v)) };
        });

        // Series: una por grupo de Serie o, sin Serie, una por medida de Valores (como el radar de Microsoft).
        interface Src { name: string; value: DataViewValueColumn; cols: DataViewValueColumn[]; group: powerbi.DataViewValueColumnGroup | null; }
        const srcs: Src[] = [];
        if (seriesBound) {
            for (const g of groups) {
                const v = role(g.values, "values");
                if (v) srcs.push({ name: this.name(g.name), value: v, cols: g.values, group: g });
            }
        } else if (axisCols.length) {
            const g0 = groups[0];
            for (const v of g0.values.filter(c => c.source.roles?.["values"])) srcs.push({ name: v.source.displayName, value: v, cols: g0.values, group: null });
        } else {
            srcs.push({ name: "", value: role(groups[0].values, "values"), cols: groups[0].values, group: null });
        }
        if (!srcs.length || !srcs[0].value) return false;
        this.totalSeries = srcs.length;
        const limit = pro ? MAX_SERIES : FREE_SERIES;
        const used = srcs.slice(0, limit);
        const isIbcs = s.template === "ibcs";
        this.series = used.map((src, k) => {
            const own = src.group
                ? (src.group.objects?.["series"]?.["fill"] as any)?.solid?.color
                : (src.value.source.objects?.["series"]?.["fill"] as any)?.solid?.color;
            const selector = src.group
                ? (this.host.createSelectionIdBuilder().withSeries(vcols, src.group).createSelectionId() as any).getSelector?.()
                : { metadata: src.value.source.queryName } as any;
            const color = own || (isIbcs ? IBCS_GREYS[k % IBCS_GREYS.length] : this.host.colorPalette.getColor(src.name || "values").value);
            return { key: "s" + k, name: src.name, color, format: this.formatOf(src.value), selector };
        });

        const addPt = (panel: string | null, axis: string, si: number, value: number | null, hl: number | null, target: number | null,
            smin: number | null, smax: number | null, note: string, id: ISelectionId, rule: string | null, tips: { name: string; value: string }[]) => {
            const key = (panel ?? "") + "\u0001" + axis + "\u0001" + si;
            let p = this.pts.get(key);
            if (!p) {
                p = { key, panel, axis, si, value, hl, target, smin, smax, note, ids: [], rule, tips };
                this.pts.set(key, p);
            } else {
                // La misma combinación en varias filas (p. ej. un eje en dos grupos): el primer valor no vacío.
                if (p.value === null) p.value = value;
                if (p.hl === null) p.hl = hl;
                if (p.target === null) p.target = target;
                if (!p.note) p.note = note;
            }
            const k = this.keyOf(id);
            if (!this.idToPt.has(k)) { this.idToPt.set(k, key); p.ids.push(id); }
            if (value !== null && !Number.isInteger(value)) this.allInt = false;
            if (target !== null) this.hasTarget = true;
            if (hl !== null && hl !== undefined) this.hasHighlights = true;
        };

        if (axisCols.length) {
            // ── Con campo Eje ──
            this.measuresAsAxes = false;
            const lastAxis = axisCols[axisCols.length - 1];
            const n = lastAxis.values.length;
            for (let i = 0; i < n; i++) {
                const axisName = axisCols.length > 1 ? axisCols.map(c => this.name(c.values[i])).join(" · ") : this.name(lastAxis.values[i]);
                const panel = panelCol ? this.name(panelCol.values[i]) : null;
                const group = groupCol ? this.name(groupCol.values[i]) : null;
                addAxis(axisName, group, undefined);
                addPanel(panel);
                used.forEach((src, si) => {
                    const value = this.num(src.value.values[i]);
                    const hl = src.value.highlights ? this.num(src.value.highlights[i]) : null;
                    const target = pro ? this.num(role(src.cols, "target")?.values[i]) : null;
                    const smin = pro ? this.num(role(src.cols, "scaleMin")?.values[i]) : null;
                    const smax = pro ? this.num(role(src.cols, "scaleMax")?.values[i]) : null;
                    const noteRaw = pro ? role(src.cols, "note")?.values[i] : null;
                    let b = this.host.createSelectionIdBuilder();
                    for (const c of axisCols) b = b.withCategory(c, i);
                    if (groupCol) b = b.withCategory(groupCol, i);
                    if (panelCol) b = b.withCategory(panelCol, i);
                    b = src.group ? b.withSeries(vcols, src.group) : b.withMeasure(src.value.source.queryName);
                    const rule = ((src.value.objects?.[i]?.["markers"]?.["fill"] ?? lastAxis.objects?.[i]?.["markers"]?.["fill"]) as any)?.solid?.color ?? null;
                    if (rule) this.ruleColorsUsed = true;
                    addPt(panel, axisName, si, value, hl, target, smin, smax, noteRaw === null || noteRaw === undefined ? "" : String(noteRaw),
                        b.createSelectionId(), pro ? rule : null, tipsOf(src.cols, i));
                });
            }
        } else {
            // ── Sin Eje: cada medida es un eje ──
            this.measuresAsAxes = true;
            const rows = panelCol ? panelCol.values.length : 1;
            const measureCols = (seriesBound ? groups[0].values : groups[0].values).filter(c => c.source.roles?.["values"]);
            for (const m of measureCols) addAxis(m.source.displayName, null, this.formatOf(m));
            for (let i = 0; i < rows; i++) {
                const panel = panelCol ? this.name(panelCol.values[i]) : null;
                addPanel(panel);
                used.forEach((src, si) => {
                    const cols = src.group ? src.group.values : groups[0].values;
                    for (const m of cols.filter(c => c.source.roles?.["values"])) {
                        let b = this.host.createSelectionIdBuilder();
                        if (panelCol) b = b.withCategory(panelCol, i);
                        if (src.group) b = b.withSeries(vcols, src.group);
                        b = b.withMeasure(m.source.queryName);
                        addPt(panel, m.source.displayName, si, this.num(m.values[i]), m.highlights ? this.num(m.highlights[i]) : null,
                            null, null, null, "", b.createSelectionId(), null, tipsOf(cols, i));
                    }
                });
            }
        }
        if (panelSet.length) this.panels = panelSet;
        let axes = Array.from(axisIndex.values());
        this.totalAxes = axes.length;
        axes = this.orderAxes(axes, s);
        this.axes = axes.slice(0, MAX_AXES);
        return this.axes.length > 0;
    }

    /** Orden de los radios. El orden de datos respeta "Ordenar por columna" del modelo; los grupos van juntos. */
    private orderAxes(axes: Axis[], s: Settings): Axis[] {
        const idx = new Map(axes.map((a, i) => [a.key, i]));
        let cmp: (a: Axis, b: Axis) => number = (a, b) => idx.get(a.key) - idx.get(b.key);
        if (s.orderBy === "name") cmp = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
        else if (s.orderBy === "value") {
            const v = (a: Axis) => { let t = 0; this.pts.forEach(p => { if (p.axis === a.key && p.si === 0 && p.value !== null) t += p.value; }); return t; };
            const m = new Map(axes.map(a => [a.key, v(a)]));
            cmp = (a, b) => (m.get(b.key) - m.get(a.key)) || (idx.get(a.key) - idx.get(b.key));
        }
        const dir = s.descending ? -1 : 1;
        const groupsOrder: string[] = [];
        for (const a of axes) if (a.group !== null && groupsOrder.indexOf(a.group) < 0) groupsOrder.push(a.group);
        return axes.slice().sort((a, b) => {
            if (groupsOrder.length) {
                const g = groupsOrder.indexOf(a.group ?? "") - groupsOrder.indexOf(b.group ?? "");
                if (g) return g;
            }
            return dir * cmp(a, b);
        });
    }

    private formatOf(col: DataViewValueColumn): string | undefined {
        // getFormatStringByColumn devuelve también las cadenas de formato dinámicas de la medida.
        try { return valueFormatter.getFormatStringByColumn(col.source as any) || col.source.format; } catch { return col.source.format; }
    }

    private formatter(format: string | undefined, value?: number): (v: number) => string {
        const culture = this.culture;
        try {
            const f = valueFormatter.create({ format: format || undefined, value, cultureSelector: culture } as any);
            const plain = (() => { try { return new Intl.NumberFormat(culture, { maximumFractionDigits: 2 }); } catch { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }); } })();
            return (v: number) => {
                const out = f.format(v);
                // Un formato entero redondearía 3,6 a 4: si el valor tiene decimales y el formato no, se muestran.
                if (Number.isInteger(v) || /%/.test(format || "") || /[.,]\d/.test(out)) return out;
                return format ? out : plain.format(v);
            };
        } catch { return (v: number) => String(Math.round(v * 100) / 100); }
    }

    private seriesFmt(si: number): (v: number) => string { return this.formatter(this.series[si]?.format); }
    private pointFmt(p: Pt): (v: number) => string {
        const a = this.axisByKey(p.axis);
        return this.formatter(a?.format ?? this.series[p.si]?.format);
    }
    private axisByKey(k: string): Axis | undefined { return this.axes.find(a => a.key === k); }

    /** Ejes con al menos una fila en el panel (con o sin valor), en el orden general. */
    private panelAxes(panel: string | null): Axis[] {
        if (this.panels.length < 2) return this.axes;
        const has = new Set<string>();
        this.pts.forEach(p => { if (p.panel === panel) has.add(p.axis); });
        return this.axes.filter(a => has.has(a.key));
    }

    // ── Escalas ───────────────────────────────────────────────────────────────

    /** Valor que se dibuja: el propio o, en "% del objetivo", el porcentaje sobre el objetivo de su eje. */
    private plotValue(p: Pt, v: number | null, s: Settings): number | null {
        if (v === null) return null;
        if (s.scaleMode !== "target") return v;
        const t = p.target ?? this.targetOf(p.panel, p.axis);
        return t ? v / t * 100 : null;
    }

    private targetOf(panel: string | null, axis: string): number | null {
        for (let si = 0; si < this.series.length; si++) {
            const p = this.pts.get((panel ?? "") + "\u0001" + axis + "\u0001" + si);
            if (p && p.target !== null) return p.target;
        }
        return null;
    }

    /** Una escala por eje (todas iguales salvo en "por eje"), compartida por todos los paneles. */
    private scales(s: Settings): Map<string, Scale> {
        const out = new Map<string, Scale>();
        const minStep = this.allInt && s.scaleMode !== "target" ? 1 : 0;
        const rings = clamp(s.rings, 2, 10);
        const gather = (axis: string | null) => {
            let lo = Infinity, hi = -Infinity, smin: number | null = null, smax: number | null = null;
            this.pts.forEach(p => {
                if (axis !== null && p.axis !== axis) return;
                if (!this.axisByKey(p.axis)) return;
                for (const v of [p.value, p.hl, s.scaleMode === "target" ? null : p.target]) {
                    const x = this.plotValue(p, v, s);
                    if (x === null) continue;
                    if (x < lo) lo = x;
                    if (x > hi) hi = x;
                }
                if (s.scaleMode === "target") { lo = Math.min(lo, 100); hi = Math.max(hi, 100); }
                if (p.smin !== null && smin === null) smin = p.smin;
                if (p.smax !== null && smax === null) smax = p.smax;
            });
            return { lo, hi, smin, smax };
        };
        if (s.scaleMode === "perAxis") {
            for (const a of this.axes) {
                const g = gather(a.key);
                if (g.smin !== null && g.smax !== null && g.smax > g.smin) { out.set(a.key, ringScale(g.smin, g.smax, rings, true)); continue; }
                const lo = g.smin !== null ? g.smin : (s.zero ? Math.min(0, g.lo) : g.lo);
                const hi = g.smax !== null ? g.smax : g.hi;
                out.set(a.key, ringScale(lo, hi, rings, false, minStep));
            }
            return out;
        }
        const g = gather(null);
        let sc: Scale;
        if (!s.auto && s.scaleMode === "common" && Number.isFinite(s.min) && Number.isFinite(s.max) && s.max > s.min) sc = ringScale(s.min, s.max, rings, true);
        else sc = ringScale(s.zero ? Math.min(0, g.lo) : g.lo, g.hi, rings, false, minStep);
        for (const a of this.axes) out.set(a.key, sc);
        return out;
    }

    // ── Dibujo ────────────────────────────────────────────────────────────────

    private clearSvg(): void {
        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    }

    private el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
        const e = document.createElementNS(SVG, tag) as SVGElementTagNameMap[K];
        for (const k in attrs) e.setAttribute(k, String(attrs[k]));
        parent.appendChild(e);
        return e;
    }

    private hc(): { on: boolean; fg: string; bg: string; sel: string } {
        const p: any = this.host.colorPalette;
        return { on: !!p?.isHighContrast, fg: p?.foreground?.value || "#000000", bg: p?.background?.value || "#FFFFFF", sel: p?.foregroundSelected?.value || p?.foreground?.value || "#000000" };
    }

    /** Dibuja con el último dataView. Lo usa update() y el repintado tras resolver la licencia. */
    private draw(): void {
        if (this.destroyed || !this.lastOptions) return;
        const vp = this.lastOptions.viewport;
        const hc = this.hc();
        this.root.style.background = hc.on ? hc.bg : (this.s.background || "transparent");
        this.subSelectable(this.root, "background", this.t("Obj_background", "Background"), powerbi.visuals.SubSelectionStylesType.Shape);
        this.guideEl.style.display = "none";
        if (!this.hasData) {
            this.clearSvg(); this.tableEl.style.display = "none"; this.noteEl.style.display = "none";
            this.watermarkEl.style.display = "none";
            this.landing(vp.width, vp.height);
            this.warnings();
            return;
        }
        this.landingEl.style.display = "none";
        this.svg.style.display = "";
        const s = this.effective();
        let tableH = 0;
        if (s.table && this.axes.length >= 3) tableH = this.renderTable(s, vp.height);
        else this.tableEl.style.display = "none";
        const noteH = this.renderNote(s) ? 16 : 0;
        this.render(s, vp.width, Math.max(60, vp.height - tableH - noteH));
        this.renderWatermark(vp.width, vp.height);
        this.renderGuide();
        this.warnings();
        this.notifyProFeatureBlocked();
        this.paintSelection();
    }

    private render(s: Settings, W: number, H: number): void {
        this.clearSvg();
        this.svg.setAttribute("width", String(W));
        this.svg.setAttribute("height", String(H));
        const hc = this.hc();
        const n = this.axes.length;
        if (n < 3) {
            const t = this.el("text", { x: W / 2, y: H / 2, "text-anchor": "middle", "font-size": 13, fill: hc.on ? hc.fg : "#605E5C" }, this.svg);
            t.textContent = this.t("UI_NeedAxes", "A radar needs 3 axes or more. Add values to Axis, or more measures to Values.");
            return;
        }
        const tiny = W < 220 || H < 170;
        const scales = this.scales(s);

        // Leyenda
        let top = 4, bottom = 4, right = 4;
        const showLegend = s.legend && (this.series.length > 1 || this.totalSeries > this.series.length) && !tiny && this.series.some(x => x.name);
        if (showLegend) {
            const lg = this.el("g", { class: "tcrd-legend" }, this.svg);
            this.subSelectable(lg, "legend", this.t("Obj_legend", "Legend"), powerbi.visuals.SubSelectionStylesType.Text);
            const fl = clamp(s.legendFont, 6, 30);
            const rowH = fl + 8;
            const means = s.axesMean && this.series.length > 1 && this.panels.length < 2 ? this.axesMeans(s, scales) : null;
            const items = this.series.map((se, si) => ({ se, si, label: se.name + (means && means[si] !== null ? "  " + Math.round(means[si] * 100) + "%" : "") }));
            const more = this.totalSeries > this.series.length
                ? this.t("UI_SeriesOf", "{0} of {1} series").replace("{0}", String(this.series.length)).replace("{1}", String(this.totalSeries)) : "";
            if (s.legendPos === "right" && W > 360) {
                const colW = Math.min(180, Math.max(...items.map(x => x.label.length)) * fl * 0.58 + fl + 16);
                let y = rowH;
                items.forEach(it => { this.legendItem(lg, it.se, it.si, it.label, W - colW, y, fl, s, hc); y += rowH; });
                if (more) { const t = this.el("text", { x: W - colW, y: y + fl * 0.35, "font-size": Math.max(7, fl - 1), fill: hc.on ? hc.fg : "#83827D" }, lg); t.textContent = more; }
                right += colW + 6;
            } else {
                const y = s.legendPos === "bottom" ? H - rowH / 2 - 2 : rowH / 2 + 2;
                let x = 8;
                for (const it of items) {
                    const w = fl + 10 + Math.min(170, it.label.length * fl * 0.58);
                    if (x + w > W - 8) break;
                    this.legendItem(lg, it.se, it.si, it.label, x, y, fl, s, hc);
                    x += w + 10;
                }
                if (more && x < W - 60) { const t = this.el("text", { x, y: y + fl * 0.35, "font-size": Math.max(7, fl - 1), fill: hc.on ? hc.fg : "#83827D" }, lg); t.textContent = more; }
                if (s.legendPos === "bottom") bottom += rowH + 4; else top += rowH + 4;
            }
        }

        // Paneles (múltiplos pequeños con la misma escala)
        const panels = this.panels;
        const gap = panels.length > 1 ? clamp(s.smGap, 0, 60) : 0;
        const plotW = W - right, plotH = H - top - bottom;
        const autoCols = Math.max(1, Math.round(Math.sqrt(panels.length * (plotW / Math.max(1, plotH)))));
        const cols = panels.length === 1 ? 1 : Math.min(panels.length, s.smCols > 0 ? Math.round(s.smCols) : autoCols);
        const rows = Math.ceil(panels.length / cols);
        const cellW = (plotW - gap * (cols - 1)) / cols, cellH = (plotH - gap * (rows - 1)) / rows;
        const smTitle = clamp(s.smTitleSize, 6, 40);
        panels.forEach((panel, pi) => {
            const cx0 = (pi % cols) * (cellW + gap), cy0 = top + Math.floor(pi / cols) * (cellH + gap);
            const g = this.el("g", { transform: `translate(${cx0.toFixed(1)},${cy0.toFixed(1)})` }, this.svg);
            let titleH = 0;
            if (panel !== null) {
                if ((s.smBackground && !hc.on) || s.smBorder) {
                    this.el("rect", { x: 0.5, y: 0.5, width: Math.max(0, cellW - 1), height: Math.max(0, cellH - 1), rx: 2,
                        fill: s.smBackground && !hc.on ? s.smBackground : "none", stroke: s.smBorder ? (hc.on ? hc.fg : s.smBorderColor) : "none" }, g);
                }
                const center = s.smTitleAlign === "center";
                const t = this.el("text", { x: center ? cellW / 2 : 6, y: smTitle + 2, "text-anchor": center ? "middle" : "start", "font-size": smTitle,
                    "font-weight": s.smTitleBold ? 600 : 400, fill: hc.on ? hc.fg : s.smTitleColor }, g);
                t.textContent = panel;
                titleH = smTitle + 6;
            }
            this.drawRadar(g, panel, s, scales, cellW, cellH - titleH, titleH, hc, tiny || panels.length > 4 && cellW < 260);
        });
    }

    private legendItem(lg: SVGGElement, se: Series, si: number, label: string, x: number, y: number, fl: number,
        s: Settings, hc: { on: boolean; fg: string; bg: string; sel: string }): void {
        const it = this.el("g", { "data-series": se.key, class: "tcrd-leg", tabindex: -1, role: "option" }, lg);
        it.setAttribute("aria-label", this.t("UI_Series", "Series") + " " + se.name);
        this.el("line", { x1: x, y1: y, x2: x + fl, y2: y, stroke: hc.on ? hc.fg : se.color, "stroke-width": 3,
            "stroke-dasharray": hc.on ? HC_DASH[si % HC_DASH.length] : "" }, it);
        const t = this.el("text", { x: x + fl + 5, y: y + fl * 0.35, "font-size": fl, fill: hc.on ? hc.fg : s.legendColor }, it);
        t.textContent = label;
        it.addEventListener("click", (e) => {
            if (this.formatMode) return;
            e.stopPropagation();
            this.selectKeys(this.keysWhere(p => p.si === si), e.ctrlKey || e.metaKey);
        });
    }

    /** Media de los ejes por serie, como fracción de la escala (0..1). Solo tiene sentido con escala común o normalizada. */
    private axesMeans(s: Settings, scales: Map<string, Scale>): (number | null)[] {
        return this.series.map((_, si) => {
            let t = 0, k = 0;
            this.pts.forEach(p => {
                if (p.si !== si || p.panel !== this.panels[0]) return;
                const a = this.axisByKey(p.axis);
                const v = this.plotValue(p, p.value, s);
                if (!a || v === null) return;
                t += frac(v, scales.get(a.key), a.reversed); k++;
            });
            return k ? t / k : null;
        });
    }

    private drawRadar(g: SVGGElement, panel: string | null, s: Settings, scales: Map<string, Scale>, W: number, H: number, y0: number,
        hc: { on: boolean; fg: string; bg: string; sel: string }, compact: boolean): void {
        // Cada panel dibuja los ejes que tienen filas en él: un eje ausente no es un vacío.
        const axes = this.panelAxes(panel);
        const n = axes.length;
        if (n < 3) {
            const t = this.el("text", { x: W / 2, y: y0 + H / 2, "text-anchor": "middle", "font-size": 12, fill: hc.on ? hc.fg : "#605E5C" }, g);
            t.textContent = this.t("UI_PanelFewAxes", "Fewer than 3 axes in this panel.");
            return;
        }
        const axFont = clamp(compact ? Math.min(s.axFont, 9) : s.axFont, 6, 30);
        const showAx = s.axLabels && W > 120;
        const groups = axes.some(a => a.group !== null);
        const groupSpace = groups ? clamp(s.groupFont, 6, 24) + 10 : 0;
        // Sitio para las etiquetas: según el texto más largo, sin pasar de un cuarto del ancho.
        const auto = Math.max(4, Math.floor(Math.min(W * 0.22, 150) / (axFont * 0.56)));
        const maxChars = s.axMaxChars > 0 ? Math.round(s.axMaxChars) : auto;
        const cut = (x: string) => x.length > maxChars ? x.slice(0, Math.max(1, maxChars - 1)) + "…" : x;
        // Nombres largos ("Average of Q1 Clarity"): dos líneas partiendo por palabras antes de recortar.
        const lines = (x: string): string[] => {
            if (x.length <= maxChars || s.axMaxChars > 0) return [cut(x)];
            const words = x.split(/\s+/);
            let first = "";
            while (words.length && (first ? first + " " + words[0] : words[0]).length <= maxChars) first = first ? first + " " + words.shift() : words.shift();
            if (!first) return [cut(x)];
            return words.length ? [first, cut(words.join(" "))] : [first];
        };
        const labelLines = new Map(axes.map(a => [a.key, lines(a.name + (a.reversed ? " ↓" : ""))]));
        const twoLines = Array.from(labelLines.values()).some(l => l.length > 1);
        const longest = showAx ? Math.max(...Array.from(labelLines.values()).map(l => Math.max(...l.map(x => x.length)))) * axFont * 0.56 : 0;
        const padX = showAx ? longest + 10 : 8, padY = showAx ? axFont * (twoLines ? 2.8 : 1.6) + 8 : 8;
        const R = Math.max(10, Math.min((W - 2 * padX) / 2, (H - 2 * padY) / 2) - groupSpace);
        const cx = W / 2, cy = y0 + H / 2;
        const ang = (j: number) => -Math.PI / 2 + 2 * Math.PI * j / n;
        const at = (f: number, j: number): [number, number] => [cx + Math.cos(ang(j)) * R * f, cy + Math.sin(ang(j)) * R * f];
        const ring = (f: number) => s.gridShape === "circle"
            ? `M${cx - R * f},${cy}a${R * f},${R * f} 0 1,0 ${2 * R * f},0a${R * f},${R * f} 0 1,0 ${-2 * R * f},0Z`
            : "M" + axes.map((_, j) => at(f, j).map(v => v.toFixed(1)).join(",")).join("L") + "Z";
        const sc0 = scales.get(axes[0].key);
        const perAxis = s.scaleMode === "perAxis";

        // Bandas (Pro): coronas por porcentaje de la escala, solo con escala común o % del objetivo
        if (s.bands && !perAxis && !hc.on) {
            const lo = clamp(s.bandLow, 0, 100) / 100, hi = clamp(Math.max(s.bandHigh, s.bandLow), 0, 100) / 100;
            const opa = clamp(s.bandOpacity, 0, 100) / 100;
            const band = (a: number, b: number, color: string) => this.el("path", { d: ring(b) + (a > 0 ? ring(a) : ""), fill: color, "fill-opacity": opa, "fill-rule": "evenodd", stroke: "none" }, g);
            band(0, lo, s.bandLowColor); band(lo, hi, s.bandMidColor); band(hi, 1, s.bandHighColor);
        }

        // Rejilla, cero y radios
        const grid = this.el("g", { class: "tcrd-grid" }, g);
        this.subSelectable(grid, "grid", this.t("Obj_grid", "Grid"), powerbi.visuals.SubSelectionStylesType.Shape);
        const gc = hc.on ? hc.fg : s.gridColor;
        const nr = sc0.rings.length - 1;
        for (let k = 1; k <= nr; k++) this.el("path", { d: ring(k / nr), fill: "none", stroke: gc, "stroke-width": 1, "stroke-opacity": hc.on ? 0.5 : 1 }, grid);
        if (!perAxis && sc0.lo < 0 && sc0.hi > 0) {
            this.el("path", { d: ring(frac(0, sc0, false)), fill: "none", stroke: hc.on ? hc.fg : "#83827D", "stroke-width": 1.2, "stroke-dasharray": "4 3" }, grid);
        }
        if (s.spokes) axes.forEach((_, j) => { const [x, y] = at(1, j); this.el("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: gc, "stroke-width": 1, "stroke-opacity": hc.on ? 0.5 : 1 }, grid); });

        // Valores de los anillos: en el primer radio con escala común; en cada radio con escala por eje.
        if (s.ringLabels && !compact) {
            const gf = clamp(s.gridFont, 6, 20);
            const lbl = this.el("g", { class: "tcrd-rings", "font-size": gf, fill: hc.on ? hc.fg : s.gridLabelColor }, grid);
            const fmtRing = (a: Axis, v: number) => s.scaleMode === "target" ? Math.round(v) + "%" : this.formatter(a.format ?? this.series[0]?.format, Math.max(Math.abs(scales.get(a.key).lo), Math.abs(scales.get(a.key).hi)))(v);
            const onAxis = (j: number, every: number) => {
                const a = axes[j], sc = scales.get(a.key);
                sc.rings.forEach((v, k) => {
                    if (k % every && k !== sc.rings.length - 1) return;
                    const f = frac(v, sc, a.reversed);
                    if (f < 0.01) return;   // el centro no se rotula (en un eje invertido es el máximo)
                    const [x, y] = at(f, j);
                    const t = this.el("text", { x: x + 3, y: y - 2, "text-anchor": "start" }, lbl);
                    t.textContent = fmtRing(a, v);
                });
            };
            if (perAxis) { const every = n > 12 ? 99 : 1; axes.forEach((_, j) => onAxis(j, every)); }
            else onAxis(0, 1);
        }

        // Grupos de ejes (Pro): un arco con nombre por grupo, fuera del contorno
        if (groups) {
            const gg = this.el("g", { class: "tcrd-groups" }, g);
            const gf = clamp(s.groupFont, 6, 24);
            let start = 0;
            while (start < n) {
                const name = axes[start].group;
                let end = start;
                while (end + 1 < n && axes[end + 1].group === name) end++;
                if (name !== null) {
                    const half = Math.PI / n;
                    const a0 = ang(start) - half * 0.8, a1 = ang(end) + half * 0.8;
                    const r = R + groupSpace - gf * 0.4 + (showAx ? 0 : 0);
                    const rr = R + 6;
                    const large = a1 - a0 > Math.PI ? 1 : 0;
                    this.el("path", { d: `M${cx + Math.cos(a0) * rr},${cy + Math.sin(a0) * rr}A${rr},${rr} 0 ${large},1 ${cx + Math.cos(a1) * rr},${cy + Math.sin(a1) * rr}`,
                        fill: "none", stroke: hc.on ? hc.fg : s.groupColor, "stroke-width": 2, "stroke-opacity": 0.7, "stroke-linecap": "round" }, gg);
                    const mid = (a0 + a1) / 2;
                    const tx = cx + Math.cos(mid) * (r + (showAx ? longest * Math.abs(Math.cos(mid)) * 0.9 + axFont * 1.2 : 0));
                    const ty = cy + Math.sin(mid) * (r + (showAx ? axFont * 1.4 : 0));
                    const t = this.el("text", { x: tx, y: ty + gf * 0.35, "text-anchor": Math.cos(mid) > 0.3 ? "start" : Math.cos(mid) < -0.3 ? "end" : "middle",
                        "font-size": gf, "font-weight": 600, fill: hc.on ? hc.fg : s.groupColor }, gg);
                    t.textContent = name;
                }
                start = end + 1;
            }
        }

        // Etiquetas de los ejes (clic = seleccionar el eje)
        if (showAx) {
            const ax = this.el("g", { class: "tcrd-axes", "font-weight": s.axBold ? 700 : 400 }, g);
            if (s.axFamily) ax.setAttribute("font-family", s.axFamily);
            this.subSelectable(ax, "axisLabels", this.t("Obj_axisLabels", "Axis labels"), powerbi.visuals.SubSelectionStylesType.Text);
            axes.forEach((a, j) => {
                const [x, y] = at(1, j);
                const c = Math.cos(ang(j)), sn = Math.sin(ang(j));
                const lab = this.el("g", { "data-axis": a.key, class: "tcrd-axis" }, ax);
                const off = 9 + (sn < -0.5 && s.ringLabels ? clamp(s.gridFont, 6, 20) * 0.6 : 0);   // que no pise el valor del último anillo
                const ls = labelLines.get(a.key);
                // Arriba, las líneas crecen hacia arriba; abajo, hacia abajo; a los lados, centradas en el radio.
                const lh = axFont * 1.15;
                const shift = sn < -0.5 ? -(ls.length - 1) * lh : sn > 0.5 ? 0 : -(ls.length - 1) * lh / 2;
                const tx = x + c * off;
                const t = this.el("text", { x: tx, y: y + sn * off + axFont * 0.35 + (sn < -0.5 ? -axFont * 0.3 : sn > 0.5 ? axFont * 0.5 : 0) + shift,
                    "text-anchor": c > 0.3 ? "start" : c < -0.3 ? "end" : "middle", "font-size": axFont, fill: hc.on ? hc.fg : s.axColor }, lab);
                ls.forEach((line, k) => {
                    const span = document.createElementNS(SVG, "tspan");
                    span.setAttribute("x", tx.toFixed(1));
                    if (k > 0) span.setAttribute("dy", String(lh));
                    span.textContent = line;
                    t.appendChild(span);
                });
                const title = document.createElementNS(SVG, "title");
                title.textContent = a.name + (a.reversed ? " — " + this.t("UI_LowerBetter", "lower is better") : "");
                t.appendChild(title);
                lab.addEventListener("click", (e) => {
                    if (this.formatMode) return;
                    e.stopPropagation();
                    this.selectKeys(this.keysWhere(p => p.axis === a.key && p.panel === panel), e.ctrlKey || e.metaKey);
                });
            });
        }

        // Objetivo (Pro): contorno discontinuo
        const val = (p: Pt | undefined, v: number | null) => p ? this.plotValue(p, v, s) : null;
        const ptOf = (axis: string, si: number) => this.pts.get((panel ?? "") + "\u0001" + axis + "\u0001" + si);
        if (this.hasTarget) {
            const tp = axes.map((a, j) => {
                const t = this.targetOf(panel, a.key);
                if (t === null) return null;
                const v = s.scaleMode === "target" ? 100 : t;
                return at(frac(v, scales.get(a.key), a.reversed), j);
            });
            const tg = this.el("g", { class: "tcrd-target" }, g);
            this.el("path", { d: this.pathOf(tp), fill: "none", stroke: hc.on ? hc.fg : s.targetColor, "stroke-width": 1.6, "stroke-dasharray": "6 4" }, tg);
        }

        // Series: relleno, línea y marcadores. Un vacío corta el contorno: nunca se dibuja como cero.
        const shapes = this.el("g", { class: "tcrd-series" }, g);
        this.subSelectable(shapes, "series", this.t("Obj_series", "Series"), powerbi.visuals.SubSelectionStylesType.Shape);
        const lw = clamp(s.lineWidth, 0.5, 8);
        const fo = clamp(s.fillOpacity, 0, 100) / 100;
        const order = this.series.map((_, i) => i).reverse();   // la primera serie queda encima
        for (const si of order) {
            const se = this.series[si];
            const color = hc.on ? hc.fg : se.color;
            const pts = axes.map((a, j) => { const p = ptOf(a.key, si); const v = val(p, p?.value ?? null); return v === null ? null : at(frac(v, scales.get(a.key), a.reversed), j); });
            const sg = this.el("g", { "data-shape": se.key, class: "tcrd-shape" }, shapes);
            const complete = pts.every(p => p !== null);
            const dash = hc.on ? HC_DASH[si % HC_DASH.length] : "";
            if (complete && fo > 0 && !hc.on) this.el("path", { d: this.pathOf(pts), fill: color, "fill-opacity": this.hasHighlights ? fo * 0.4 : fo, stroke: "none" }, sg);
            this.el("path", { d: this.pathOf(pts), fill: "none", stroke: color, "stroke-width": lw, "stroke-linejoin": "round", "stroke-dasharray": dash,
                "stroke-opacity": this.hasHighlights ? 0.35 : 1 }, sg);
            if (this.hasHighlights) {
                const hp = axes.map((a, j) => { const p = ptOf(a.key, si); const v = val(p, p?.hl ?? null); return v === null ? null : at(frac(v, scales.get(a.key), a.reversed), j); });
                this.el("path", { d: this.pathOf(hp), fill: hc.on ? "none" : color, "fill-opacity": hc.on ? 0 : fo, stroke: color, "stroke-width": lw + 0.5, "stroke-dasharray": dash }, sg);
            }
        }

        // Marcadores, etiquetas de datos, brecha al objetivo y anotaciones
        const marks = this.el("g", { class: "tcrd-marks" }, g);
        // Diferencias al objetivo: una capa por serie; paintSelection enseña la de la serie seleccionada.
        const gaps = this.el("g", { class: "tcrd-gaps", "pointer-events": "none" }, g);
        const r = clamp(s.markerSize, 1, 10);
        const lf = clamp(s.labelFont, 6, 24);
        const nf = clamp(s.noteFont, 6, 20);
        for (const si of order) {
            const se = this.series[si];
            axes.forEach((a, j) => {
                const p = ptOf(a.key, si);
                if (!p) return;
                const v = val(p, this.hasHighlights && p.hl !== null ? p.hl : p.value);
                if (v === null) return;
                const f = frac(v, scales.get(a.key), a.reversed);
                const [x, y] = at(f, j);
                const pg = this.el("g", { "data-pt": p.key, class: "tcrd-pt", tabindex: -1, role: "option" }, marks);
                pg.setAttribute("aria-label", `${se.name ? se.name + " · " : ""}${a.name}: ${this.pointFmt(p)(p.value ?? 0)}`);
                const fill = hc.on ? hc.bg : (p.rule || s.markerColor || se.color);
                if (s.markers || p.rule) this.el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r, fill, stroke: hc.on ? hc.fg : "#FFFFFF", "stroke-width": hc.on ? 1.5 : 1 }, pg);
                // Zona de clic mayor que el marcador
                this.el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: Math.max(7, r + 3), fill: "transparent", class: "tcrd-hit" }, pg);
                const c = Math.cos(ang(j)), sn = Math.sin(ang(j));
                if (s.labels && !compact) {
                    const t = this.el("text", { x: x + c * (r + 4), y: y + sn * (r + 4) + lf * 0.35, "text-anchor": c > 0.3 ? "start" : c < -0.3 ? "end" : "middle",
                        "font-size": lf, fill: hc.on ? hc.fg : s.labelColor, "pointer-events": "none" }, pg);
                    t.textContent = s.scaleMode === "target" ? Math.round(v) + "%" : this.pointFmt(p)(p.value ?? 0);
                }
                // Brecha al objetivo (Pro): verde si cumple, rojo si no (al revés en ejes "menos es mejor"). Con una
                // serie se ve siempre; con varias, la de la serie seleccionada (si no, no se sabría de quién es).
                if (this.hasTarget && s.showGap && !compact && p.value !== null) {
                    const tgt = p.target ?? this.targetOf(panel, a.key);
                    if (tgt !== null) {
                        const d = p.value - tgt;
                        const good = a.reversed ? d <= 0 : d >= 0;
                        const tf = frac(s.scaleMode === "target" ? 100 : tgt, scales.get(a.key), a.reversed);
                        const [tx, ty] = at(Math.max(f, tf), j);
                        // Al otro lado del radio que los valores de los anillos, para no pisarlos.
                        const ox = sn * 9, oy = -c * 9;
                        const t = this.el("text", { x: tx + c * 4 + ox, y: ty + sn * 4 + oy + 3, "text-anchor": ox < -2 ? "end" : ox > 2 ? "start" : "middle",
                            "font-size": Math.max(7, lf - 1), "font-weight": 600, fill: hc.on ? hc.fg : (good ? s.goodColor : s.badColor), "data-gap": si }, gaps);
                        t.textContent = (d > 0 ? "+" : d < 0 ? "−" : "±") + this.pointFmt(p)(Math.abs(d));
                    }
                }
                // Anotación (Pro): el texto de la medida Nota junto al punto
                if (p.note && s.notes && !compact) {
                    const txt = p.note.length > 40 ? p.note.slice(0, 39) + "…" : p.note;
                    const ox = x - sn * 10, oy = y + c * 10;
                    this.el("line", { x1: x, y1: y, x2: ox, y2: oy, stroke: hc.on ? hc.fg : s.noteColor, "stroke-width": 0.8, "pointer-events": "none" }, pg);
                    const t = this.el("text", { x: ox + (c >= 0 ? 2 : -2), y: oy + nf * 0.35, "text-anchor": c >= 0 ? "start" : "end", "font-size": nf, "font-style": "italic",
                        fill: hc.on ? hc.fg : s.noteColor, "pointer-events": "none" }, pg);
                    t.textContent = txt;
                }
                this.wire(pg, p);
            });
        }

        // Media de los ejes (Pro) en el centro, con una sola serie
        if (s.axesMean && this.series.length === 1 && s.scaleMode !== "perAxis") {
            const m = this.axesMeans(s, scales)[0];
            if (m !== null) {
                const t = this.el("text", { x: cx, y: cy - 2, "text-anchor": "middle", "font-size": Math.max(10, Math.min(22, R / 6)), "font-weight": 700, fill: hc.on ? hc.fg : this.series[0].color }, g);
                t.textContent = Math.round(m * 100) + "%";
                const c2 = this.el("text", { x: cx, y: cy + Math.max(9, Math.min(14, R / 10)), "text-anchor": "middle", "font-size": Math.max(7, Math.min(11, R / 12)), fill: hc.on ? hc.fg : "#83827D" }, g);
                c2.textContent = this.t("UI_AxesMean", "axes mean (% of scale)");
            }
        }
    }

    /** Contorno con huecos: cerrado si no falta ningún punto; si faltan, solo los tramos entre puntos presentes. */
    private pathOf(pts: ([number, number] | null)[]): string {
        const P = (p: [number, number]) => p[0].toFixed(1) + "," + p[1].toFixed(1);
        if (pts.every(p => p !== null)) return "M" + pts.map(P).join("L") + "Z";
        const n = pts.length;
        let d = "";
        // Empezar justo después de un hueco para que el tramo que cruza el final no se parta en dos.
        const startAt = pts.findIndex((p, i) => p !== null && pts[(i - 1 + n) % n] === null);
        if (startAt < 0) return "";
        let run: string[] = [];
        for (let k = 0; k < n; k++) {
            const p = pts[(startAt + k) % n];
            if (p) run.push(P(p));
            else { if (run.length > 1) d += "M" + run.join("L"); run = []; }
        }
        if (run.length > 1) d += "M" + run.join("L");
        return d;
    }

    // ── Tabla de valores (Pro) ────────────────────────────────────────────────

    private renderTable(s: Settings, H: number): number {
        const el = this.tableEl;
        while (el.firstChild) el.removeChild(el.firstChild);
        el.style.display = "block";
        const maxH = Math.max(60, Math.floor(H * 0.35));
        el.style.maxHeight = maxH + "px";
        el.style.fontSize = clamp(s.tableFont, 7, 24) + "px";
        const hc = this.hc();
        el.style.color = hc.on ? hc.fg : (s.tableColor || "#3D3929");
        const table = document.createElement("table");
        // Una tabla no siempre hereda color y tamaño (modo quirks del iframe): se fijan en ella.
        table.style.color = el.style.color;
        table.style.fontSize = el.style.fontSize;
        const multi = this.panels.length > 1;
        const withTarget = this.hasTarget;
        const cols = (multi ? [this.t("UI_Panel", "Panel")] : []).concat([this.t("UI_Axis", "Axis")])
            .concat(this.series.map(x => x.name || this.t("Role_values", "Values")))
            .concat(withTarget ? [this.t("UI_Target", "Target"), this.t("UI_Gap", "Gap")] : []);
        const firstNum = multi ? 2 : 1;
        const head = document.createElement("tr");
        cols.forEach((c, i) => {
            const th = document.createElement("th"); th.textContent = c; if (i >= firstNum) th.className = "num";
            th.style.background = hc.on ? hc.bg : (s.tableHeaderBg || "#FFFFFF");
            th.style.color = hc.on ? hc.fg : (s.tableHeaderColor || s.tableColor || "#3D3929");
            head.appendChild(th);
        });
        const thead = document.createElement("thead"); thead.appendChild(head); table.appendChild(thead);
        const tbody = document.createElement("tbody");
        for (const panel of this.panels) {
            for (const a of this.panelAxes(panel)) {
                const tr = document.createElement("tr");
                if (s.tableBanding && !hc.on && tbody.childElementCount % 2 === 1) tr.style.background = s.tableBanding;
                const cells: string[] = (multi ? [panel ?? ""] : []).concat([a.name + (a.reversed ? " ↓" : "")]);
                this.series.forEach((_, si) => {
                    const p = this.pts.get((panel ?? "") + "\u0001" + a.key + "\u0001" + si);
                    cells.push(p && p.value !== null ? this.pointFmt(p)(p.value) : "");
                });
                if (withTarget) {
                    const t = this.targetOf(panel, a.key);
                    const p0 = this.pts.get((panel ?? "") + "\u0001" + a.key + "\u0001" + 0);
                    const f = p0 ? this.pointFmt(p0) : this.seriesFmt(0);
                    cells.push(t !== null ? f(t) : "");
                    const d = p0 && p0.value !== null && t !== null ? p0.value - t : null;
                    cells.push(d === null ? "" : (d > 0 ? "+" : d < 0 ? "−" : "") + f(Math.abs(d)));
                }
                cells.forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (i >= firstNum) td.className = "num"; tr.appendChild(td); });
                tbody.appendChild(tr);
            }
        }
        table.appendChild(tbody);
        el.appendChild(table);
        return Math.min(maxH, el.scrollHeight || maxH) + 4;
    }

    // ── Avisos ────────────────────────────────────────────────────────────────

    /**
     * Nota pequeña en el visual: describe el dato (eje dominante, ejes que no caben) y, en lectura, las
     * funciones Pro que no se aplican. Nunca enlaza a compra ni nombra el plan como interfaz de licencias.
     */
    private renderNote(s: Settings): boolean {
        const msgs: string[] = [];
        if (this.totalAxes > this.axes.length)
            msgs.push(this.t("UI_AxesOf", "Showing {0} of {1} axes.").replace("{0}", String(this.axes.length)).replace("{1}", String(this.totalAxes)));
        const dom = this.dominantAxis(s);
        if (dom) msgs.push(this.t("UI_Dominant", "“{0}” is much larger than the other axes, so they look flat. Check the scale in Format → Scale.").replace("{0}", dom));
        const wanted = this.attemptedPro();
        if (!this.proActive && wanted.length && !this.isEditing())
            msgs.push(this.t("UI_ReadingFree", "Pro features not applied in reading view:") + " " + wanted.map(w => w.label).join(", "));
        this.noteEl.style.display = msgs.length ? "block" : "none";
        this.noteEl.textContent = msgs.join(" · ");
        const hc = this.hc();
        this.noteEl.style.color = hc.on ? hc.fg : "#83827D";
        return msgs.length > 0;
    }

    /**
     * Con escala común: el eje que aplasta a los demás. Se avisa cuando la mitad o más de los otros ejes no
     * llegan al 15 % del mayor, que es cuando se ven planos (p. ej. defectos en ppm junto a porcentajes).
     */
    private dominantAxis(s: Settings): string | null {
        if (s.scaleMode !== "common" || !s.auto || this.axes.length < 3) return null;
        const maxOf = this.axes.map(a => {
            let m = 0; this.pts.forEach(p => { if (p.axis === a.key && p.value !== null) m = Math.max(m, Math.abs(p.value)); }); return { a, m };
        }).sort((x, y) => y.m - x.m);
        const top = maxOf[0].m;
        if (!(top > 0)) return null;
        const planos = maxOf.slice(1).filter(x => x.m < top * 0.15).length;
        return planos >= Math.ceil((maxOf.length - 1) / 2) ? maxOf[0].a.name : null;
    }

    private renderWatermark(W: number, H: number): void {
        const wanted = this.isPreview() ? this.attemptedPro() : [];
        const el = this.watermarkEl;
        if (!wanted.length) { el.style.display = "none"; return; }
        while (el.firstChild) el.removeChild(el.firstChild);
        el.style.display = "flex";
        const t = document.createElement("div"); t.className = "tcrd-wm-title"; t.textContent = this.t("UI_ProPreview", "Pro preview");
        const w = document.createElement("div"); w.className = "tcrd-wm-why"; w.textContent = wanted.map(x => x.label).join(" · ");
        el.appendChild(t); el.appendChild(w);
        el.style.fontSize = Math.max(14, Math.min(44, Math.min(W, H) / 7)) + "px";
    }

    /** Icono de aviso de la cabecera: filas que Power BI no ha entregado. */
    private warnings(): void {
        const host: any = this.host;
        if (typeof host.displayWarningIcon !== "function") return;
        if (this.truncatedAt) {
            host.displayWarningIcon(this.t("UI_WarnTitle", "Radar chart"), (this.isDesktop
                ? this.t("UI_WarnRowsDesktop", "In Power BI Desktop the visual uses the first rows Power BI sends: publish to the service to use them all.")
                : this.t("UI_WarnRows", "Power BI sent only part of the rows: the chart reflects the rows received.")) + " (" + this.truncatedAt + ")");
        } else if (typeof host.hideWarningIcon === "function") host.hideWarningIcon();
    }

    // ── Asistente de configuración ────────────────────────────────────────────

    /**
     * Panel flotante que guía la configuración mientras se edita. No puede tocar los pozos de campos
     * (eso solo lo hace el usuario): comprueba lo que ya está, explica qué da cada campo y aplica la
     * plantilla elegida. Al terminar o cerrarlo se guarda style.guide = false; se reabre desde
     * Formato → Plantilla de estilo. persistProperties sale de un clic, nunca del callback de selección.
     */
    private renderGuide(): void {
        const el = this.guideEl;
        while (el.firstChild) el.removeChild(el.firstChild);
        if (!this.isEditing() || this.formatMode || !this.s.guide || !this.canInteract || this.axes.length < 3) return;
        const hc = this.hc().on;
        const azul = hc ? "#FFFF00" : "#2B6CB0";
        const fg = hc ? "#FFFFFF" : "#252423";
        const muted = hc ? "#FFFFFF" : "#605E5C";
        el.style.display = "block";
        el.style.background = hc ? "#000000" : "#FFFFFF";
        el.style.borderColor = azul;
        el.style.color = fg;
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", this.t("Guide_Title", "Setup guide"));
        el.onclick = (e) => e.stopPropagation();
        el.onkeydown = (e) => e.stopPropagation();
        const terminar = () => {
            this.guideStep = 2;
            this.host.persistProperties({ merge: [{ objectName: "style", selector: null as any, properties: { guide: false } }] });
        };
        const boton = (texto: string, principal: boolean, accion: () => void) => {
            const b = document.createElement("button");
            b.type = "button"; b.textContent = texto;
            b.className = principal ? "tcrd-g-btn tcrd-g-main" : "tcrd-g-btn";
            b.style.borderColor = azul;
            b.style.background = principal ? azul : "transparent";
            b.style.color = principal ? (hc ? "#000000" : "#FFFFFF") : azul;
            b.addEventListener("click", accion);
            return b;
        };
        const cab = document.createElement("div"); cab.className = "tcrd-g-head";
        const paso = document.createElement("div");
        paso.textContent = this.t("Guide_Step", "Setup · step {0} of 3").replace("{0}", String(this.guideStep));
        paso.style.color = azul;
        const cerrar = document.createElement("button");
        cerrar.type = "button"; cerrar.textContent = "✕"; cerrar.className = "tcrd-g-close";
        cerrar.title = this.t("Guide_Close", "Close the guide");
        cerrar.setAttribute("aria-label", cerrar.title);
        cerrar.style.color = muted;
        cerrar.addEventListener("click", terminar);
        cab.appendChild(paso); cab.appendChild(cerrar);
        el.appendChild(cab);
        const titulo = document.createElement("div"); titulo.className = "tcrd-g-title";
        el.appendChild(titulo);
        const pie = document.createElement("div"); pie.className = "tcrd-g-foot";
        if (this.guideStep !== 3) {
            titulo.textContent = this.t("Guide_Compare", "Compare and read");
            const items: [boolean, string, string][] = [
                [this.roleBound("series"), this.t("Role_series", "Series (legend)"), this.t("Guide_SeriesWhy", "one shape per supplier, person or product")],
                [this.roleBound("target"), this.t("Role_target", "Target (Pro)"), this.t("Guide_TargetWhy", "the required level and the gap on every axis")],
                [this.roleBound("panel"), this.t("Role_panel", "Small multiples (Pro)"), this.t("Guide_PanelWhy", "one radar per team or category, same scale")],
                [this.roleBound("axisGroup"), this.t("Role_axisGroup", "Axis group (Pro)"), this.t("Guide_GroupWhy", "named arcs: technical, personal")],
            ];
            const lista = document.createElement("div"); lista.setAttribute("role", "list");
            for (const [hecho, nombre, porque] of items) {
                const f = document.createElement("div"); f.setAttribute("role", "listitem"); f.className = "tcrd-g-item";
                const marca = document.createElement("span");
                marca.textContent = hecho ? "✓" : "○";
                marca.setAttribute("aria-label", hecho ? this.t("Guide_Done", "added") : this.t("Guide_Todo", "not added"));
                marca.style.color = hecho ? (hc ? "#00FF00" : "#107C10") : muted;
                const txt = document.createElement("span");
                const b = document.createElement("b"); b.textContent = nombre;
                txt.appendChild(b); txt.appendChild(document.createTextNode(" — " + porque));
                txt.style.color = hecho ? muted : fg;
                f.appendChild(marca); f.appendChild(txt);
                lista.appendChild(f);
            }
            el.appendChild(lista);
            const nota = document.createElement("div"); nota.className = "tcrd-g-note"; nota.style.color = muted;
            nota.textContent = this.t("Guide_Wells", "Drag the fields into the field wells; this list updates by itself. All optional.");
            el.appendChild(nota);
            pie.appendChild(boton(this.t("Guide_Next", "Next"), true, () => { this.guideStep = 3; this.renderGuide(); }));
        } else {
            titulo.textContent = this.t("Guide_Style", "Pick a style");
            const rejilla = document.createElement("div"); rejilla.className = "tcrd-g-grid";
            for (const nombre of Object.keys(TEMPLATES)) {
                const tpl = { ...DEFAULTS, ...TEMPLATES[nombre] };
                const chip = document.createElement("button");
                chip.type = "button";
                const actual = nombre === this.s.template;
                chip.setAttribute("aria-pressed", String(actual));
                chip.className = "tcrd-g-chip";
                chip.style.borderColor = actual ? azul : "#C8C6C4";
                chip.style.borderWidth = actual ? "2px" : "1px";
                chip.appendChild(this.miniRadar(tpl, nombre === "ibcs" ? IBCS_GREYS[0] : this.series[0]?.color || "#2B6CB0", hc));
                const etq = document.createElement("div");
                etq.textContent = this.t("Enum_tpl_" + nombre, nombre.charAt(0).toUpperCase() + nombre.slice(1));
                chip.appendChild(etq);
                chip.addEventListener("click", () => {
                    this.host.persistProperties({ merge: [{ objectName: "style", selector: null as any, properties: { template: nombre } }] });
                });
                rejilla.appendChild(chip);
            }
            el.appendChild(rejilla);
            pie.appendChild(boton(this.t("Guide_Back", "Back"), false, () => { this.guideStep = 2; this.renderGuide(); }));
            pie.appendChild(boton(this.t("Guide_Finish", "Finish"), true, terminar));
        }
        el.appendChild(pie);
    }

    /** Miniatura de una plantilla: un radar de cinco ejes con su rejilla y su relleno. */
    private miniRadar(t: Settings, color: string, hc: boolean): SVGSVGElement {
        const svg = document.createElementNS(SVG, "svg") as SVGSVGElement;
        svg.setAttribute("width", "60"); svg.setAttribute("height", "44"); svg.setAttribute("aria-hidden", "true");
        const cx = 30, cy = 23, R = 18;
        const at = (f: number, j: number) => [cx + Math.cos(-Math.PI / 2 + 2 * Math.PI * j / 5) * R * f, cy + Math.sin(-Math.PI / 2 + 2 * Math.PI * j / 5) * R * f];
        const poly = (fr: number[]) => "M" + fr.map((f, j) => at(f, j).map(v => v.toFixed(1)).join(",")).join("L") + "Z";
        for (const f of [0.5, 1]) {
            const d = t.gridShape === "circle" ? `M${cx - R * f},${cy}a${R * f},${R * f} 0 1,0 ${2 * R * f},0a${R * f},${R * f} 0 1,0 ${-2 * R * f},0Z` : poly([f, f, f, f, f]);
            this.el("path", { d, fill: "none", stroke: hc ? "#FFFFFF" : t.gridColor, "stroke-width": 1 }, svg);
        }
        const d = poly([0.9, 0.55, 0.8, 0.45, 0.7]);
        if (t.fillOpacity > 0 && !hc) this.el("path", { d, fill: color, "fill-opacity": t.fillOpacity / 100 }, svg);
        this.el("path", { d, fill: "none", stroke: hc ? "#FFFFFF" : color, "stroke-width": Math.min(3, t.lineWidth) }, svg);
        return svg;
    }

    // ── Interacción ───────────────────────────────────────────────────────────

    private wire(g: SVGGElement, p: Pt): void {
        g.addEventListener("click", (e) => {
            if (this.formatMode) return;
            e.stopPropagation();
            this.keyboardNav = false;
            this.selectKeys([p.key], e.ctrlKey || e.metaKey);
        });
        g.addEventListener("contextmenu", (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!this.canInteract) return;
            this.selectionManager.showContextMenu(p.ids[0] ?? ({} as ISelectionId), { x: e.clientX, y: e.clientY });
        });
        g.addEventListener("mousemove", (e) => this.showTooltip(p, e.clientX, e.clientY));
        g.addEventListener("mouseleave", () => this.host.tooltipService.hide({ immediately: false, isTouchEvent: false }));
        g.addEventListener("focus", () => { const r = g.getBoundingClientRect(); this.showTooltip(p, r.left + r.width / 2, r.top); });
        g.addEventListener("blur", () => this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }));
        g.addEventListener("keydown", (e: KeyboardEvent) => {
            this.keyboardNav = true;
            const all = Array.from(this.svg.querySelectorAll<SVGGElement>("g[data-pt]"));
            const i = all.indexOf(g);
            const go = (j: number) => {
                const k = (j + all.length) % all.length;
                all.forEach((x, m) => x.setAttribute("tabindex", m === k ? "0" : "-1"));
                this.focusKey = all[k]?.getAttribute("data-pt") || "";
                all[k]?.focus();
            };
            let handled = true;
            switch (e.key) {
                case "ArrowRight": case "ArrowDown": go(i + 1); break;
                case "ArrowLeft": case "ArrowUp": go(i - 1); break;
                case "Home": go(0); break;
                case "End": go(all.length - 1); break;
                case "Enter": case " ": this.selectKeys([p.key], e.ctrlKey || e.metaKey); break;
                case "Escape": if (this.canInteract) this.selectionManager.clear().then(() => this.paintSelection()); break;
                case "ContextMenu": {
                    const r = g.getBoundingClientRect();
                    if (this.canInteract) this.selectionManager.showContextMenu(p.ids[0] ?? ({} as ISelectionId), { x: r.left + r.width / 2, y: r.top });
                    break;
                }
                default: handled = false;
            }
            if (handled) { e.preventDefault(); e.stopPropagation(); }
        });
    }

    private keyOf(id: any): string {
        const k = id?.getKey?.();
        if (typeof k === "string") return k;
        const sel = id?.getSelector?.();
        // Sin clave ni selector no se puede deduplicar: cada identidad cuenta como distinta.
        return sel ? JSON.stringify(sel) : "#" + (++this.keySeq);
    }

    private keysWhere(f: (p: Pt) => boolean): string[] {
        const out: string[] = [];
        this.pts.forEach(p => { if (f(p) && this.axisByKey(p.axis)) out.push(p.key); });
        return out;
    }

    /** Puntos seleccionados según Power BI (clic propio o marcador restaurado). */
    private selectedPts(): Set<string> {
        const own = this.selectionManager.getSelectionIds() as ISelectionId[];
        const sel = own.length ? own : this.restoredIds;
        const out = new Set<string>();
        for (const id of sel) {
            const k = this.idToPt.get(this.keyOf(id));
            if (k) { out.add(k); continue; }
            // Un marcador puede devolver la identidad con otra forma que la del clic: equals/includes contra cada punto.
            const igual = (x: any) => !!(x?.equals?.(id) || (id as any)?.equals?.(x) || (id as any)?.includes?.(x, true) || x?.includes?.(id, true));
            this.pts.forEach(p => { if (p.ids.some(igual)) out.add(p.key); });
        }
        return out;
    }

    /**
     * Selección por puntos, con TODAS sus identidades (un punto puede venir de varias filas). Seleccionar
     * una lista no alterna, así que volver a pulsar lo único seleccionado se resuelve aquí con clear().
     */
    private selectKeys(keys: string[], multi: boolean): void {
        if (!this.canInteract || !keys.length) return;
        const actual = this.selectedPts();
        this.restoredIds = [];
        let siguiente: Set<string>;
        if (multi) {
            siguiente = new Set(actual);
            const todos = keys.every(k => actual.has(k));
            keys.forEach(k => todos ? siguiente.delete(k) : siguiente.add(k));
        } else {
            const mismo = actual.size === keys.length && keys.every(k => actual.has(k));
            siguiente = mismo ? new Set() : new Set(keys);
        }
        const ids: ISelectionId[] = [];
        siguiente.forEach(k => { const p = this.pts.get(k); if (p) ids.push(...p.ids); });
        if (DEBUG_SEL) {
            this.noteEl.style.display = "block";
            this.noteEl.style.background = "#FFF7E6";
            this.noteEl.style.color = "#3D3929";
            this.noteEl.textContent = `DIAG puntos=${siguiente.size} ids=${ids.length} clave1=${ids[0] ? this.keyOf(ids[0]) : "-"}`;
        }
        (ids.length ? this.selectionManager.select(ids, false) : this.selectionManager.clear()).then(() => this.paintSelection());
    }

    private showTooltip(p: Pt, x: number, y: number): void {
        const a = this.axisByKey(p.axis);
        const se = this.series[p.si];
        const f = this.pointFmt(p);
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [];
        if (p.panel !== null) items.push({ displayName: this.t("UI_Panel", "Panel"), value: p.panel });
        if (se?.name) items.push({ displayName: this.t("UI_Series", "Series"), value: se.name, color: se.color } as any);
        items.push({ displayName: this.t("UI_Axis", "Axis"), value: p.axis });
        items.push({ displayName: this.measuresAsAxes ? p.axis : (this.lastDv?.metadata?.columns?.find(c => c.roles?.["values"])?.displayName || this.t("Role_values", "Values")),
            value: p.value === null ? this.t("UI_Blank", "(Blank)") : f(p.value) });
        if (p.hl !== null && this.hasHighlights) items.push({ displayName: this.t("UI_Highlighted", "Highlighted"), value: f(p.hl) });
        const s = this.effective();
        const tgt = p.target ?? (this.hasTarget ? this.targetOf(p.panel, p.axis) : null);
        if (tgt !== null) {
            items.push({ displayName: this.t("UI_Target", "Target"), value: f(tgt) });
            if (p.value !== null) {
                const d = p.value - tgt;
                items.push({ displayName: this.t("UI_Gap", "Gap"), value: (d > 0 ? "+" : d < 0 ? "−" : "") + f(Math.abs(d)) });
                if (s.scaleMode === "target") items.push({ displayName: this.t("UI_PctTarget", "% of target"), value: Math.round(p.value / tgt * 100) + "%" });
            }
        }
        if (a?.reversed) items.push({ displayName: this.t("UI_Scale", "Scale"), value: this.t("UI_LowerBetter", "lower is better") });
        if (s.scaleMode === "perAxis" && a) {
            const sc = this.scales(s).get(a.key);
            items.push({ displayName: this.t("UI_Scale", "Scale"), value: this.t("UI_ScaledPerAxis", "own scale for this axis: {0} to {1}").replace("{0}", f(sc.lo)).replace("{1}", f(sc.hi)) });
        }
        if (p.note) items.push({ displayName: this.t("Role_note", "Note"), value: p.note });
        for (const tp of p.tips) items.push({ displayName: tp.name, value: tp.value });
        this.host.tooltipService.show({ dataItems: items as any, identities: p.ids, coordinates: [x, y], isTouchEvent: false });
    }

    private paintSelection(): void {
        const elegidos = this.selectedPts();
        const has = elegidos.size > 0;
        const seriesOn = new Set<number>();
        elegidos.forEach(k => { const p = this.pts.get(k); if (p) seriesOn.add(p.si); });
        this.svg.querySelectorAll<SVGGElement>("g[data-pt]").forEach(g => {
            const on = !has || elegidos.has(g.getAttribute("data-pt") || "");
            g.setAttribute("opacity", on ? "1" : "0.3");
            g.setAttribute("aria-selected", has && on ? "true" : "false");
        });
        this.svg.querySelectorAll<SVGGElement>("g[data-shape]").forEach(g => {
            const si = this.series.findIndex(x => x.key === g.getAttribute("data-shape"));
            g.setAttribute("opacity", !has || seriesOn.has(si) ? "1" : "0.25");
        });
        this.svg.querySelectorAll<SVGGElement>("g[data-series]").forEach(g => {
            const si = this.series.findIndex(x => x.key === g.getAttribute("data-series"));
            g.setAttribute("opacity", !has || seriesOn.has(si) ? "1" : "0.4");
        });
        const gapSi = this.series.length === 1 ? 0 : seriesOn.size === 1 ? Array.from(seriesOn)[0] : -1;
        this.svg.querySelectorAll<SVGTextElement>("text[data-gap]").forEach(t => {
            t.style.display = Number(t.getAttribute("data-gap")) === gapSi ? "" : "none";
        });
        const all = this.svg.querySelectorAll<SVGGElement>("g[data-pt]");
        if (all.length && !this.svg.querySelector("g[data-pt][tabindex='0']")) {
            const f = Array.from(all).find(g => g.getAttribute("data-pt") === this.focusKey) || all[0];
            f.setAttribute("tabindex", "0");
        }
        if (this.keyboardNav) this.svg.querySelector<SVGGElement>("g[data-pt][tabindex='0']")?.focus();
        const n = this.axes.length;
        this.svg.setAttribute("aria-label", this.t("UI_AriaRadar", "Radar chart") + ": " + n + " " + this.t("UI_AriaAxes", "axes") + ", " + this.series.length + " " + this.t("UI_AriaSeries", "series"));
    }

    // ── Pantalla de inicio ────────────────────────────────────────────────────

    /**
     * Qué es, cómo empezar con los pozos reales, ayuda y qué añade el Pro. Tres tamaños. Los enlaces
     * solo se abren al hacer clic (host.launchUrl); el Pro es texto, sin botón de compra.
     */
    private landing(w: number, h: number): void {
        this.svg.style.display = "none";
        const el = this.landingEl;
        while (el.firstChild) el.removeChild(el.firstChild);
        const size = (w >= 600 && h >= 340) ? "l" : (w >= 360 && h >= 220) ? "m" : "s";
        el.className = "tcrd-landing tcrd-landing-" + size;
        el.style.display = "flex";
        const hc = this.hc();
        const fg = hc.on ? hc.fg : "";
        const mk = (tag: string, cls?: string, text?: string): HTMLElement => {
            const n = document.createElement(tag);
            if (cls) n.className = cls;
            if (text !== undefined) n.textContent = text;
            if (fg) n.style.color = fg;
            return n;
        };
        const T = (k: string, d: string) => this.t(k, d);
        const axis = T("Role_axis", "Axis"), val = T("Role_values", "Values"), ser = T("Role_series", "Series (legend)");
        const box = mk("div", "tcrd-l-box");
        el.appendChild(box);
        const head = mk("div", "tcrd-l-head");
        const img = document.createElement("img");
        img.src = LANDING_ICON; img.alt = ""; img.className = "tcrd-l-icon";
        head.appendChild(img);
        const titles = mk("div");
        titles.appendChild(mk("div", "tcrd-l-title", "Radar & Spider Chart by TCViz"));
        if (size !== "s") titles.appendChild(mk("div", "tcrd-l-tag", size === "l"
            ? T("Landing_Tagline", "Compare profiles on several criteria at once, on a scale that does not move.")
            : T("Landing_TaglineShort", "Profiles on several criteria, on a fixed scale.")));
        head.appendChild(titles);
        box.appendChild(head);
        const link = (txt: string, url: string, cls: string): HTMLElement => {
            const a = mk("a", cls) as HTMLAnchorElement;
            a.href = url; a.tabIndex = 0; a.textContent = txt;
            if (hc.on) { a.style.background = "transparent"; a.style.borderColor = fg; }
            const open = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.host.launchUrl(url); };
            a.addEventListener("click", open);
            a.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") open(e); });
            return a;
        };
        const links: [string, string, string][] = [
            [T("Landing_Guide", "Guide"), T("Landing_GuideSub", "support page"), URL_GUIDE],
            [T("Landing_Product", "Product page"), "tcviz.com", URL_PRODUCT],
        ];
        if (URL_VIDEO) links.push([T("Landing_Video", "Video"), "YouTube", URL_VIDEO]);
        if (size === "s") {
            box.appendChild(mk("p", "tcrd-l-do", T("Landing_Small", "Add {axis} and {val}; {ser} to compare.").replace("{axis}", axis).replace("{val}", val).replace("{ser}", ser)));
            const row = mk("div", "tcrd-l-inline");
            row.appendChild(link(links[0][0], links[0][2], "tcrd-l-a"));
            box.appendChild(row);
            return;
        }
        const L = size === "l";
        const steps = mk("ol", "tcrd-l-steps");
        const step = (n: number, well: string, txt: string) => {
            const li = mk("li");
            const num = mk("b", "tcrd-l-n", String(n));
            if (hc.on) { num.style.background = fg; num.style.color = hc.bg; }
            li.appendChild(num);
            const sp = mk("span");
            sp.appendChild(mk("strong", "tcrd-l-well", well));
            sp.appendChild(document.createTextNode(" · " + txt));
            li.appendChild(sp);
            steps.appendChild(li);
        };
        step(1, axis, L ? T("Landing_Step1", "one spoke per criterion: quality, price, delivery") : T("Landing_Step1Short", "one spoke per criterion"));
        step(2, val, L ? T("Landing_Step2", "the score, such as 1 to 5 — or several measures, each one an axis") : T("Landing_Step2Short", "the score on each axis"));
        step(3, ser, L ? T("Landing_Step3", "what you compare: supplier, employee, product") : T("Landing_Step3Short", "what you compare"));
        if (L) {
            const cols = mk("div", "tcrd-l-cols");
            const c1 = mk("div");
            c1.appendChild(mk("div", "tcrd-l-lbl", T("Landing_Start", "Start in 3 steps")));
            c1.appendChild(steps);
            const c2 = mk("div");
            c2.appendChild(mk("div", "tcrd-l-lbl", T("Landing_Help", "Help")));
            const list = mk("div", "tcrd-l-links");
            for (const [txt, sub, url] of links) {
                const a = link(txt, url, "tcrd-l-card");
                a.appendChild(mk("small", "tcrd-l-sub", sub));
                list.appendChild(a);
            }
            c2.appendChild(list);
            cols.appendChild(c1); cols.appendChild(c2);
            box.appendChild(cols);
        } else {
            box.appendChild(steps);
            const row = mk("div", "tcrd-l-inline");
            for (const l of links) row.appendChild(link(l[1] === "tcviz.com" ? "tcviz.com" : l[0], l[2], "tcrd-l-a"));
            box.appendChild(row);
        }
        if (!this.isPro) {
            const pro = mk("div", "tcrd-l-pro");
            const chip = mk("span", "tcrd-l-chip", "Pro");
            if (hc.on) { chip.style.background = "transparent"; chip.style.border = "1px solid " + fg; }
            pro.appendChild(chip);
            pro.appendChild(mk("span", undefined, L
                ? T("Landing_Pro", "More than 3 series, a target with the gap on each axis, a scale per axis, bands, small multiples, axis groups and a value table.")
                : T("Landing_ProShort", "More series, targets, scale per axis, small multiples.")));
            box.appendChild(pro);
        }
    }

    // ── Licencia ──────────────────────────────────────────────────────────────

    /** Se pide una vez, cuando hay datos. Al llegar se repinta sin llamar a update(). */
    private requestLicense(): void {
        if (this.licenseRequested) return;
        this.licenseRequested = true;
        if (this.isPro) { this.licenseResolved = true; return; }
        try {
            const lm: any = (this.host as any).licenseManager;
            if (!lm) { this.licenseEnvUnsupported = true; this.licenseResolved = true; return; }
            lm.getAvailableServicePlans().then(
                (r: any) => {
                    if (r?.isLicenseUnsupportedEnv === true || r?.isLicenseInfoAvailable === false) this.licenseEnvUnsupported = true;
                    const plans: any[] = r?.plans ?? [];
                    // Solo Active y Warning (periodo de gracia por un problema de pago) son licencias utilizables.
                    if (plans.some(p => isOurPaidPlan(p.spIdentifier) && (p.state === STATE_ACTIVE || p.state === STATE_WARNING))) this.isPro = true;
                    this.licenseResolved = true;
                    this.refreshAfterLicense();
                },
                () => { this.licenseEnvUnsupported = true; this.licenseResolved = true; this.refreshAfterLicense(); });
        } catch {
            this.licenseEnvUnsupported = true; this.licenseResolved = true;
        }
    }

    private refreshAfterLicense(): void {
        if (this.destroyed || !this.lastOptions) return;
        // Las funciones Pro cambian qué se lee (series, objetivo, paneles): se recalcula y se repinta.
        this.hasData = this.readData(this.lastDv);
        this.draw();
    }

    private cancelLicenseIcon(): void {
        if (this.licenseIconTimer !== null) { window.clearTimeout(this.licenseIconTimer); this.licenseIconTimer = null; }
    }

    private clearLicenseNotice(): void {
        this.lastBlockedNotice = "";
        this.cancelLicenseIcon();
        if (!this.licenseIconShown) return;
        this.licenseIconShown = false;
        try { (this.host as any).licenseManager?.clearLicenseNotification?.(); } catch { /* best-effort */ }
    }

    /**
     * Avisos de Power BI, nunca una interfaz de licencias propia. Orden: limpiar lo que haya, banner
     * con la función, y ~10 s después la barra Upgrade, que es la que lleva a la compra.
     */
    private notifyProFeatureBlocked(): void {
        const lm: any = (this.host as any).licenseManager;
        if (!lm) return;
        if (this.isPro) { this.clearLicenseNotice(); return; }
        const wanted = this.attemptedPro();
        if (!wanted.length) { this.clearLicenseNotice(); return; }
        if (!this.licenseResolved || this.licenseEnvUnsupported) return;
        const signature = wanted.map(w => w.id).join("|") + "|" + JSON.stringify(this.lastDv?.metadata?.objects ?? {});
        if (signature === this.lastBlockedNotice) return;
        this.lastBlockedNotice = signature;
        this.licenseIconShown = true;
        const list = wanted.map(w => w.label).join(", ");
        const msg = (this.isPreview()
            ? this.t("UI_NoticePreview", "Radar chart: {0} — part of the Pro plan, shown here as a watermarked preview. Reading view shows the free result.")
            : this.t("UI_NoticeBlocked", "Radar chart: {0} — part of the Pro plan. Get a licence to enable it.")).replace("{0}", list);
        const show = () => {
            try { lm.notifyFeatureBlocked?.(msg.slice(0, 500)); } catch { /* best-effort */ }
            this.cancelLicenseIcon();
            this.licenseIconTimer = window.setTimeout(() => {
                this.licenseIconTimer = null;
                if (this.destroyed || this.isPro || !this.licenseIconShown) return;
                try { lm.notifyLicenseRequired?.(NOTIFY_GENERAL); } catch { /* best-effort */ }
            }, 10500);
        };
        let cleared: any;
        try { cleared = lm.clearLicenseNotification?.(); } catch { /* best-effort */ }
        if (cleared && typeof cleared.then === "function") cleared.then(show, show); else show();
    }

    // ── Formato desde el lienzo (on-object) ───────────────────────────────────

    private subSelectable(el: Element, objectName: string, displayName: string, type: powerbi.visuals.SubSelectionStylesType): void {
        if (!this.formatMode) { el.classList.remove(HtmlSubSelectableClass); return; }
        el.classList.add(HtmlSubSelectableClass);
        el.setAttribute(SubSelectableObjectNameAttribute, objectName);
        el.setAttribute(SubSelectableDisplayNameAttribute, displayName);
        el.setAttribute(SubSelectableTypeAttribute, String(type));
    }

    private updateOutlines(options: VisualUpdateOptions): void {
        if (!this.formatMode) return;
        const subs = (options as any).subSelections as powerbi.visuals.CustomVisualSubSelection[] | undefined;
        this.subSelectionHelper.updateOutlinesFromSubSelections(subs ?? [], true);
    }

    private getSubSelectionStyles(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const ref = (objectName: string, propertyName: string, label: string) => ({ reference: { objectName, propertyName }, label });
        switch (name) {
            case "series":
                return { type: powerbi.visuals.SubSelectionStylesType.Shape,
                    fill: ref("markers", "fill", this.t("Prop_markers_fill", "Marker color (Pro rules)")) } as any;
            case "grid":
                return { type: powerbi.visuals.SubSelectionStylesType.Shape,
                    stroke: ref("grid", "color", this.t("Prop_grid_color", "Line color")) } as any;
            case "axisLabels":
                return { type: powerbi.visuals.SubSelectionStylesType.Text,
                    fontFamily: ref("axisLabels", "fontFamily", this.t("Prop_axisLabels_fontFamily", "Font")),
                    bold: ref("axisLabels", "bold", this.t("Prop_axisLabels_bold", "Bold")),
                    fontSize: ref("axisLabels", "fontSize", this.t("Prop_axisLabels_fontSize", "Text size")),
                    fontColor: ref("axisLabels", "color", this.t("Prop_axisLabels_color", "Text color")) } as any;
            case "legend":
                return { type: powerbi.visuals.SubSelectionStylesType.Text,
                    fontSize: ref("legend", "fontSize", this.t("Prop_legend_fontSize", "Text size")),
                    fontColor: ref("legend", "color", this.t("Prop_legend_color", "Text color")) } as any;
            case "background":
                return { type: powerbi.visuals.SubSelectionStylesType.Shape,
                    fill: ref("background", "color", this.t("Prop_background_color", "Color")) } as any;
        }
        return undefined;
    }

    private getSubSelectionShortcuts(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.VisualSubSelectionShortcuts | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const id = (objectName: string, propertyName: string) => ({ objectName, propertyName });
        const nav = (card: string, label: string) => ({ type: powerbi.visuals.VisualShortcutType.Navigate, destinationInfo: { cardUid: "Visual-" + card + "_card" }, label });
        switch (name) {
            case "series":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Toggle, ...id("markers", "show"), relatedToggledFormattingIds: [id("markers", "show")],
                        disabledLabel: this.t("UI_HideMarkers", "Hide markers"), enabledLabel: this.t("UI_ShowMarkers", "Show markers") },
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("style", "template"), label: this.t("Prop_style_template", "Template") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("series", "fillOpacity"), id("series", "lineWidth"), id("markers", "size")] },
                    nav("series", this.t("Obj_series", "Series")),
                ] as any;
            case "grid":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("grid", "shape"), label: this.t("Prop_grid_shape", "Shape") },
                    { type: powerbi.visuals.VisualShortcutType.Toggle, ...id("grid", "ringLabels"), relatedToggledFormattingIds: [id("grid", "ringLabels")],
                        disabledLabel: this.t("UI_HideRings", "Hide ring values"), enabledLabel: this.t("UI_ShowRings", "Show ring values") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    nav("scale", this.t("Obj_scale", "Scale")),
                ] as any;
            case "axisLabels":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("axisLabels", "fontSize"), id("axisLabels", "color")] },
                    nav("axisLabels", this.t("Obj_axisLabels", "Axis labels")),
                ] as any;
            case "legend":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("legend", "position"), label: this.t("Prop_legend_position", "Position") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("legend", "fontSize"), id("legend", "color")] },
                    nav("legend", this.t("Obj_legend", "Legend")),
                ] as any;
            case "background":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("background", "color")] },
                    nav("background", this.t("Obj_background", "Background")),
                ] as any;
        }
        return undefined;
    }

    // ── Panel de formato ──────────────────────────────────────────────────────

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const s = this.s;
        const T = (k: string, fb: string) => this.t(k, fb);
        const d = (obj: string, prop: string) => ({ objectName: obj, propertyName: prop });
        const name = (obj: string, prop: string, fb: string) => T(`Prop_${obj}_${prop}`, fb);
        const num = (obj: string, prop: string, fb: string, v: number) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.NumUpDown, properties: { descriptor: d(obj, prop), value: v } } });
        const tog = (obj: string, prop: string, fb: string, v: boolean) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.ToggleSwitch, properties: { descriptor: d(obj, prop), value: v } } });
        const font = (obj: string, prop: string, fb: string, v: string) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.FontPicker, properties: { descriptor: d(obj, prop), value: v || "Segoe UI" } } });
        const txt = (obj: string, prop: string, fb: string, v: string) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.TextInput, properties: { descriptor: d(obj, prop), value: v, placeholder: "" } } });
        const col = (obj: string, prop: string, fb: string, v: string, cf = false) => ({
            uid: `${obj}_${prop}`, displayName: name(obj, prop, fb),
            control: { type: powerbi.visuals.FormattingComponent.ColorPicker, properties: {
                descriptor: { ...d(obj, prop), ...(cf ? {
                    instanceKind: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule,
                    selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals) as any,
                } : {}) },
                value: { value: v || "" },
            } },
        });
        const dd = (obj: string, prop: string, fb: string, v: string, items: [string, string, string][]) => {
            const list = items.map(([value, key, f]) => ({ value, displayName: T(key, f) }));
            return { uid: `${obj}_${prop}`, displayName: name(obj, prop, fb),
                control: { type: powerbi.visuals.FormattingComponent.Dropdown, properties: { descriptor: d(obj, prop), value: list.find(x => x.value === v) ?? list[0], items: list } as any } };
        };
        const card = (obj: string, fb: string, slices: any[]) => ({ uid: `${obj}_card`, displayName: T(`Obj_${obj}`, fb), groups: [{ uid: `${obj}_g`, displayName: "", slices }] });
        // Un color por serie, guardado con el selector de la serie (o de la medida, si cada medida es una serie).
        const seriesColors = this.series.filter(x => x.selector).map((se, k) => ({
            uid: `series_fill_${k}`, displayName: se.name || T("Prop_series_fill", "Color"),
            control: { type: powerbi.visuals.FormattingComponent.ColorPicker, properties: {
                descriptor: { objectName: "series", propertyName: "fill", selector: se.selector }, value: { value: se.color } } },
        }));

        return { cards: [
            card("style", "Style template", [
                dd("style", "template", "Template", s.template, [["clean", "Enum_tpl_clean", "Clean"], ["classic", "Enum_tpl_classic", "Classic"],
                    ["minimal", "Enum_tpl_minimal", "Minimal"], ["contrast", "Enum_tpl_contrast", "Contrast"], ["compact", "Enum_tpl_compact", "Compact"],
                    ["ibcs", "Enum_tpl_ibcs", "IBCS style"]]),
                tog("style", "guide", "Setup guide", s.guide),
            ]),
            card("series", "Series", [
                ...seriesColors,
                num("series", "fillOpacity", "Fill opacity %", s.fillOpacity),
                num("series", "lineWidth", "Line width", s.lineWidth),
            ]),
            card("markers", "Markers", [
                tog("markers", "show", "Show", s.markers),
                num("markers", "size", "Size", s.markerSize),
                col("markers", "fill", "Marker color (Pro rules)", s.markerColor, true),
            ]),
            card("labels", "Data labels", [
                tog("labels", "show", "Show", s.labels),
                num("labels", "fontSize", "Text size", s.labelFont),
                col("labels", "color", "Text color", s.labelColor),
            ]),
            card("scale", "Scale", [
                dd("scale", "mode", "Scale", s.scaleMode, [["common", "Enum_sc_common", "Common to all axes"], ["perAxis", "Enum_sc_perAxis", "Per axis (Pro)"],
                    ["target", "Enum_sc_target", "% of target (Pro)"]]),
                tog("scale", "zero", "Start at zero", s.zero),
                tog("scale", "auto", "Automatic range", s.auto),
                num("scale", "min", "Minimum", s.min),
                num("scale", "max", "Maximum", s.max),
                num("scale", "rings", "Rings", s.rings),
                txt("scale", "reversed", "Lower is better (Pro): axis names, comma separated", s.reversed),
            ]),
            card("grid", "Grid", [
                dd("grid", "shape", "Shape", s.gridShape, [["polygon", "Enum_gr_polygon", "Polygon"], ["circle", "Enum_gr_circle", "Circle"]]),
                col("grid", "color", "Line color", s.gridColor),
                tog("grid", "spokes", "Spokes", s.spokes),
                tog("grid", "ringLabels", "Ring values", s.ringLabels),
                num("grid", "fontSize", "Text size", s.gridFont),
                col("grid", "labelColor", "Text color", s.gridLabelColor),
            ]),
            card("axisLabels", "Axis labels", [
                tog("axisLabels", "show", "Show", s.axLabels),
                num("axisLabels", "fontSize", "Text size", s.axFont),
                col("axisLabels", "color", "Text color", s.axColor),
                font("axisLabels", "fontFamily", "Font", s.axFamily),
                tog("axisLabels", "bold", "Bold", s.axBold),
                num("axisLabels", "maxChars", "Maximum characters (0 = automatic)", s.axMaxChars),
            ]),
            card("axisOrder", "Axis order", [
                dd("axisOrder", "by", "Order axes by", s.orderBy, [["data", "Enum_ao_data", "Data order"], ["name", "Enum_ao_name", "Name"], ["value", "Enum_ao_value", "Value of the first series"]]),
                tog("axisOrder", "descending", "Descending", s.descending),
            ]),
            card("target", "Target", [
                col("target", "color", "Target color", s.targetColor),
                tog("target", "showGap", "Show the gap per axis", s.showGap),
                col("target", "goodColor", "Above target color", s.goodColor),
                col("target", "badColor", "Below target color", s.badColor),
            ]),
            card("bands", "Bands", [
                tog("bands", "show", "Show bands (Pro)", s.bands),
                num("bands", "low", "First band ends at %", s.bandLow),
                num("bands", "high", "Second band ends at %", s.bandHigh),
                col("bands", "lowColor", "Low band color", s.bandLowColor),
                col("bands", "midColor", "Middle band color", s.bandMidColor),
                col("bands", "highColor", "High band color", s.bandHighColor),
                num("bands", "opacity", "Band opacity %", s.bandOpacity),
            ]),
            card("axisGroups", "Axis groups", [
                num("axisGroups", "fontSize", "Text size", s.groupFont),
                col("axisGroups", "color", "Text color", s.groupColor),
            ]),
            card("annotations", "Annotations", [
                tog("annotations", "show", "Show", s.notes),
                num("annotations", "fontSize", "Text size", s.noteFont),
                col("annotations", "color", "Text color", s.noteColor),
            ]),
            card("center", "Center", [
                tog("center", "axesMean", "Mean of the axes (Pro)", s.axesMean),
            ]),
            card("legend", "Legend", [
                tog("legend", "show", "Show", s.legend),
                dd("legend", "position", "Position", s.legendPos, [["top", "Enum_lg_top", "Top"], ["bottom", "Enum_lg_bottom", "Bottom"], ["right", "Enum_lg_right", "Right"]]),
                num("legend", "fontSize", "Text size", s.legendFont),
                col("legend", "color", "Text color", s.legendColor),
            ]),
            card("valueTable", "Value table", [
                tog("valueTable", "show", "Show table (Pro)", s.table),
                num("valueTable", "fontSize", "Text size", s.tableFont),
                col("valueTable", "color", "Text color", s.tableColor),
                col("valueTable", "headerBackground", "Header background", s.tableHeaderBg),
                col("valueTable", "headerColor", "Header text color", s.tableHeaderColor),
                col("valueTable", "banding", "Alternate row color", s.tableBanding),
            ]),
            card("smallMultiples", "Small multiples", [
                num("smallMultiples", "columns", "Columns (0 = automatic)", s.smCols),
                num("smallMultiples", "gap", "Space between panels", s.smGap),
                num("smallMultiples", "titleSize", "Title size", s.smTitleSize),
                col("smallMultiples", "titleColor", "Title color", s.smTitleColor),
                tog("smallMultiples", "titleBold", "Bold title", s.smTitleBold),
                dd("smallMultiples", "titleAlign", "Title alignment", s.smTitleAlign, [["left", "Enum_al_left", "Left"], ["center", "Enum_al_center", "Center"]]),
                col("smallMultiples", "background", "Panel background", s.smBackground),
                tog("smallMultiples", "border", "Panel border", s.smBorder),
                col("smallMultiples", "borderColor", "Panel border color", s.smBorderColor),
            ]),
            card("background", "Background", [
                col("background", "color", "Color", s.background),
            ]),
        ] } as any;
    }
}
