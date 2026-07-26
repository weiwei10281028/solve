import { EngineError } from "../../core/errors.js";
import type { EngineRequest, EngineResponse, StoichiometryOperation } from "../../core/engine-interface.js";
import { solveLimitingReagent } from "./solvers/limiting-reagent.js";
import { solveMoleConversion } from "./solvers/mole-conversion.js";
import { solvePercentYield } from "./solvers/percent-yield.js";
import { solveStoichiometricRatio } from "./solvers/stoichiometric-ratio.js";
import { solveTheoreticalYield } from "./solvers/theoretical-yield.js";

export function solveStoichiometry(request: EngineRequest): EngineResponse {
  try {
    if (request.engine !== "stoichiometry") {
      throw new EngineError("INVALID_ENGINE", "stoichiometry router 僅接受 stoichiometry 引擎請求", "engine");
    }

    let payload;
    switch (request.operation as StoichiometryOperation) {
      case "mole_conversion":
        payload = solveMoleConversion(request.input);
        break;
      case "stoichiometric_ratio":
        payload = solveStoichiometricRatio(request.input);
        break;
      case "limiting_reagent":
        payload = solveLimitingReagent(request.input);
        break;
      case "theoretical_yield":
        payload = solveTheoreticalYield(request.input);
        break;
      case "percent_yield":
        payload = solvePercentYield(request.input);
        break;
      default:
        throw new EngineError(
          "UNSUPPORTED_OPERATION",
          `不支援 operation: ${request.operation}`,
          "operation",
        );
    }

    return {
      success: true,
      engine: "stoichiometry",
      operation: request.operation,
      ...payload,
    };
  } catch (error) {
    const e = error instanceof EngineError
      ? error
      : new EngineError(
        "CALCULATION_ERROR",
        error instanceof Error ? error.message : "未知錯誤",
      );

    return {
      success: false,
      engine: "stoichiometry",
      operation: request.operation,
      error: { code: e.code, message: e.message, field: e.field },
    };
  }
}
