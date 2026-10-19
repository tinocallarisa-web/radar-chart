/**
 * Escalas del radar. Sin dependencias: lo que se dibuja sale de aquí y de visual.ts.
 */

/** Paso "bonito" (1, 2, 2,5, 5, 10 × 10^n) mayor o igual que raw. Con datos enteros, el paso mínimo es 1. */
export function niceStep(raw: number, minStep = 0): number {
    if (!(raw > 0) || !isFinite(raw)) return Math.max(1, minStep);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return Math.max(minStep, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p);
}

export interface Scale { lo: number; hi: number; rings: number[]; }

/**
 * Escala de rings anillos entre lo y hi, redondeada hacia fuera a un paso bonito. Con fixed, lo y hi se
 * respetan tal cual y los anillos los reparten en partes iguales (el usuario ha elegido 1-5, no 0-6).
 */
export function ringScale(lo: number, hi: number, rings: number, fixed: boolean, minStep = 0): Scale {
    const n = Math.max(2, Math.min(10, Math.round(rings) || 5));
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (hi <= lo) { const d = Math.abs(lo) || 1; hi = lo + d; }
    if (fixed) {
        // Una escala fija entera y corta (1 a 5, 0 a 10) va de uno en uno: un anillo por punto de la escala.
        const span = hi - lo;
        const m = Number.isInteger(span) && Number.isInteger(lo) && span >= 2 && span <= 10 ? span : n;
        const out: number[] = [];
        for (let k = 0; k <= m; k++) out.push(lo + span * k / m);
        return { lo, hi, rings: out };
    }
    let step = niceStep((hi - lo) / n, minStep);
    let a = Math.floor(lo / step + 1e-9) * step;
    // Que el número de anillos no se dispare cuando lo no cae en un múltiplo del paso.
    while (a + step * n < hi - 1e-9) step = niceStep(step * 1.01, minStep);
    a = Math.floor(lo / step + 1e-9) * step;
    const out: number[] = [];
    let b = a;
    for (let k = 0; k <= n && b < hi + step / 2 - 1e-9; k++) { out.push(Math.abs(b) < step / 1e6 ? 0 : b); b = a + step * (k + 1); }
    if (out[out.length - 1] < hi - 1e-9) out.push(a + step * out.length);
    return { lo: out[0], hi: out[out.length - 1], rings: out };
}

/** Posición radial 0..1 de v en la escala; invertida = "menos es mejor". Fuera de rango se recorta. */
export function frac(v: number, s: Scale, reversed: boolean): number {
    const span = s.hi - s.lo || 1;
    const f = (v - s.lo) / span;
    const g = reversed ? 1 - f : f;
    return Math.max(0, Math.min(1.05, g));
}
