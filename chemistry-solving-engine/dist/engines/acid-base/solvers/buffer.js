import { KW_25C } from "../math.js";
import { positiveNumber } from "../validation.js";
export function solveAcidBuffer(input) {
    const Ka = positiveNumber(input.Ka, "input.Ka");
    const acidMoles = positiveNumber(input.acidMoles, "input.acidMoles");
    const conjugateBaseMoles = positiveNumber(input.conjugateBaseMoles, "input.conjugateBaseMoles");
    const totalVolumeL = positiveNumber(input.totalVolumeL, "input.totalVolumeL");
    const ratio = conjugateBaseMoles / acidMoles;
    const pKa = -Math.log10(Ka);
    const pH = pKa + Math.log10(ratio);
    const h = 10 ** (-pH);
    return {
        method: "henderson_hasselbalch",
        result: { pH, H: h, OH: KW_25C / h },
        intermediates: {
            Ka,
            pKa,
            acidMoles,
            conjugateBaseMoles,
            acidConcentration: acidMoles / totalVolumeL,
            conjugateBaseConcentration: conjugateBaseMoles / totalVolumeL,
            ratio,
            totalVolumeL
        },
        checks: {
            componentsPositive: acidMoles > 0 && conjugateBaseMoles > 0,
            recommendedRatioRange: ratio >= 0.1 && ratio <= 10
        },
        trace: [
            { step: "identify_buffer", module: "buffer", data: { type: "weak_acid_conjugate_base" } },
            { step: "calculate_ratio", module: "buffer", data: { ratio } },
            { step: "calculate_ph", module: "buffer", data: { pKa, pH } }
        ],
        warnings: ratio < 0.1 || ratio > 10 ? ["共軛酸鹼比例超出常用緩衝範圍；Henderson–Hasselbalch 的教學適用性需再判斷。"] : []
    };
}
export function solveBaseBuffer(input) {
    const Kb = positiveNumber(input.Kb, "input.Kb");
    const baseMoles = positiveNumber(input.baseMoles, "input.baseMoles");
    const conjugateAcidMoles = positiveNumber(input.conjugateAcidMoles, "input.conjugateAcidMoles");
    const totalVolumeL = positiveNumber(input.totalVolumeL, "input.totalVolumeL");
    const ratio = conjugateAcidMoles / baseMoles;
    const pKb = -Math.log10(Kb);
    const pOH = pKb + Math.log10(ratio);
    const pH = 14 - pOH;
    const h = 10 ** (-pH);
    return {
        method: "henderson_hasselbalch_base",
        result: { pH, pOH, H: h, OH: KW_25C / h },
        intermediates: {
            Kb,
            pKb,
            baseMoles,
            conjugateAcidMoles,
            baseConcentration: baseMoles / totalVolumeL,
            conjugateAcidConcentration: conjugateAcidMoles / totalVolumeL,
            ratio,
            totalVolumeL
        },
        checks: {
            componentsPositive: baseMoles > 0 && conjugateAcidMoles > 0,
            recommendedRatioRange: ratio >= 0.1 && ratio <= 10
        },
        trace: [
            { step: "identify_buffer", module: "buffer", data: { type: "weak_base_conjugate_acid" } },
            { step: "calculate_ratio", module: "buffer", data: { ratio } },
            { step: "calculate_ph", module: "buffer", data: { pKb, pOH, pH } }
        ],
        warnings: ratio < 0.1 || ratio > 10 ? ["共軛酸鹼比例超出常用緩衝範圍；Henderson–Hasselbalch 的教學適用性需再判斷。"] : []
    };
}
