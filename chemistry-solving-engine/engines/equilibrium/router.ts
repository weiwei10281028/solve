import { EngineError } from "../../core/errors.js";
import type { EngineRequest, EngineResponse, EquilibriumOperation } from "../../core/engine-interface.js";
import { solveDilutionEffect } from "./solvers/dilution-effect.js";
import { solveLeChatelierDisturbance } from "./solvers/le-chatelier.js";
import { solveReactionQuotientDirection } from "./solvers/reaction-quotient.js";

export function solveEquilibrium(request: EngineRequest): EngineResponse {
  try {
    if (request.engine !== "equilibrium") {
      throw new EngineError("INVALID_ENGINE", "equilibrium router 僅接受 equilibrium 引擎請求", "engine");
    }

    let payload;
    switch (request.operation as EquilibriumOperation) {
      case "dilution_effect":
        payload = solveDilutionEffect(request.input);
        break;
      case "reaction_quotient_direction":
        payload = solveReactionQuotientDirection(request.input);
        break;
      case "le_chatelier_disturbance":
        payload = solveLeChatelierDisturbance(request.input);
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
      engine: "equilibrium",
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
      engine: "equilibrium",
      operation: request.operation,
      error: { code: e.code, message: e.message, field: e.field },
    };
  }
}
