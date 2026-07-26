import { EngineError } from "../../core/errors.js";

export type Phase = "aq" | "g" | "s" | "l";
export type ReactionSide = "reactant" | "product";

export type ReactionSpecies = {
  species: string;
  coefficient: number;
  phase: Phase;
};

export type ReactionDefinition = {
  reactants: ReactionSpecies[];
  products: ReactionSpecies[];
};

export function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是有限數值`, field);
  }
  return value;
}

export function positiveNumber(value: unknown, field: string): number {
  const parsed = finiteNumber(value, field);
  if (parsed <= 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須大於 0`, field);
  }
  return parsed;
}

export function nonnegativeNumber(value: unknown, field: string): number {
  const parsed = finiteNumber(value, field);
  if (parsed < 0) {
    throw new EngineError("INVALID_INPUT", `${field} 不得小於 0`, field);
  }
  return parsed;
}

export function nonemptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是非空白字串`, field);
  }
  return value.trim();
}

export function booleanValue(value: unknown, field: string, defaultValue?: boolean): boolean {
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value !== "boolean") {
    throw new EngineError("INVALID_INPUT", `${field} 必須是布林值`, field);
  }
  return value;
}

export function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是 ${choices.join("、")} 之一`, field);
  }
  return value as T;
}

export function stringArray(value: unknown, field: string, defaultValue: string[] = []): string[] {
  if (value === undefined) return defaultValue;
  if (!Array.isArray(value)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是字串陣列`, field);
  }
  return value.map((item, index) => nonemptyString(item, `${field}[${index}]`));
}

export function numberRecord(value: unknown, field: string): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是物種對數值的物件`, field);
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[nonemptyString(key, `${field} 的鍵`)] = nonnegativeNumber(entry, `${field}.${key}`);
  }
  return result;
}

function parseSpecies(value: unknown, field: string): ReactionSpecies {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是物種物件`, field);
  }

  const raw = value as Record<string, unknown>;
  return {
    species: nonemptyString(raw.species, `${field}.species`),
    coefficient: positiveNumber(raw.coefficient, `${field}.coefficient`),
    phase: oneOf(raw.phase, ["aq", "g", "s", "l"] as const, `${field}.phase`),
  };
}

export function reactionDefinition(value: unknown, field = "input.reaction"): ReactionDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是反應物件`, field);
  }

  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.reactants) || raw.reactants.length === 0) {
    throw new EngineError("INVALID_INPUT", `${field}.reactants 必須是非空陣列`, `${field}.reactants`);
  }
  if (!Array.isArray(raw.products) || raw.products.length === 0) {
    throw new EngineError("INVALID_INPUT", `${field}.products 必須是非空陣列`, `${field}.products`);
  }

  const reaction = {
    reactants: raw.reactants.map((item, index) => parseSpecies(item, `${field}.reactants[${index}]`)),
    products: raw.products.map((item, index) => parseSpecies(item, `${field}.products[${index}]`)),
  };

  const names = [...reaction.reactants, ...reaction.products].map((entry) => entry.species);
  if (new Set(names).size !== names.length) {
    throw new EngineError("INVALID_INPUT", "同一物種不可重複出現在反應式中", field);
  }

  return reaction;
}

export function activeSpecies(reaction: ReactionDefinition): ReactionSpecies[] {
  return [...reaction.reactants, ...reaction.products].filter(
    (entry) => entry.phase === "aq" || entry.phase === "g",
  );
}

export function signedStoichiometricCoefficient(
  reaction: ReactionDefinition,
  species: string,
): number | undefined {
  const reactant = reaction.reactants.find((entry) => entry.species === species);
  if (reactant) return -reactant.coefficient;
  const product = reaction.products.find((entry) => entry.species === species);
  if (product) return product.coefficient;
  return undefined;
}

export function requireSpeciesValues(
  reaction: ReactionDefinition,
  values: Record<string, number>,
  field: string,
): void {
  for (const entry of activeSpecies(reaction)) {
    if (!(entry.species in values)) {
      throw new EngineError(
        "INVALID_INPUT",
        `${field}.${entry.species} 缺少數值`,
        `${field}.${entry.species}`,
      );
    }
    if (values[entry.species] <= 0) {
      throw new EngineError(
        "INVALID_INPUT",
        `${field}.${entry.species} 必須大於 0，才能計算反應商`,
        `${field}.${entry.species}`,
      );
    }
  }
}
