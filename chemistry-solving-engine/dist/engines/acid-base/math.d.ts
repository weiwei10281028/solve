export declare const KW_25C = 1e-14;
export declare function pHFromH(h: number): number;
export declare function pOHFromOH(oh: number): number;
export declare function positiveRootForWeakEquilibrium(K: number, C: number): number;
export declare function nearlyEqual(a: number, b: number, tolerance?: number): boolean;
export type DiproticSpecies = {
    H2A: number;
    HA: number;
    A2: number;
    OH: number;
};
/** 雙質子酸在 [H+] = h 時的物種莫耳濃度（總分析濃度 C）。 */
export declare function diproticSpecies(h: number, C: number, Ka1: number, Ka2: number): DiproticSpecies;
/** 以電荷平衡數值解雙質子酸溶液 [H+]。 */
export declare function solveDiproticAcidPH(C: number, Ka1: number, Ka2: number): number;
/** 兩性離子 HA- 溶液（第一當量點）的 [H+]。 */
export declare function solveAmphiproticPH(C: number, Ka1: number, Ka2: number): number;
