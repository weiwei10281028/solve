export declare function solveDilutionEffect(input: Record<string, unknown>): {
    method: string;
    result: {
        QBefore: number;
        QAfterInstantaneousDilution: number;
        K: number;
        equilibriumShift: import("./reaction-quotient.js").EquilibriumDirection;
        degreeOfDissociationTrend: string;
    };
    intermediates: {
        mode: "add_water" | "controlled_concentration";
        dilutionFactor: number;
        controlledSpecies: string[];
        initialActivities: Record<string, number>;
        postDilutionActivities: Record<string, number>;
        effectiveDeltaNu: number;
        dissociatedSide: "reactants" | "products";
    };
    checks: {
        initialStateAtEquilibrium: boolean;
        allActiveSpeciesProvided: boolean;
        postDilutionQuotientFinite: boolean;
    };
    trace: ({
        step: string;
        module: string;
        data?: undefined;
    } | {
        step: string;
        module: string;
        data: {
            dilutionFactor: number;
            mode: "add_water" | "controlled_concentration";
            Q?: undefined;
            K?: undefined;
            direction?: undefined;
            degreeOfDissociationTrend?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            Q: number;
            dilutionFactor?: undefined;
            mode?: undefined;
            K?: undefined;
            direction?: undefined;
            degreeOfDissociationTrend?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            Q: number;
            K: number;
            direction: import("./reaction-quotient.js").EquilibriumDirection;
            dilutionFactor?: undefined;
            mode?: undefined;
            degreeOfDissociationTrend?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            degreeOfDissociationTrend: string;
            dilutionFactor?: undefined;
            mode?: undefined;
            Q?: undefined;
            K?: undefined;
            direction?: undefined;
        };
    })[];
    warnings: string[];
};
