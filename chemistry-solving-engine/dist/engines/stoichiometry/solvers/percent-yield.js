import { EngineError } from "../../../core/errors.js";
function nonnegativeNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是大於或等於 0 的有限數值`, field);
    }
    return value;
}
function positiveNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是大於 0 的有限數值`, field);
    }
    return value;
}
export function solvePercentYield(input) {
    const hasMassActual = input.actualYield_g !== undefined;
    const hasMassTheoretical = input.theoreticalYield_g !== undefined;
    const hasMolesActual = input.actualYield_mol !== undefined;
    const hasMolesTheoretical = input.theoreticalYield_mol !== undefined;
    const anyMassField = hasMassActual || hasMassTheoretical;
    const anyMolesField = hasMolesActual || hasMolesTheoretical;
    const completeMassPair = hasMassActual && hasMassTheoretical;
    const completeMolesPair = hasMolesActual && hasMolesTheoretical;
    if (anyMassField === anyMolesField || (anyMassField && !completeMassPair) || (anyMolesField && !completeMolesPair)) {
        throw new EngineError("INVALID_INPUT", `請提供一組完整且唯一的質量或莫耳數產量`, "input");
    }
    let actualYield;
    let theoreticalYield;
    let basis;
    if (completeMassPair) {
        actualYield = nonnegativeNumber(input.actualYield_g, "input.actualYield_g");
        theoreticalYield = positiveNumber(input.theoreticalYield_g, "input.theoreticalYield_g");
        basis = "mass";
    }
    else {
        actualYield = nonnegativeNumber(input.actualYield_mol, "input.actualYield_mol");
        theoreticalYield = positiveNumber(input.theoreticalYield_mol, "input.theoreticalYield_mol");
        basis = "moles";
    }
    const percentYield = (actualYield / theoreticalYield) * 100;
    const yieldNotOver100 = percentYield <= 100;
    return {
        method: "actual_over_theoretical_percent",
        result: { percentYield },
        intermediates: { basis, actualYield, theoreticalYield },
        checks: { yieldNotOver100 },
        trace: [
            { step: "validate_yield_pair", module: "percent_yield", data: { basis } },
            { step: "divide_actual_by_theoretical", module: "percent_yield", data: { actualYield, theoreticalYield } },
            { step: "convert_ratio_to_percent", module: "percent_yield", data: { percentYield } },
        ],
        warnings: yieldNotOver100
            ? []
            : ["實際產量大於理論產量，請檢查數據或單位。"],
    };
}
