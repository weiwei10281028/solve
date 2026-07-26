export declare function solveDiproticWeakAcid(input: Record<string, unknown>, approximationThreshold?: number): {
    method: string;
    result: {
        H: number;
        OH: number;
        pH: number;
        pOH: number;
        H2A: number;
        HA_minus: number;
        A2_minus: number;
    };
    intermediates: {
        species: {} | null;
        initialConcentration: number;
        volumeL: number;
        Ka1: number;
        Ka2: number;
        pKa1: number;
        pKa2: number;
        ka1OnlyApproximateH: number;
        ka1OnlyApproximationRatio: number;
        approximationThreshold: number;
        ka1OnlyApproximationValid: boolean;
        secondDissociationContributionRatio: number;
        ignoreKa2Likely: boolean;
    };
    checks: {
        concentrationNonnegative: boolean;
        massBalancePassed: boolean;
        chargeBalanceResidual: number;
        ka1Ka2Order: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            ka1OnlyX: number;
            ka1OnlyRatio: number;
            h?: undefined;
            species?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            h: number;
            species: import("../math.js").DiproticSpecies;
            ka1OnlyX?: undefined;
            ka1OnlyRatio?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pH: number;
            ka1OnlyX?: undefined;
            ka1OnlyRatio?: undefined;
            h?: undefined;
            species?: undefined;
        };
    })[];
    warnings: string[];
};
