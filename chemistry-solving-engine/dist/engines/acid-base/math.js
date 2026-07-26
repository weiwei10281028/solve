export const KW_25C = 1e-14;
export function pHFromH(h) {
    return -Math.log10(h);
}
export function pOHFromOH(oh) {
    return -Math.log10(oh);
}
export function positiveRootForWeakEquilibrium(K, C) {
    // x^2 / (C - x) = K  → x^2 + Kx - KC = 0
    return (-K + Math.sqrt(K * K + 4 * K * C)) / 2;
}
export function nearlyEqual(a, b, tolerance = 1e-10) {
    return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}
/** 雙質子酸在 [H+] = h 時的物種莫耳濃度（總分析濃度 C）。 */
export function diproticSpecies(h, C, Ka1, Ka2) {
    const h2 = h * h;
    const h3 = h2 * h;
    const D = h3 + Ka1 * h2 + Ka1 * Ka2 * h;
    const safeD = D > 0 ? D : 1e-30;
    return {
        H2A: (C * h3) / safeD,
        HA: (C * Ka1 * h2) / safeD,
        A2: (C * Ka1 * Ka2 * h) / safeD,
        OH: KW_25C / h
    };
}
function diproticChargeResidual(h, C, Ka1, Ka2) {
    const { HA, A2, OH } = diproticSpecies(h, C, Ka1, Ka2);
    return h - OH - HA - 2 * A2;
}
/** 以電荷平衡數值解雙質子酸溶液 [H+]。 */
export function solveDiproticAcidPH(C, Ka1, Ka2) {
    let lo = 1e-14;
    let hi = Math.max(C, 1e-6);
    while (diproticChargeResidual(hi, C, Ka1, Ka2) < 0 && hi < 1)
        hi *= 2;
    for (let i = 0; i < 80; i += 1) {
        const mid = (lo + hi) / 2;
        const f = diproticChargeResidual(mid, C, Ka1, Ka2);
        if (f > 0)
            hi = mid;
        else
            lo = mid;
    }
    return (lo + hi) / 2;
}
/** 兩性離子 HA- 溶液（第一當量點）的 [H+]。 */
export function solveAmphiproticPH(C, Ka1, Ka2) {
    // [H+]^2 = (Ka1*Ka2*C + Ka1*Kw) / (C + Ka2)
    const numerator = Ka1 * Ka2 * C + Ka1 * KW_25C;
    const denominator = C + Ka2;
    const h2 = numerator / denominator;
    return Math.sqrt(Math.max(h2, 1e-28));
}
