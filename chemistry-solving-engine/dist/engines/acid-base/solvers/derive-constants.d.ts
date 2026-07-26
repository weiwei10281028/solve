export type DiproticSpeciesState = {
    H2A: number;
    HA_minus: number;
    A_2minus: number;
    H: number;
};
/**
 * 由已知平衡物種濃度與 [H+] 反推二質子酸的 Ka1、Ka2、pKa1、pKa2。
 *
 * 必要輸入：
 * - input.species.H2A
 * - input.species.HA_minus（亦接受 "HA-"）
 * - input.species.A_2minus（亦接受 "A2-"）
 * - input.species.H 或 input.pH
 */
export declare function deriveDiproticAcidConstants(input: Record<string, unknown>): {
    method: string;
    result: {
        Ka1: number;
        pKa1: number;
        Ka2: number;
        pKa2: number;
        H: number;
        pH: number;
    };
    intermediates: {
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
    checks: {
        allConcentrationsPositive: boolean;
        Ka1Positive: boolean;
        Ka2Positive: boolean;
        expectedStepwiseOrder: boolean;
        ka1Residual: number;
        ka2Residual: number;
    };
    trace: ({
        step: string;
        module: string;
        data: {
            H2A: number;
            HA_minus: number;
            A_2minus: number;
            H: number;
            Ka1?: undefined;
            pKa1?: undefined;
            Ka2?: undefined;
            pKa2?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            Ka1: number;
            pKa1: number;
            Ka2?: undefined;
            pKa2?: undefined;
        };
    } | {
        step: string;
        module: string;
        data: {
            Ka2: number;
            pKa2: number;
            Ka1?: undefined;
            pKa1?: undefined;
        };
    })[];
    warnings: string[];
};
