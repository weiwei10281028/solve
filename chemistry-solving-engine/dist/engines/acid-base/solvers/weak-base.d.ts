export declare function solveWeakBase(input: Record<string, unknown>, approximationThreshold?: number): {
    method: string;
    result: {
        H: number;
        OH: number;
        pH: number;
        pOH: number;
        B: number;
        BH_plus: number;
    };
    intermediates: {
        species: {} | null;
        initialConcentration: number;
        volumeL: number;
        Kb: number;
        approximateX: number;
        approximationRatio: number;
        approximationThreshold: number;
        approximationValid: boolean;
        exactX: number;
    };
    checks: {
        concentrationNonnegative: boolean;
        massBalancePassed: boolean;
        equilibriumResidual: number;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            approximateX: number;
            approximateRatio: number;
            exactX?: undefined;
            pH?: undefined;
            pOH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            exactX: number;
            approximateX?: undefined;
            approximateRatio?: undefined;
            pH?: undefined;
            pOH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pH: number;
            pOH: number;
            approximateX?: undefined;
            approximateRatio?: undefined;
            exactX?: undefined;
        };
    })[];
    warnings: string[];
};
