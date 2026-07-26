export declare function solvePercentYield(input: Record<string, unknown>): {
    method: string;
    result: {
        percentYield: number;
    };
    intermediates: {
        basis: "mass" | "moles";
        actualYield: number;
        theoreticalYield: number;
    };
    checks: {
        yieldNotOver100: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data: {
            basis: "mass" | "moles";
            actualYield?: undefined;
            theoreticalYield?: undefined;
            percentYield?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            actualYield: number;
            theoreticalYield: number;
            basis?: undefined;
            percentYield?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            percentYield: number;
            basis?: undefined;
            actualYield?: undefined;
            theoreticalYield?: undefined;
        };
    })[];
    warnings: string[];
};
