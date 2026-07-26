export declare function solveLimitingReagent(input: Record<string, unknown>): {
    method: string;
    result: Record<string, unknown>;
    intermediates: {
        productMolarMass_g_mol?: number | undefined;
        extentsByReactant: Record<string, number>;
        targetProductCoefficient: number;
    };
    checks: {
        allReactantAmountsProvided: boolean;
        targetProductFound: boolean;
        reactionExtentFinite: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            extentsByReactant: Record<string, number>;
            limitingReactantId?: undefined;
            reactionExtent_mol?: undefined;
            targetProductId?: undefined;
            theoreticalYield_mol?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            limitingReactantId: string;
            reactionExtent_mol: number;
            extentsByReactant?: undefined;
            targetProductId?: undefined;
            theoreticalYield_mol?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            targetProductId: string;
            theoreticalYield_mol: number;
            extentsByReactant?: undefined;
            limitingReactantId?: undefined;
            reactionExtent_mol?: undefined;
        };
    })[];
    warnings: never[];
};
