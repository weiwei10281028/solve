import { EngineError } from "../../core/errors.js";
import { deriveDiproticAcidConstants } from "./solvers/derive-constants.js";
import { solveDiproticWeakAcid } from "./solvers/diprotic-weak-acid.js";
import { solveNeutralization } from "./solvers/neutralization.js";
import { reconstructDiproticEquilibrium } from "./solvers/reconstruct-equilibrium.js";
import { solveBufferOperation, solveTitration } from "./solvers/titration.js";
import { solveStrongAcidBase } from "./solvers/strong-acid-base.js";
import { solveWeakAcid } from "./solvers/weak-acid.js";
import { solveWeakBase } from "./solvers/weak-base.js";
export function solveAcidBase(request) {
    try {
        const threshold = request.options?.approximationThreshold ?? 0.05;
        let payload;
        switch (request.operation) {
            case "strong_acid_base":
                payload = solveStrongAcidBase(request.input);
                break;
            case "weak_acid":
                payload = solveWeakAcid(request.input, threshold);
                break;
            case "weak_base":
                payload = solveWeakBase(request.input, threshold);
                break;
            case "weak_acid_diprotic":
                payload = solveDiproticWeakAcid(request.input, threshold);
                break;
            case "reconstruct_diprotic_equilibrium":
                payload = reconstructDiproticEquilibrium(request.input);
                break;
            case "derive_diprotic_constants":
                payload = deriveDiproticAcidConstants(request.input);
                break;
            case "neutralization":
                payload = solveNeutralization(request.input);
                break;
            case "titration":
                payload = solveTitration(request.input);
                break;
            case "buffer":
                payload = solveBufferOperation(request.input);
                break;
            default: throw new EngineError("UNSUPPORTED_OPERATION", `不支援 operation: ${request.operation}`, "operation");
        }
        return { success: true, engine: "acid_base", operation: request.operation, ...payload };
    }
    catch (error) {
        const e = error instanceof EngineError ? error : new EngineError("CALCULATION_ERROR", error instanceof Error ? error.message : "未知錯誤");
        return { success: false, engine: "acid_base", operation: request.operation, error: { code: e.code, message: e.message, field: e.field } };
    }
}
