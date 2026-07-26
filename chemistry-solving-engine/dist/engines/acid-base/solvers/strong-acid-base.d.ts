export declare function solveStrongAcidBase(input: Record<string, unknown>): {
    method: string;
    result: {
        H: number;
        OH: number;
        pH: number;
        pOH: number;
    };
    intermediates: {
        kind: "acid" | "base";
        analyticalConcentration: number;
        equivalents: number;
        effectiveConcentration: number;
        volumeL: number;
        soluteMoles: number;
        acidBaseEquivalentMoles: number;
    };
    checks: {
        concentrationNonnegative: boolean;
        waterIonProductPassed: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data: {
            kind: "acid" | "base";
            effectiveConcentration?: undefined;
            pH?: undefined;
            pOH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            effectiveConcentration: number;
            kind?: undefined;
            pH?: undefined;
            pOH?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pH: number;
            pOH: number;
            kind?: undefined;
            effectiveConcentration?: undefined;
        };
    })[];
    warnings: string[];
};
