import { KW_25C, pHFromH, positiveRootForWeakEquilibrium } from "../math.js";
import { positiveNumber } from "../validation.js";

export function solveWeakAcid(input: Record<string, unknown>, approximationThreshold = 0.05) {
  const concentration = positiveNumber(input.concentration, "input.concentration");
  const Ka = positiveNumber(input.Ka, "input.Ka");
  const volumeL = input.volumeL === undefined ? 1 : positiveNumber(input.volumeL, "input.volumeL");
  const approximateX = Math.sqrt(Ka * concentration);
  const approximateRatio = approximateX / concentration;
  const exactX = positiveRootForWeakEquilibrium(Ka, concentration);
  const h = exactX;
  const oh = KW_25C / h;

  return {
    method: "quadratic_exact",
    result: {
      H: h,
      OH: oh,
      pH: pHFromH(h),
      HA: concentration - exactX,
      A_minus: exactX
    },
    intermediates: {
      species: input.species ?? null,
      initialConcentration: concentration,
      volumeL,
      Ka,
      approximateX,
      approximationRatio: approximateRatio,
      approximationThreshold,
      approximationValid: approximateRatio <= approximationThreshold,
      exactX
    },
    checks: {
      concentrationNonnegative: concentration - exactX >= 0,
      massBalancePassed: Math.abs((concentration - exactX) + exactX - concentration) < 1e-12,
      equilibriumResidual: Math.abs((exactX * exactX) / (concentration - exactX) - Ka)
    },
    trace: [
      { step: "classify", module: "weak_acid" },
      { step: "estimate", module: "weak_acid", data: { approximateX, approximateRatio } },
      { step: "solve_exact", module: "weak_acid", data: { exactX } },
      { step: "calculate_ph", module: "weak_acid", data: { pH: pHFromH(h) } }
    ],
    warnings: approximateRatio > approximationThreshold ? ["平方根近似超過設定門檻；詳解不應直接採用 x ≪ C 近似。"] : []
  };
}
