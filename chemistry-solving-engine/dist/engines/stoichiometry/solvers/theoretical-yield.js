import { EngineError } from "../../../core/errors.js";
function objectValue(value, field) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是物件`, field);
    }
    return value;
}
function positiveNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是大於 0 的有限數值`, field);
    }
    return value;
}
function speciesId(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是非空白字串`, field);
    }
    return value;
}
export function solveTheoreticalYield(input) {
    const limitingReactant = objectValue(input.limitingReactant, "input.limitingReactant");
    const product = objectValue(input.product, "input.product");
    const limitingReactantId = speciesId(limitingReactant.id, "input.limitingReactant.id");
    const limitingCoefficient = positiveNumber(limitingReactant.coefficient, "input.limitingReactant.coefficient");
    const limitingAmount_mol = positiveNumber(limitingReactant.amount_mol, "input.limitingReactant.amount_mol");
    const productId = speciesId(product.id, "input.product.id");
    const productCoefficient = positiveNumber(product.coefficient, "input.product.coefficient");
    const reactionExtent_mol = limitingAmount_mol / limitingCoefficient;
    const theoreticalYield_mol = reactionExtent_mol * productCoefficient;
    const result = {
        productId,
        reactionExtent_mol,
        theoreticalYield_mol,
    };
    let molarMass_g_mol;
    if (product.molarMass_g_mol !== undefined) {
        molarMass_g_mol = positiveNumber(product.molarMass_g_mol, "input.product.molarMass_g_mol");
        result.theoreticalYield_g = theoreticalYield_mol * molarMass_g_mol;
    }
    return {
        method: "limiting_reactant_coefficient_ratio",
        result,
        intermediates: {
            limitingReactantId,
            limitingAmount_mol,
            limitingCoefficient,
            productCoefficient,
            ...(molarMass_g_mol === undefined ? {} : { molarMass_g_mol }),
        },
        checks: {
            reactionExtentFinite: Number.isFinite(reactionExtent_mol),
            theoreticalYieldFinite: Number.isFinite(theoreticalYield_mol),
        },
        trace: [
            { step: "validate_input", module: "theoretical_yield" },
            { step: "calculate_reaction_extent", module: "theoretical_yield", data: { reactionExtent_mol } },
            { step: "apply_product_coefficient", module: "theoretical_yield", data: { productId, theoreticalYield_mol } },
        ],
        warnings: [],
    };
}
