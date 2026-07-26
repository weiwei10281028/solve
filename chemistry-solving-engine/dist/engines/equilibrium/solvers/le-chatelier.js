import { EngineError } from "../../../core/errors.js";
import { booleanValue, finiteNumber, nonemptyString, numberRecord, oneOf, positiveNumber, reactionDefinition, requireSpeciesValues, signedStoichiometricCoefficient, } from "../validation.js";
import { calculateReactionQuotient, compareQToK } from "./reaction-quotient.js";
function opposite(direction) {
    if (direction === "forward")
        return "reverse";
    if (direction === "reverse")
        return "forward";
    return "at_equilibrium";
}
export function solveLeChatelierDisturbance(input) {
    const reaction = reactionDefinition(input.reaction);
    const disturbance = oneOf(input.disturbance, ["concentration_change", "volume_change", "pressure_change", "temperature_change", "add_inert_gas"], "input.disturbance");
    let equilibriumShift = "at_equilibrium";
    let method = "le_chatelier_stoichiometric_rule";
    const intermediates = { disturbance };
    const warnings = [];
    if (disturbance === "concentration_change") {
        const species = nonemptyString(input.species, "input.species");
        const change = oneOf(input.change, ["increase", "decrease"], "input.change");
        const coefficient = signedStoichiometricCoefficient(reaction, species);
        if (coefficient === undefined) {
            throw new EngineError("INVALID_INPUT", `物種 ${species} 不在反應式中`, "input.species");
        }
        const entry = [...reaction.reactants, ...reaction.products].find((item) => item.species === species);
        if (entry.phase === "s" || entry.phase === "l") {
            equilibriumShift = "at_equilibrium";
            warnings.push("改變純固體或純液體的量，不直接改變反應商。");
        }
        else {
            const speciesOnProductSide = coefficient > 0;
            equilibriumShift = change === "increase"
                ? (speciesOnProductSide ? "reverse" : "forward")
                : (speciesOnProductSide ? "forward" : "reverse");
        }
        intermediates.species = species;
        intermediates.change = change;
        intermediates.signedStoichiometricCoefficient = coefficient;
    }
    if (disturbance === "volume_change" || disturbance === "pressure_change") {
        const change = oneOf(input.change, ["increase", "decrease"], "input.change");
        const gasReactantMoles = reaction.reactants
            .filter((entry) => entry.phase === "g")
            .reduce((sum, entry) => sum + entry.coefficient, 0);
        const gasProductMoles = reaction.products
            .filter((entry) => entry.phase === "g")
            .reduce((sum, entry) => sum + entry.coefficient, 0);
        const deltaGasMoles = gasProductMoles - gasReactantMoles;
        if (deltaGasMoles === 0) {
            equilibriumShift = "at_equilibrium";
        }
        else {
            const favorsMoreGas = disturbance === "volume_change" ? change === "increase" : change === "decrease";
            const moreGasDirection = deltaGasMoles > 0 ? "forward" : "reverse";
            equilibriumShift = favorsMoreGas ? moreGasDirection : opposite(moreGasDirection);
        }
        intermediates.change = change;
        intermediates.gasReactantMoles = gasReactantMoles;
        intermediates.gasProductMoles = gasProductMoles;
        intermediates.deltaGasMoles = deltaGasMoles;
    }
    if (disturbance === "temperature_change") {
        const change = oneOf(input.change, ["increase", "decrease"], "input.change");
        const forwardReactionHeat = oneOf(input.forwardReactionHeat, ["endothermic", "exothermic"], "input.forwardReactionHeat");
        const heatActsAsProduct = forwardReactionHeat === "exothermic";
        equilibriumShift = change === "increase"
            ? (heatActsAsProduct ? "reverse" : "forward")
            : (heatActsAsProduct ? "forward" : "reverse");
        method = "le_chatelier_heat_as_species";
        intermediates.change = change;
        intermediates.forwardReactionHeat = forwardReactionHeat;
    }
    if (disturbance === "add_inert_gas") {
        const constraint = oneOf(input.constraint, ["constant_volume", "constant_pressure"], "input.constraint");
        const gasReactantMoles = reaction.reactants
            .filter((entry) => entry.phase === "g")
            .reduce((sum, entry) => sum + entry.coefficient, 0);
        const gasProductMoles = reaction.products
            .filter((entry) => entry.phase === "g")
            .reduce((sum, entry) => sum + entry.coefficient, 0);
        const deltaGasMoles = gasProductMoles - gasReactantMoles;
        if (constraint === "constant_volume" || deltaGasMoles === 0) {
            equilibriumShift = "at_equilibrium";
        }
        else {
            equilibriumShift = deltaGasMoles > 0 ? "forward" : "reverse";
        }
        intermediates.constraint = constraint;
        intermediates.gasReactantMoles = gasReactantMoles;
        intermediates.gasProductMoles = gasProductMoles;
        intermediates.deltaGasMoles = deltaGasMoles;
    }
    let qBasedVerification = null;
    if (input.activities !== undefined && input.K !== undefined) {
        const activities = numberRecord(input.activities, "input.activities");
        const K = positiveNumber(input.K, "input.K");
        requireSpeciesValues(reaction, activities, "input.activities");
        const quotient = calculateReactionQuotient(reaction, activities);
        const qDirection = compareQToK(quotient.Q, K);
        qBasedVerification = { Q: quotient.Q, K, direction: qDirection };
    }
    if (input.deltaH !== undefined) {
        intermediates.deltaH = finiteNumber(input.deltaH, "input.deltaH");
    }
    if (input.assumeIdealGas !== undefined) {
        intermediates.assumeIdealGas = booleanValue(input.assumeIdealGas, "input.assumeIdealGas", true);
    }
    return {
        method,
        result: {
            equilibriumShift,
            qBasedVerification,
        },
        intermediates,
        checks: {
            disturbanceClassified: true,
            reactionStoichiometryAvailable: true,
            qVerificationConsistent: qBasedVerification === null
                ? null
                : qBasedVerification.direction === equilibriumShift || equilibriumShift === "at_equilibrium",
        },
        trace: [
            { step: "classify_disturbance", module: "le_chatelier", data: { disturbance } },
            { step: "evaluate_stoichiometric_response", module: "le_chatelier", data: { equilibriumShift } },
            ...(qBasedVerification === null
                ? []
                : [{ step: "verify_with_q_k", module: "le_chatelier", data: qBasedVerification }]),
        ],
        warnings,
    };
}
