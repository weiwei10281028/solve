import { solveAcidBuffer, solveBaseBuffer } from "./buffer.js";
import { solveDiproticWeakAcidStrongBase } from "./diprotic-titration.js";
import { solveNeutralization } from "./neutralization.js";
import { isDiproticAcid, parseReagent } from "../reagent.js";
import { oneOf } from "../validation.js";
export function solveTitration(input) {
    const acid = parseReagent(input.acid, "acid");
    const base = parseReagent(input.base, "base");
    if (isDiproticAcid(acid) && base.strength === "strong") {
        return solveDiproticWeakAcidStrongBase(acid, base);
    }
    const neutralized = solveNeutralization(input);
    return {
        ...neutralized,
        intermediates: {
            titrationType: "general",
            routedModule: "neutralization",
            ...(neutralized.intermediates || {})
        },
        trace: [
            { step: "classify", module: "titration", data: { delegate: "neutralization" } },
            ...(neutralized.trace || [])
        ]
    };
}
export function solveBufferOperation(input) {
    const bufferType = oneOf(input.bufferType, ["acid", "base"], "input.bufferType");
    return bufferType === "acid" ? solveAcidBuffer(input) : solveBaseBuffer(input);
}
