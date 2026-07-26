import { pHFromH, pOHFromOH, KW_25C } from "../math.js";
import { oneOf, positiveInteger, positiveNumber } from "../validation.js";

export function solveStrongAcidBase(input: Record<string, unknown>) {
  const kind = oneOf(input.kind, ["acid", "base"] as const, "input.kind");
  const concentration = positiveNumber(input.concentration, "input.concentration");
  const equivalents = positiveInteger(input.equivalents, "input.equivalents", 1);
  const volumeL = input.volumeL === undefined ? 1 : positiveNumber(input.volumeL, "input.volumeL");
  const effectiveConcentration = concentration * equivalents;

  const h = kind === "acid" ? effectiveConcentration : KW_25C / effectiveConcentration;
  const oh = kind === "base" ? effectiveConcentration : KW_25C / effectiveConcentration;
  const pH = pHFromH(h);
  const pOH = pOHFromOH(oh);

  return {
    method: "complete_dissociation",
    result: { H: h, OH: oh, pH, pOH },
    intermediates: {
      kind,
      analyticalConcentration: concentration,
      equivalents,
      effectiveConcentration,
      volumeL,
      soluteMoles: concentration * volumeL,
      acidBaseEquivalentMoles: concentration * volumeL * equivalents
    },
    checks: {
      concentrationNonnegative: h >= 0 && oh >= 0,
      waterIonProductPassed: Math.abs(h * oh - KW_25C) < 1e-20
    },
    trace: [
      { step: "classify", module: "strong_acid_base", data: { kind } },
      { step: "complete_dissociation", module: "strong_acid_base", data: { effectiveConcentration } },
      { step: "calculate_ph", module: "strong_acid_base", data: { pH, pOH } }
    ],
    warnings: pH < 0 || pH > 14 ? ["高濃度理想溶液可能出現高中常見範圍外的 pH；本版未做活度修正。"] : []
  };
}
