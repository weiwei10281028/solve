export declare function solveMoleConversion(input: Record<string, unknown>): {
    method: string;
    result: {
        amount_mol: number;
        mass_g?: undefined;
        particles?: undefined;
    };
    intermediates: {
        mass_g: number;
        molarMass_g_mol: number;
        amount_mol?: undefined;
        particles?: undefined;
        avogadroConstant?: undefined;
    };
    checks: {
        resultFinite: boolean;
        resultPositive: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            mass_g: number;
            molarMass_g_mol: number;
            amount_mol: number;
        };
    })[];
    warnings: never[];
} | {
    method: string;
    result: {
        mass_g: number;
        amount_mol?: undefined;
        particles?: undefined;
    };
    intermediates: {
        amount_mol: number;
        molarMass_g_mol: number;
        mass_g?: undefined;
        particles?: undefined;
        avogadroConstant?: undefined;
    };
    checks: {
        resultFinite: boolean;
        resultPositive: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            amount_mol: number;
            molarMass_g_mol: number;
            mass_g: number;
        };
    })[];
    warnings: never[];
} | {
    method: string;
    result: {
        amount_mol: number;
        mass_g?: undefined;
        particles?: undefined;
    };
    intermediates: {
        particles: number;
        avogadroConstant: number;
        mass_g?: undefined;
        molarMass_g_mol?: undefined;
        amount_mol?: undefined;
    };
    checks: {
        resultFinite: boolean;
        resultPositive: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            particles: number;
            avogadroConstant: number;
            amount_mol: number;
        };
    })[];
    warnings: never[];
} | {
    method: string;
    result: {
        particles: number;
        amount_mol?: undefined;
        mass_g?: undefined;
    };
    intermediates: {
        amount_mol: number;
        avogadroConstant: number;
        mass_g?: undefined;
        molarMass_g_mol?: undefined;
        particles?: undefined;
    };
    checks: {
        resultFinite: boolean;
        resultPositive: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            amount_mol: number;
            avogadroConstant: number;
            particles: number;
        };
    })[];
    warnings: never[];
};
