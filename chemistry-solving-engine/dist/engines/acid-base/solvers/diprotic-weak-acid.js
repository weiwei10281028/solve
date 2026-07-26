import { KW_25C, diproticSpecies, pHFromH, solveDiproticAcidPH } from "../math.js";
import { positiveNumber } from "../validation.js";
export function solveDiproticWeakAcid(input, approximationThreshold = 0.05) {
    const concentration = positiveNumber(input.concentration, "input.concentration");
    const Ka1 = positiveNumber(input.Ka1, "input.Ka1");
    const Ka2 = positiveNumber(input.Ka2, "input.Ka2");
    const volumeL = input.volumeL === undefined ? 1 : positiveNumber(input.volumeL, "input.volumeL");
    const h = solveDiproticAcidPH(concentration, Ka1, Ka2);
    const species = diproticSpecies(h, concentration, Ka1, Ka2);
    const oh = KW_25C / h;
    const ka1OnlyX = Math.sqrt(Ka1 * concentration);
    const ka1OnlyRatio = ka1OnlyX / concentration;
    const ka2ContributionRatio = species.A2 / h;
    return {
        method: "diprotic_charge_balance",
        result: {
            H: h,
            OH: oh,
            pH: pHFromH(h),
            pOH: -Math.log10(oh),
            H2A: species.H2A,
            HA_minus: species.HA,
            A2_minus: species.A2
        },
        intermediates: {
            species: input.species ?? null,
            initialConcentration: concentration,
            volumeL,
            Ka1,
            Ka2,
            pKa1: -Math.log10(Ka1),
            pKa2: -Math.log10(Ka2),
            ka1OnlyApproximateH: ka1OnlyX,
            ka1OnlyApproximationRatio: ka1OnlyRatio,
            approximationThreshold,
            ka1OnlyApproximationValid: ka1OnlyRatio <= approximationThreshold,
            secondDissociationContributionRatio: ka2ContributionRatio,
            ignoreKa2Likely: Ka2 < Ka1 * 0.01 && ka2ContributionRatio < 0.05
        },
        checks: {
            concentrationNonnegative: species.H2A >= 0 && species.HA >= 0 && species.A2 >= 0,
            massBalancePassed: Math.abs(species.H2A + species.HA + species.A2 - concentration) < 1e-9,
            chargeBalanceResidual: Math.abs(h - oh - species.HA - 2 * species.A2),
            ka1Ka2Order: Ka1 >= Ka2
        },
        trace: [
            { step: "classify", module: "diprotic_weak_acid" },
            { step: "compare_ka1_approximation", module: "diprotic_weak_acid", data: { ka1OnlyX, ka1OnlyRatio } },
            { step: "solve_charge_balance", module: "diprotic_weak_acid", data: { h, species } },
            { step: "calculate_ph", module: "diprotic_weak_acid", data: { pH: pHFromH(h) } }
        ],
        warnings: [
            ...(ka1OnlyRatio > approximationThreshold ? ["第一步解離的 x ≪ C 近似超過門檻；詳解應採聯立平衡精確解。"] : []),
            ...(Ka2 >= Ka1 * 0.01 && ka2ContributionRatio >= 0.05 ? ["第二步解離不可忽略；不可只用 Ka1 估算 pH。"] : [])
        ]
    };
}
