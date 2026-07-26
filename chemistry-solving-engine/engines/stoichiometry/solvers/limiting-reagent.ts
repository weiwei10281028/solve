import { EngineError } from "../../../core/errors.js";

type SpeciesEntry = { id: string; coefficient: number };

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是物件`, field);
  }
  return value as Record<string, unknown>;
}

function positiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是大於 0 的有限數值`, field);
  }
  return value;
}

function speciesId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是非空白字串`, field);
  }
  return value;
}

function speciesList(value: unknown, field: string): SpeciesEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是非空陣列`, field);
  }

  const seen = new Set<string>();
  return value.map((item, index) => {
    const entry = objectValue(item, `${field}[${index}]`);
    const id = speciesId(entry.id, `${field}[${index}].id`);
    if (seen.has(id)) {
      throw new EngineError("INVALID_INPUT", `${field} 的 species id 不可重複`, `${field}[${index}].id`);
    }
    seen.add(id);
    return {
      id,
      coefficient: positiveNumber(entry.coefficient, `${field}[${index}].coefficient`),
    };
  });
}

export function solveLimitingReagent(input: Record<string, unknown>) {
  const reaction = objectValue(input.reaction, "input.reaction");
  const reactants = speciesList(reaction.reactants, "input.reaction.reactants");
  const products = speciesList(reaction.products, "input.reaction.products");
  const allIds = new Set<string>();
  for (const entry of [...reactants, ...products]) {
    if (allIds.has(entry.id)) {
      throw new EngineError("INVALID_INPUT", `reaction 中 species id 不可重複`, "input.reaction");
    }
    allIds.add(entry.id);
  }

  const amounts = objectValue(input.reactantAmounts_mol, "input.reactantAmounts_mol");
  const reactantIds = new Set(reactants.map((entry) => entry.id));
  for (const key of Object.keys(amounts)) {
    if (!reactantIds.has(key)) {
      throw new EngineError("INVALID_INPUT", `未知反應物 ${key}`, `input.reactantAmounts_mol.${key}`);
    }
  }

  const targetProductId = speciesId(input.targetProductId, "input.targetProductId");
  const targetProduct = products.find((entry) => entry.id === targetProductId);
  if (!targetProduct) {
    throw new EngineError("INVALID_INPUT", `找不到目標產物 ${targetProductId}`, "input.targetProductId");
  }

  const extentsByReactant: Record<string, number> = {};
  let limitingReactantId = reactants[0].id;
  let reactionExtent_mol = Number.POSITIVE_INFINITY;

  for (const reactant of reactants) {
    if (!(reactant.id in amounts)) {
      throw new EngineError("INVALID_INPUT", `缺少反應物 ${reactant.id} 的莫耳數`, `input.reactantAmounts_mol.${reactant.id}`);
    }
    const amount_mol = positiveNumber(amounts[reactant.id], `input.reactantAmounts_mol.${reactant.id}`);
    const extent = amount_mol / reactant.coefficient;
    extentsByReactant[reactant.id] = extent;
    if (extent < reactionExtent_mol) {
      reactionExtent_mol = extent;
      limitingReactantId = reactant.id;
    }
  }

  const theoreticalYield_mol = reactionExtent_mol * targetProduct.coefficient;
  const result: Record<string, unknown> = {
    limitingReactantId,
    reactionExtent_mol,
    theoreticalYield_mol,
  };

  let productMolarMass_g_mol: number | undefined;
  if (input.productMolarMass_g_mol !== undefined) {
    productMolarMass_g_mol = positiveNumber(input.productMolarMass_g_mol, "input.productMolarMass_g_mol");
    result.theoreticalYield_g = theoreticalYield_mol * productMolarMass_g_mol;
  }

  return {
    method: "minimum_reaction_extent",
    result,
    intermediates: {
      extentsByReactant,
      targetProductCoefficient: targetProduct.coefficient,
      ...(productMolarMass_g_mol === undefined ? {} : { productMolarMass_g_mol }),
    },
    checks: {
      allReactantAmountsProvided: true,
      targetProductFound: true,
      reactionExtentFinite: Number.isFinite(reactionExtent_mol),
    },
    trace: [
      { step: "validate_reaction", module: "limiting_reagent" },
      { step: "calculate_reactant_extents", module: "limiting_reagent", data: { extentsByReactant } },
      { step: "select_minimum_extent", module: "limiting_reagent", data: { limitingReactantId, reactionExtent_mol } },
      { step: "calculate_theoretical_yield", module: "limiting_reagent", data: { targetProductId, theoreticalYield_mol } },
    ],
    warnings: [],
  };
}
