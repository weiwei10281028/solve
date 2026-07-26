import { KW_25C, pHFromH, pOHFromOH, positiveRootForWeakEquilibrium } from "../math.js";
import { positiveNumber } from "../validation.js";
export function solveWeakBase(input, approximationThreshold = 0.05) {
    const concentration = positiveNumber(input.concentration, "input.concentration");
    const Kb = positiveNumber(input.Kb, "input.Kb");
    const volumeL = input.volumeL === undefined ? 1 : positiveNumber(input.volumeL, "input.volumeL");
    const approximateX = Math.sqrt(Kb * concentration);
    const approximateRatio = approximateX / concentration;
    const exactX = positiveRootForWeakEquilibrium(Kb, concentration);
    const oh = exactX;
    const h = KW_25C / oh;
    return {
        method: "quadratic_exact",
        result: {
            H: h,
            OH: oh,
            pH: pHFromH(h),
            pOH: pOHFromOH(oh),
            B: concentration - exactX,
            BH_plus: exactX
        },
        intermediates: {
            species: input.species ?? null,
            initialConcentration: concentration,
            volumeL,
            Kb,
            approximateX,
            approximationRatio: approximateRatio,
            approximationThreshold,
            approximationValid: approximateRatio <= approximationThreshold,
            exactX
        },
        checks: {
            concentrationNonnegative: concentration - exactX >= 0,
            massBalancePassed: Math.abs((concentration - exactX) + exactX - concentration) < 1e-12,
            equilibriumResidual: Math.abs((exactX * exactX) / (concentration - exactX) - Kb)
        },
        trace: [
            { step: "classify", module: "weak_base" },
            { step: "estimate", module: "weak_base", data: { approximateX, approximateRatio } },
            { step: "solve_exact", module: "weak_base", data: { exactX } },
            { step: "calculate_ph", module: "weak_base", data: { pH: pHFromH(h), pOH: pOHFromOH(oh) } }
        ],
        warnings: approximateRatio > approximationThreshold ? ["平方根近似超過設定門檻；詳解不應直接採用 x ≪ C 近似。"] : []
    };
}
