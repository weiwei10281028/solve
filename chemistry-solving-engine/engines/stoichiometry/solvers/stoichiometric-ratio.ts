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

export function solveStoichiometricRatio(input: Record<string, unknown>) {
  const reaction = objectValue(input.reaction, "input.reaction");
  const species = speciesList(reaction.species, "input.reaction.species");
  const known = objectValue(input.known, "input.known");
  const knownSpeciesId = speciesId(known.speciesId, "input.known.speciesId");
  const knownAmount_mol = positiveNumber(known.amount_mol, "input.known.amount_mol");
  const targetSpeciesId = speciesId(input.targetSpeciesId, "input.targetSpeciesId");

  const knownSpecies = species.find((entry) => entry.id === knownSpeciesId);
  if (!knownSpecies) {
    throw new EngineError("INVALID_INPUT", `找不到已知物種 ${knownSpeciesId}`, "input.known.speciesId");
  }

  const targetSpecies = species.find((entry) => entry.id === targetSpeciesId);
  if (!targetSpecies) {
    throw new EngineError("INVALID_INPUT", `找不到目標物種 ${targetSpeciesId}`, "input.targetSpeciesId");
  }

  const ratio = targetSpecies.coefficient / knownSpecies.coefficient;
  const targetAmount_mol = knownAmount_mol * ratio;

  return {
    method: "stoichiometric_coefficient_ratio",
    result: {
      knownSpeciesId,
      targetSpeciesId,
      targetAmount_mol,
      ratio,
    },
    intermediates: {
      knownAmount_mol,
      knownCoefficient: knownSpecies.coefficient,
      targetCoefficient: targetSpecies.coefficient,
    },
    checks: {
      knownSpeciesFound: true,
      targetSpeciesFound: true,
      resultFinite: Number.isFinite(targetAmount_mol),
    },
    trace: [
      { step: "validate_reaction", module: "stoichiometric_ratio" },
      { step: "resolve_species_coefficients", module: "stoichiometric_ratio", data: { knownSpeciesId, targetSpeciesId } },
      { step: "apply_coefficient_ratio", module: "stoichiometric_ratio", data: { ratio, targetAmount_mol } },
    ],
    warnings: [],
  };
}
