import type { ReactionDefinition } from "../validation.js";
export type EquilibriumDirection = "forward" | "reverse" | "at_equilibrium";
export declare function calculateReactionQuotient(reaction: ReactionDefinition, activities: Record<string, number>): {
    Q: number;
    numerator: number;
    denominator: number;
    includedSpecies: string[];
    omittedSpecies: string[];
};
export declare function compareQToK(Q: number, K: number, relativeTolerance?: number): EquilibriumDirection;
export declare function solveReactionQuotientDirection(input: Record<string, unknown>): {
    method: string;
    result: {
        Q: number;
        K: number;
        direction: EquilibriumDirection;
    };
    intermediates: {
        numerator: number;
        denominator: number;
        includedSpecies: string[];
        omittedSpecies: string[];
        relativeTolerance: number;
    };
    checks: {
        quotientFinite: boolean;
        allActiveSpeciesProvided: boolean;
        equilibriumComparisonCompleted: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            Q: number;
            K?: undefined;
            direction?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            Q: number;
            K: number;
            direction: EquilibriumDirection;
        };
    })[];
    warnings: never[];
};
