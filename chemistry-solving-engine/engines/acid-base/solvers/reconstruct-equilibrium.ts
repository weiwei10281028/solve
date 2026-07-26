import { EngineError } from "../../../core/errors.js";
import { positiveNumber } from "../validation.js";
import { deriveDiproticAcidConstants } from "./derive-constants.js";

function fraction(value: unknown, field: string): number {
  const parsed = positiveNumber(value, field);
  if (parsed > 1) {
    throw new EngineError("INVALID_INPUT", `${field} 必須介於 0 與 1 之間`, field);
  }
  return parsed;
}

function nonnegativePH(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new EngineError("INVALID_INPUT", "input.pH 必須是大於或等於 0 的有限數值", "input.pH");
  }
  return value;
}

/**
 * 由二質子酸的形式濃度、總解離度與 [HA-]/[A2-] 比值，
 * 重建 H2A、HA-、A2- 的平衡濃度，並可由 pH 反推 Ka1、Ka2。
 *
 * 此處的 degreeOfDissociation 定義為：
 * ([HA-] + [A2-]) / formalConcentration
 */
export function reconstructDiproticEquilibrium(input: Record<string, unknown>) {
  const formalConcentration = positiveNumber(
    input.formalConcentration ?? input.concentration,
    "input.formalConcentration"
  );
  const degreeOfDissociation = fraction(
    input.degreeOfDissociation ?? input.firstDissociationAlpha ?? input.alpha,
    "input.degreeOfDissociation"
  );
  const ratioHAtoA2 = positiveNumber(
    input.ratioHAtoA2 ?? input.haToA2Ratio ?? input.speciesRatio,
    "input.ratioHAtoA2"
  );
  const pH = nonnegativePH(input.pH);

  const dissociatedPool = formalConcentration * degreeOfDissociation;
  const H2A = formalConcentration - dissociatedPool;
  const A_2minus = dissociatedPool / (ratioHAtoA2 + 1);
  const HA_minus = dissociatedPool - A_2minus;
  const H = 10 ** -pH;

  if (H2A <= 0) {
    throw new EngineError(
      "INVALID_STATE",
      "重建後 [H2A] 必須大於 0，否則無法反推 Ka1。",
      "input.degreeOfDissociation"
    );
  }

  const derived = deriveDiproticAcidConstants({
    pH,
    species: { H2A, HA_minus, A_2minus, H }
  });

  const massBalance = H2A + HA_minus + A_2minus;
  const ratioCalculated = HA_minus / A_2minus;
  const alphaCalculated = (HA_minus + A_2minus) / formalConcentration;

  // 純 H2A 水溶液若沒有其他帶電物種，應滿足電荷平衡。
  // 題目可能只提供局部條件，所以此項只回報差值，不直接判定輸入無效。
  const negativeChargeEquivalent = HA_minus + 2 * A_2minus;
  const chargeBalanceDifference = H - negativeChargeEquivalent;

  return {
    method: "diprotic_state_reconstruction_from_alpha_and_ratio",
    result: {
      species: {
        H2A,
        HA_minus,
        A_2minus,
        H
      },
      pH,
      constants: derived.result
    },
    intermediates: {
      formalConcentration,
      degreeOfDissociation,
      ratioHAtoA2,
      dissociatedPool,
      undissociatedConcentration: H2A,
      ratioParts: {
        HA_minus: ratioHAtoA2,
        A_2minus: 1,
        total: ratioHAtoA2 + 1
      },
      derivedConstants: derived.intermediates
    },
    checks: {
      concentrationNonnegative:
        H2A >= 0 && HA_minus >= 0 && A_2minus >= 0 && H >= 0,
      massBalancePassed: Math.abs(massBalance - formalConcentration) < 1e-12,
      massBalanceResidual: massBalance - formalConcentration,
      ratioPassed: Math.abs(ratioCalculated - ratioHAtoA2) < 1e-12,
      ratioResidual: ratioCalculated - ratioHAtoA2,
      degreeOfDissociationPassed:
        Math.abs(alphaCalculated - degreeOfDissociation) < 1e-12,
      degreeOfDissociationResidual:
        alphaCalculated - degreeOfDissociation,
      chargeBalancePassedForPureAcid:
        Math.abs(chargeBalanceDifference) < 1e-8,
      chargeBalanceDifference,
      derivedConstantChecks: derived.checks
    },
    trace: [
      {
        step: "calculate_dissociated_pool",
        module: "reconstruct_equilibrium",
        data: { dissociatedPool, H2A }
      },
      {
        step: "split_species_by_ratio",
        module: "reconstruct_equilibrium",
        data: { ratioHAtoA2, HA_minus, A_2minus }
      },
      {
        step: "derive_hydrogen_concentration",
        module: "reconstruct_equilibrium",
        data: { pH, H }
      },
      {
        step: "derive_equilibrium_constants",
        module: "derive_constants",
        data: derived.result
      }
    ],
    warnings: [
      ...derived.warnings,
      ...(Math.abs(chargeBalanceDifference) >= 1e-8
        ? [
            "依目前輸入無法滿足純二質子酸溶液的電荷平衡；題目可能省略其他離子，或其條件僅供代數關係判斷。引擎仍保留重建結果，但不應將其視為完整物理模型。"
          ]
        : [])
    ]
  };
}
