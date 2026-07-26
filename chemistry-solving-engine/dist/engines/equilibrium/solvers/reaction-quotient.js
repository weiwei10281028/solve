import { activeSpecies, numberRecord, positiveNumber, reactionDefinition, requireSpeciesValues, } from "../validation.js";
function contribution(entry, values) {
    return values[entry.species] ** entry.coefficient;
}
export function calculateReactionQuotient(reaction, activities) {
    const numerator = reaction.products
        .filter((entry) => entry.phase === "aq" || entry.phase === "g")
        .reduce((product, entry) => product * contribution(entry, activities), 1);
    const denominator = reaction.reactants
        .filter((entry) => entry.phase === "aq" || entry.phase === "g")
        .reduce((product, entry) => product * contribution(entry, activities), 1);
    const includedSpecies = activeSpecies(reaction).map((entry) => entry.species);
    const omittedSpecies = [...reaction.reactants, ...reaction.products]
        .filter((entry) => entry.phase === "s" || entry.phase === "l")
        .map((entry) => entry.species);
    return {
        Q: numerator / denominator,
        numerator,
        denominator,
        includedSpecies,
        omittedSpecies,
    };
}
export function compareQToK(Q, K, relativeTolerance = 1e-9) {
    const scale = Math.max(Math.abs(Q), Math.abs(K), 1);
    if (Math.abs(Q - K) <= relativeTolerance * scale)
        return "at_equilibrium";
    return Q < K ? "forward" : "reverse";
}
export function solveReactionQuotientDirection(input) {
    const reaction = reactionDefinition(input.reaction);
    const activities = numberRecord(input.activities, "input.activities");
    const K = positiveNumber(input.K, "input.K");
    const relativeTolerance = input.relativeTolerance === undefined
        ? 1e-9
        : positiveNumber(input.relativeTolerance, "input.relativeTolerance");
    requireSpeciesValues(reaction, activities, "input.activities");
    const quotient = calculateReactionQuotient(reaction, activities);
    const direction = compareQToK(quotient.Q, K, relativeTolerance);
    return {
        method: "reaction_quotient_comparison",
        result: {
            Q: quotient.Q,
            K,
            direction,
        },
        intermediates: {
            numerator: quotient.numerator,
            denominator: quotient.denominator,
            includedSpecies: quotient.includedSpecies,
            omittedSpecies: quotient.omittedSpecies,
            relativeTolerance,
        },
        checks: {
            quotientFinite: Number.isFinite(quotient.Q),
            allActiveSpeciesProvided: true,
            equilibriumComparisonCompleted: true,
        },
        trace: [
            { step: "validate_reaction", module: "reaction_quotient" },
            { step: "build_quotient", module: "reaction_quotient", data: { Q: quotient.Q } },
            { step: "compare_q_k", module: "reaction_quotient", data: { Q: quotient.Q, K, direction } },
        ],
        warnings: [],
    };
}
