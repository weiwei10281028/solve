import { EngineError } from "../../../core/errors.js";
import { pHFromH } from "../math.js";
import { positiveNumber } from "../validation.js";

export type DiproticSpeciesState = {
  H2A: number;
  HA_minus: number;
  A_2minus: number;
  H: number;
};

function readNonnegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是大於或等於 0 的有限數值`, field);
  }
  return value;
}

function readSpecies(input: Record<string, unknown>): DiproticSpeciesState {
  const species =
    typeof input.species === "object" && input.species !== null
      ? (input.species as Record<string, unknown>)
      : input;

  const H2A = positiveNumber(species.H2A, "input.species.H2A");
  const HA_minus = positiveNumber(
    species.HA_minus ?? species["HA-"],
    "input.species.HA_minus"
  );
  const A_2minus = positiveNumber(
    species.A_2minus ?? species["A2-"],
    "input.species.A_2minus"
  );

  let H: number;
  if (species.H !== undefined || species["H+"] !== undefined) {
    H = positiveNumber(species.H ?? species["H+"], "input.species.H");
  } else {
    const pH = readNonnegativeNumber(input.pH, "input.pH");
    H = 10 ** -pH;
  }

  return { H2A, HA_minus, A_2minus, H };
}

/**
 * 由已知平衡物種濃度與 [H+] 反推二質子酸的 Ka1、Ka2、pKa1、pKa2。
 *
 * 必要輸入：
 * - input.species.H2A
 * - input.species.HA_minus（亦接受 "HA-"）
 * - input.species.A_2minus（亦接受 "A2-"）
 * - input.species.H 或 input.pH
 */
export function deriveDiproticAcidConstants(input: Record<string, unknown>) {
  const state = readSpecies(input);

  const Ka1 = (state.H * state.HA_minus) / state.H2A;
  const Ka2 = (state.H * state.A_2minus) / state.HA_minus;
  const pKa1 = -Math.log10(Ka1);
  const pKa2 = -Math.log10(Ka2);

  const ka1Residual = Math.abs(
    (state.H * state.HA_minus) / state.H2A - Ka1
  );
  const ka2Residual = Math.abs(
    (state.H * state.A_2minus) / state.HA_minus - Ka2
  );

  return {
    method: "diprotic_equilibrium_constants_from_state",
    result: {
      Ka1,
      pKa1,
      Ka2,
      pKa2,
      H: state.H,
      pH: pHFromH(state.H)
    },
    intermediates: {
      species: {
        H2A: state.H2A,
        HA_minus: state.HA_minus,
        A_2minus: state.A_2minus
      },
      equations: {
        Ka1: "[H+][HA-]/[H2A]",
        Ka2: "[H+][A2-]/[HA-]"
      }
    },
    checks: {
      allConcentrationsPositive:
        state.H2A > 0 && state.HA_minus > 0 && state.A_2minus > 0 && state.H > 0,
      Ka1Positive: Ka1 > 0,
      Ka2Positive: Ka2 > 0,
      expectedStepwiseOrder: Ka1 >= Ka2,
      ka1Residual,
      ka2Residual
    },
    trace: [
      {
        step: "read_equilibrium_state",
        module: "derive_constants",
        data: { ...state }
      },
      {
        step: "derive_ka1",
        module: "derive_constants",
        data: { Ka1, pKa1 }
      },
      {
        step: "derive_ka2",
        module: "derive_constants",
        data: { Ka2, pKa2 }
      }
    ],
    warnings:
      Ka1 < Ka2
        ? ["計算得到 Ka1 < Ka2；請重新檢查題目條件、物種定義或輸入資料。"]
        : []
  };
}
