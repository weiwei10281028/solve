import { type EquilibriumDirection } from "./reaction-quotient.js";
export declare function solveLeChatelierDisturbance(input: Record<string, unknown>): {
    method: string;
    result: {
        equilibriumShift: EquilibriumDirection;
        qBasedVerification: Record<string, unknown> | null;
    };
    intermediates: Record<string, unknown>;
    checks: {
        disturbanceClassified: boolean;
        reactionStoichiometryAvailable: boolean;
        qVerificationConsistent: boolean | null;
    };
    trace: {
        step: string;
        module: string;
        data: Record<string, unknown>;
    }[];
    warnings: string[];
};
