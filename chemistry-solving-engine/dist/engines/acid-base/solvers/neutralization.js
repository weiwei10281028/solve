import { KW_25C, pHFromH, positiveRootForWeakEquilibrium } from "../math.js";
import { isDiproticAcid, parseReagent } from "../reagent.js";
import { solveAcidBuffer, solveBaseBuffer } from "./buffer.js";
import { solveDiproticWeakAcidStrongBase } from "./diprotic-titration.js";
export function solveNeutralization(input) {
    const acid = parseReagent(input.acid, "acid");
    const base = parseReagent(input.base, "base");
    if (isDiproticAcid(acid) && base.strength === "strong") {
        return solveDiproticWeakAcidStrongBase(acid, base);
    }
    const totalVolumeL = acid.volumeL + base.volumeL;
    const acidEq = acid.concentration * acid.volumeL * acid.equivalents;
    const baseEq = base.concentration * base.volumeL * base.equivalents;
    const reactedEq = Math.min(acidEq, baseEq);
    const tolerance = 1e-12;
    const common = {
        initialAcidEquivalentMoles: acidEq,
        initialBaseEquivalentMoles: baseEq,
        reactedEquivalentMoles: reactedEq,
        totalVolumeL
    };
    if (acid.strength === "strong" && base.strength === "strong") {
        const excess = acidEq - baseEq;
        if (Math.abs(excess) <= tolerance) {
            return {
                method: "strong_acid_strong_base_equivalence",
                result: { pH: 7, H: 1e-7, OH: 1e-7 },
                intermediates: { ...common, excessEquivalentMoles: 0 },
                checks: { stoichiometryPassed: true, concentrationNonnegative: true },
                trace: [
                    { step: "neutralize", module: "neutralization", data: common },
                    { step: "equivalence_point", module: "strong_acid_base" }
                ],
                warnings: []
            };
        }
        const kind = excess > 0 ? "acid" : "base";
        const effective = Math.abs(excess) / totalVolumeL;
        const h = kind === "acid" ? effective : KW_25C / effective;
        return {
            method: "strong_acid_base_excess",
            result: { pH: pHFromH(h), H: h, OH: KW_25C / h },
            intermediates: { ...common, excessKind: kind, excessEquivalentMoles: Math.abs(excess), excessConcentration: effective },
            checks: { stoichiometryPassed: true, concentrationNonnegative: effective >= 0 },
            trace: [
                { step: "neutralize", module: "neutralization", data: common },
                { step: "route", module: "strong_acid_base", data: { excessKind: kind } }
            ],
            warnings: []
        };
    }
    if (acid.strength === "weak" && base.strength === "strong") {
        if (!acid.Ka || acid.Ka <= 0)
            throw new Error("弱酸與強鹼混合時必須提供 acid.Ka");
        if (baseEq < acidEq - tolerance) {
            const child = solveAcidBuffer({ Ka: acid.Ka, acidMoles: acidEq - baseEq, conjugateBaseMoles: baseEq, totalVolumeL });
            return mergeChild("weak_acid_strong_base_buffer", common, child, "buffer");
        }
        if (Math.abs(baseEq - acidEq) <= tolerance) {
            const conjugateBaseC = acidEq / totalVolumeL;
            const Kb = KW_25C / acid.Ka;
            const oh = positiveRootForWeakEquilibrium(Kb, conjugateBaseC);
            const h = KW_25C / oh;
            return {
                method: "conjugate_base_hydrolysis",
                result: { pH: pHFromH(h), H: h, OH: oh },
                intermediates: { ...common, conjugateBaseConcentration: conjugateBaseC, Kb },
                checks: { stoichiometryPassed: true, concentrationNonnegative: conjugateBaseC - oh >= 0 },
                trace: [
                    { step: "neutralize", module: "neutralization", data: common },
                    { step: "route", module: "hydrolysis", data: { conjugateBaseConcentration: conjugateBaseC } }
                ],
                warnings: []
            };
        }
        const excessOH = (baseEq - acidEq) / totalVolumeL;
        const h = KW_25C / excessOH;
        return {
            method: "strong_base_excess",
            result: { pH: pHFromH(h), H: h, OH: excessOH },
            intermediates: { ...common, excessBaseEquivalentMoles: baseEq - acidEq, excessOHConcentration: excessOH },
            checks: { stoichiometryPassed: true, concentrationNonnegative: excessOH >= 0 },
            trace: [
                { step: "neutralize", module: "neutralization", data: common },
                { step: "route", module: "strong_acid_base", data: { excessKind: "base" } }
            ],
            warnings: []
        };
    }
    if (acid.strength === "strong" && base.strength === "weak") {
        if (!base.Kb || base.Kb <= 0)
            throw new Error("強酸與弱鹼混合時必須提供 base.Kb");
        if (acidEq < baseEq - tolerance) {
            const child = solveBaseBuffer({ Kb: base.Kb, baseMoles: baseEq - acidEq, conjugateAcidMoles: acidEq, totalVolumeL });
            return mergeChild("strong_acid_weak_base_buffer", common, child, "buffer");
        }
        if (Math.abs(acidEq - baseEq) <= tolerance) {
            const conjugateAcidC = baseEq / totalVolumeL;
            const Ka = KW_25C / base.Kb;
            const h = positiveRootForWeakEquilibrium(Ka, conjugateAcidC);
            return {
                method: "conjugate_acid_hydrolysis",
                result: { pH: pHFromH(h), H: h, OH: KW_25C / h },
                intermediates: { ...common, conjugateAcidConcentration: conjugateAcidC, Ka },
                checks: { stoichiometryPassed: true, concentrationNonnegative: conjugateAcidC - h >= 0 },
                trace: [
                    { step: "neutralize", module: "neutralization", data: common },
                    { step: "route", module: "hydrolysis", data: { conjugateAcidConcentration: conjugateAcidC } }
                ],
                warnings: []
            };
        }
        const excessH = (acidEq - baseEq) / totalVolumeL;
        return {
            method: "strong_acid_excess",
            result: { pH: pHFromH(excessH), H: excessH, OH: KW_25C / excessH },
            intermediates: { ...common, excessAcidEquivalentMoles: acidEq - baseEq, excessHConcentration: excessH },
            checks: { stoichiometryPassed: true, concentrationNonnegative: excessH >= 0 },
            trace: [
                { step: "neutralize", module: "neutralization", data: common },
                { step: "route", module: "strong_acid_base", data: { excessKind: "acid" } }
            ],
            warnings: []
        };
    }
    throw new Error("第一版暫不支援弱酸與弱鹼直接混合");
}
function mergeChild(method, common, child, routedModule) {
    return {
        method,
        result: child.result,
        intermediates: { ...common, routedModule, ...child.intermediates },
        checks: { stoichiometryPassed: true, ...child.checks },
        trace: [
            { step: "neutralize", module: "neutralization", data: common },
            { step: "route", module: routedModule },
            ...child.trace
        ],
        warnings: child.warnings
    };
}
