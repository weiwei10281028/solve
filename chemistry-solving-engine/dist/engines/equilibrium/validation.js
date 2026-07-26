import { EngineError } from "../../core/errors.js";
export function finiteNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是有限數值`, field);
    }
    return value;
}
export function positiveNumber(value, field) {
    const parsed = finiteNumber(value, field);
    if (parsed <= 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須大於 0`, field);
    }
    return parsed;
}
export function nonnegativeNumber(value, field) {
    const parsed = finiteNumber(value, field);
    if (parsed < 0) {
        throw new EngineError("INVALID_INPUT", `${field} 不得小於 0`, field);
    }
    return parsed;
}
export function nonemptyString(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是非空白字串`, field);
    }
    return value.trim();
}
export function booleanValue(value, field, defaultValue) {
    if (value === undefined && defaultValue !== undefined)
        return defaultValue;
    if (typeof value !== "boolean") {
        throw new EngineError("INVALID_INPUT", `${field} 必須是布林值`, field);
    }
    return value;
}
export function oneOf(value, choices, field) {
    if (typeof value !== "string" || !choices.includes(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是 ${choices.join("、")} 之一`, field);
    }
    return value;
}
export function stringArray(value, field, defaultValue = []) {
    if (value === undefined)
        return defaultValue;
    if (!Array.isArray(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是字串陣列`, field);
    }
    return value.map((item, index) => nonemptyString(item, `${field}[${index}]`));
}
export function numberRecord(value, field) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是物種對數值的物件`, field);
    }
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        result[nonemptyString(key, `${field} 的鍵`)] = nonnegativeNumber(entry, `${field}.${key}`);
    }
    return result;
}
function parseSpecies(value, field) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是物種物件`, field);
    }
    const raw = value;
    return {
        species: nonemptyString(raw.species, `${field}.species`),
        coefficient: positiveNumber(raw.coefficient, `${field}.coefficient`),
        phase: oneOf(raw.phase, ["aq", "g", "s", "l"], `${field}.phase`),
    };
}
export function reactionDefinition(value, field = "input.reaction") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是反應物件`, field);
    }
    const raw = value;
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
export function activeSpecies(reaction) {
    return [...reaction.reactants, ...reaction.products].filter((entry) => entry.phase === "aq" || entry.phase === "g");
}
export function signedStoichiometricCoefficient(reaction, species) {
    const reactant = reaction.reactants.find((entry) => entry.species === species);
    if (reactant)
        return -reactant.coefficient;
    const product = reaction.products.find((entry) => entry.species === species);
    if (product)
        return product.coefficient;
    return undefined;
}
export function requireSpeciesValues(reaction, values, field) {
    for (const entry of activeSpecies(reaction)) {
        if (!(entry.species in values)) {
            throw new EngineError("INVALID_INPUT", `${field}.${entry.species} 缺少數值`, `${field}.${entry.species}`);
        }
        if (values[entry.species] <= 0) {
            throw new EngineError("INVALID_INPUT", `${field}.${entry.species} 必須大於 0，才能計算反應商`, `${field}.${entry.species}`);
        }
    }
}
