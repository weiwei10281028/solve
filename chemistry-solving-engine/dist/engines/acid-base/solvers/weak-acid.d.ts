export declare function solveWeakAcid(input: Record<string, unknown>, approximationThreshold?: number): {
    method: string;
    result: {
        H: number;
        OH: number;
        pH: number;
        HA: number;
        A_minus: number;
    };
    intermediates: {
        species: {} | null;
        initialConcentration: number;
        volumeL: number;
        Ka: number;
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
        };
    } | {
        step: string;
        module: string;
        data: {
            exactX: number;
            approximateX?: undefined;
            approximateRatio?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pH: number;
            approximateX?: undefined;
            approximateRatio?: undefined;
            exactX?: undefined;
        };
    })[];
    warnings: string[];
};
