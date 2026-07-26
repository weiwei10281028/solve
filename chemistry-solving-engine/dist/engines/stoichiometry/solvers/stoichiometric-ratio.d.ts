export declare function solveStoichiometricRatio(input: Record<string, unknown>): {
    method: string;
    result: {
        knownSpeciesId: string;
        targetSpeciesId: string;
        targetAmount_mol: number;
        ratio: number;
    };
    intermediates: {
        knownAmount_mol: number;
        knownCoefficient: number;
        targetCoefficient: number;
    };
    checks: {
        knownSpeciesFound: boolean;
        targetSpeciesFound: boolean;
        resultFinite: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            knownSpeciesId: string;
            targetSpeciesId: string;
            ratio?: undefined;
            targetAmount_mol?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            ratio: number;
            targetAmount_mol: number;
            knownSpeciesId?: undefined;
            targetSpeciesId?: undefined;
        };
    })[];
    warnings: never[];
};
