/**
 * 由二質子酸的形式濃度、總解離度與 [HA-]/[A2-] 比值，
 * 重建 H2A、HA-、A2- 的平衡濃度，並可由 pH 反推 Ka1、Ka2。
 *
 * 此處的 degreeOfDissociation 定義為：
 * ([HA-] + [A2-]) / formalConcentration
 */
export declare function reconstructDiproticEquilibrium(input: Record<string, unknown>): {
    method: string;
    result: {
        species: {
            H2A: number;
            HA_minus: number;
            A_2minus: number;
            H: number;
        };
        pH: number;
        constants: {
            Ka1: number;
            pKa1: number;
            Ka2: number;
            pKa2: number;
            H: number;
            pH: number;
        };
    };
    intermediates: {
        formalConcentration: number;
        degreeOfDissociation: number;
        ratioHAtoA2: number;
        dissociatedPool: number;
        undissociatedConcentration: number;
        ratioParts: {
            HA_minus: number;
            A_2minus: number;
            total: number;
        };
        derivedConstants: {
            species: {
                H2A: number;
                HA_minus: number;
                A_2minus: number;
            };
            equations: {
                Ka1: string;
                Ka2: string;
            };
        };
    };
    checks: {
        concentrationNonnegative: boolean;
        massBalancePassed: boolean;
        massBalanceResidual: number;
        ratioPassed: boolean;
        ratioResidual: number;
        degreeOfDissociationPassed: boolean;
        degreeOfDissociationResidual: number;
        chargeBalancePassedForPureAcid: boolean;
        chargeBalanceDifference: number;
        derivedConstantChecks: {
            allConcentrationsPositive: boolean;
            Ka1Positive: boolean;
            Ka2Positive: boolean;
            expectedStepwiseOrder: boolean;
            ka1Residual: number;
            ka2Residual: number;
        };
    };
    trace: ({
        step: string;
        module: string;
        data: {
            dissociatedPool: number;
            H2A: number;
            ratioHAtoA2?: undefined;
            HA_minus?: undefined;
            A_2minus?: undefined;
            pH?: undefined;
            H?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            ratioHAtoA2: number;
            HA_minus: number;
            A_2minus: number;
            dissociatedPool?: undefined;
            H2A?: undefined;
            pH?: undefined;
            H?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            pH: number;
            H: number;
            dissociatedPool?: undefined;
            H2A?: undefined;
            ratioHAtoA2?: undefined;
            HA_minus?: undefined;
            A_2minus?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            Ka1: number;
            pKa1: number;
            Ka2: number;
            pKa2: number;
            H: number;
            pH: number;
        };
    })[];
    warnings: string[];
};
