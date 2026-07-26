import { KW_25C, pHFromH, positiveRootForWeakEquilibrium, solveAmphiproticPH } from "../math.js";
import { positiveNumber } from "../validation.js";
import { solveAcidBuffer } from "./buffer.js";
import { solveDiproticWeakAcid } from "./diprotic-weak-acid.js";
function mergeChild(method, common, child, routedModule) {
    return {
        method,
        result: child.result,
        intermediates: { ...common, routedModule, ...child.intermediates },
        checks: { stoichiometryPassed: true, ...child.checks },
        trace: [
            { step: "titration_stoichiometry", module: "titration", data: common },
            { step: "route", module: routedModule },
            ...child.trace
        ],
        warnings: child.warnings
    };
}
export function solveDiproticWeakAcidStrongBase(acid, base) {
    const Ka1 = positiveNumber(acid.Ka1 ?? acid.Ka, "input.acid.Ka1");
    const Ka2 = positiveNumber(acid.Ka2, "input.acid.Ka2");
    const totalVolumeL = acid.volumeL + base.volumeL;
    const acidMoles = acid.concentration * acid.volumeL;
    const baseEq = base.concentration * base.volumeL * base.equivalents;
    const tolerance = 1e-12;
    const common = {
        titrationType: "weak_diprotic_acid_strong_base",
        acidMoles,
        baseEquivalentMoles: baseEq,
        totalVolumeL,
        Ka1,
        Ka2,
        firstEquivalenceBaseEq: acidMoles,
        secondEquivalenceBaseEq: 2 * acidMoles,
        titrationFraction: baseEq / (2 * acidMoles)
    };
    if (baseEq <= tolerance) {
        const child = solveDiproticWeakAcid({
            species: acid.species,
            concentration: acid.concentration,
            Ka1,
            Ka2,
            volumeL: acid.volumeL
        });
        return mergeChild("diprotic_acid_initial", common, child, "diprotic_weak_acid");
    }
    if (baseEq < acidMoles - tolerance) {
        const h2aMoles = acidMoles - baseEq;
        const haMoles = baseEq;
        const child = solveAcidBuffer({
            Ka: Ka1,
            acidMoles: h2aMoles,
            conjugateBaseMoles: haMoles,
            totalVolumeL
        });
        return mergeChild("diprotic_acid_first_buffer", { ...common, region: "before_first_equivalence", h2aMoles, haMoles }, child, "buffer");
    }
    if (Math.abs(baseEq - acidMoles) <= tolerance) {
        const amphiproticC = acidMoles / totalVolumeL;
        const h = solveAmphiproticPH(amphiproticC, Ka1, Ka2);
        const oh = KW_25C / h;
        const pH = pHFromH(h);
        return {
            method: "diprotic_first_equivalence_amphiprotic",
            result: { pH, H: h, OH: oh },
            intermediates: {
                ...common,
                region: "first_equivalence",
                amphiproticConcentration: amphiproticC,
                averageOfpKa1pKa2: (-Math.log10(Ka1) - Math.log10(Ka2)) / 2
            },
            checks: { stoichiometryPassed: true, concentrationNonnegative: amphiproticC >= 0 },
            trace: [
                { step: "titration_stoichiometry", module: "titration", data: common },
                { step: "first_equivalence", module: "titration", data: { amphiproticConcentration: amphiproticC } },
                { step: "calculate_ph", module: "titration", data: { pH } }
            ],
            warnings: []
        };
    }
    if (baseEq < 2 * acidMoles - tolerance) {
        const haMoles = 2 * acidMoles - baseEq;
        const a2Moles = baseEq - acidMoles;
        const child = solveAcidBuffer({
            Ka: Ka2,
            acidMoles: haMoles,
            conjugateBaseMoles: a2Moles,
            totalVolumeL
        });
        return mergeChild("diprotic_acid_second_buffer", { ...common, region: "between_equivalences", haMoles, a2Moles }, child, "buffer");
    }
    if (Math.abs(baseEq - 2 * acidMoles) <= tolerance) {
        const a2C = (2 * acidMoles) / totalVolumeL;
        const Kb2 = KW_25C / Ka2;
        const oh = positiveRootForWeakEquilibrium(Kb2, a2C);
        const h = KW_25C / oh;
        return {
            method: "diprotic_second_equivalence_hydrolysis",
            result: { pH: pHFromH(h), H: h, OH: oh },
            intermediates: { ...common, region: "second_equivalence", conjugateBase2Concentration: a2C, Kb2 },
            checks: { stoichiometryPassed: true, concentrationNonnegative: a2C - oh >= 0 },
            trace: [
                { step: "titration_stoichiometry", module: "titration", data: common },
                { step: "second_equivalence", module: "titration", data: { conjugateBase2Concentration: a2C } },
                { step: "route", module: "hydrolysis" }
            ],
            warnings: []
        };
    }
    const excessOH = (baseEq - 2 * acidMoles) / totalVolumeL;
    const h = KW_25C / excessOH;
    return {
        method: "diprotic_strong_base_excess",
        result: { pH: pHFromH(h), H: h, OH: excessOH },
        intermediates: { ...common, region: "after_second_equivalence", excessOHConcentration: excessOH },
        checks: { stoichiometryPassed: true, concentrationNonnegative: excessOH >= 0 },
        trace: [
            { step: "titration_stoichiometry", module: "titration", data: common },
            { step: "route", module: "strong_acid_base", data: { excessKind: "base" } }
        ],
        warnings: []
    };
}
