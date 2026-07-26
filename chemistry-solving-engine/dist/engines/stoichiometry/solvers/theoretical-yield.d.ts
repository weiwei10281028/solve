export declare function solveTheoreticalYield(input: Record<string, unknown>): {
    method: string;
    result: Record<string, unknown>;
    intermediates: {
        molarMass_g_mol?: number | undefined;
        limitingReactantId: string;
        limitingAmount_mol: number;
        limitingCoefficient: number;
        productCoefficient: number;
    };
    checks: {
        reactionExtentFinite: boolean;
        theoreticalYieldFinite: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            reactionExtent_mol: number;
            productId?: undefined;
            theoreticalYield_mol?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            productId: string;
            theoreticalYield_mol: number;
            reactionExtent_mol?: undefined;
        };
    })[];
    warnings: never[];
};
