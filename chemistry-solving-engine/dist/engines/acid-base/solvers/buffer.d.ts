export declare function solveAcidBuffer(input: Record<string, unknown>): {
    method: string;
    result: {
        pH: number;
        H: number;
        OH: number;
    };
    intermediates: {
        Ka: number;
        pKa: number;
        acidMoles: number;
        conjugateBaseMoles: number;
        acidConcentration: number;
        conjugateBaseConcentration: number;
        ratio: number;
        totalVolumeL: number;
    };
    checks: {
        componentsPositive: boolean;
        recommendedRatioRange: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data: {
            type: string;
            ratio?: undefined;
            pKa?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            ratio: number;
            type?: undefined;
            pKa?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pKa: number;
            pH: number;
            type?: undefined;
            ratio?: undefined;
        };
    })[];
    warnings: string[];
};
export declare function solveBaseBuffer(input: Record<string, unknown>): {
    method: string;
    result: {
        pH: number;
        pOH: number;
        H: number;
        OH: number;
    };
    intermediates: {
        Kb: number;
        pKb: number;
        baseMoles: number;
        conjugateAcidMoles: number;
        baseConcentration: number;
        conjugateAcidConcentration: number;
        ratio: number;
        totalVolumeL: number;
    };
    checks: {
        componentsPositive: boolean;
        recommendedRatioRange: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data: {
            type: string;
            ratio?: undefined;
            pKb?: undefined;
            pOH?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            ratio: number;
            type?: undefined;
            pKb?: undefined;
            pOH?: undefined;
            pH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pKb: number;
            pOH: number;
            pH: number;
            type?: undefined;
            ratio?: undefined;
        };
    })[];
    warnings: string[];
};
