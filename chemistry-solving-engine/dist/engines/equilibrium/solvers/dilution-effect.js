import { EngineError } from "../../../core/errors.js";
import { activeSpecies, numberRecord, oneOf, positiveNumber, reactionDefinition, requireSpeciesValues, signedStoichiometricCoefficient, stringArray, } from "../validation.js";
import { calculateReactionQuotient, compareQToK } from "./reaction-quotient.js";
export function solveDilutionEffect(input) {
    const reaction = reactionDefinition(input.reaction);
    const K = positiveNumber(input.K, "input.K");
    const initialActivities = numberRecord(input.initialActivities, "input.initialActivities");
    const dilutionFactor = positiveNumber(input.dilutionFactor, "input.dilutionFactor");
    const mode = oneOf(input.mode ?? "add_water", ["add_water", "controlled_concentration"], "input.mode");
    const controlledSpecies = stringArray(input.controlledSpecies, "input.controlledSpecies");
    const dissociatedSide = oneOf(input.dissociatedSide ?? "products", ["reactants", "products"], "input.dissociatedSide");
    if (dilutionFactor <= 1) {
        throw new EngineError("INVALID_INPUT", "input.dilutionFactor 必須大於 1", "input.dilutionFactor");
    }
    if (mode === "controlled_concentration" && controlledSpecies.length === 0) {
        throw new EngineError("INVALID_INPUT", "controlled_concentration 模式必須提供 input.controlledSpecies", "input.controlledSpecies");
    }
    requireSpeciesValues(reaction, initialActivities, "input.initialActivities");
    const activeNames = new Set(activeSpecies(reaction).map((entry) => entry.species));
    for (const species of controlledSpecies) {
        if (!activeNames.has(species)) {
            throw new EngineError("INVALID_INPUT", `受控物種 ${species} 不在反應商的有效物種中`, "input.controlledSpecies");
        }
    }
    const postDilutionActivities = { ...initialActivities };
    for (const entry of activeSpecies(reaction)) {
        const isControlled = mode === "controlled_concentration" && controlledSpecies.includes(entry.species);
        postDilutionActivities[entry.species] = isControlled
            ? initialActivities[entry.species]
            : initialActivities[entry.species] / dilutionFactor;
    }
    const before = calculateReactionQuotient(reaction, initialActivities);
    const after = calculateReactionQuotient(reaction, postDilutionActivities);
    const direction = compareQToK(after.Q, K);
    const dissociationDirection = dissociatedSide === "products" ? "forward" : "reverse";
    const degreeOfDissociationTrend = direction === "at_equilibrium"
        ? "unchanged"
        : direction === dissociationDirection
            ? "increase"
            : "decrease";
    const effectiveDeltaNu = activeSpecies(reaction).reduce((sum, entry) => {
        if (mode === "controlled_concentration" && controlledSpecies.includes(entry.species))
            return sum;
        return sum + (signedStoichiometricCoefficient(reaction, entry.species) ?? 0);
    }, 0);
    return {
        method: "instantaneous_q_after_dilution",
        result: {
            QBefore: before.Q,
            QAfterInstantaneousDilution: after.Q,
            K,
            equilibriumShift: direction,
            degreeOfDissociationTrend,
        },
        intermediates: {
            mode,
            dilutionFactor,
            controlledSpecies,
            initialActivities,
            postDilutionActivities,
            effectiveDeltaNu,
            dissociatedSide,
        },
        checks: {
            initialStateAtEquilibrium: compareQToK(before.Q, K) === "at_equilibrium",
            allActiveSpeciesProvided: true,
            postDilutionQuotientFinite: Number.isFinite(after.Q),
        },
        trace: [
            { step: "validate_dilution", module: "dilution_effect" },
            { step: "apply_instantaneous_dilution", module: "dilution_effect", data: { dilutionFactor, mode } },
            { step: "calculate_post_dilution_q", module: "dilution_effect", data: { Q: after.Q } },
            { step: "compare_q_k", module: "dilution_effect", data: { Q: after.Q, K, direction } },
            { step: "infer_dissociation_trend", module: "dilution_effect", data: { degreeOfDissociationTrend } },
        ],
        warnings: compareQToK(before.Q, K) !== "at_equilibrium"
            ? ["輸入的初始狀態並非平衡狀態；結果仍依擾動後 Q 與 K 判定。"]
            : [],
    };
}
