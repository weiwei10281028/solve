import { oneOf, positiveInteger, positiveNumber } from "./validation.js";
export function parseReagent(raw, name) {
    if (!raw || typeof raw !== "object")
        throw new Error(`${name} 必須是物件`);
    const r = raw;
    return {
        strength: oneOf(r.strength, ["strong", "weak"], `input.${name}.strength`),
        species: r.species ?? null,
        concentration: positiveNumber(r.concentration, `input.${name}.concentration`),
        volumeL: positiveNumber(r.volumeL, `input.${name}.volumeL`),
        equivalents: positiveInteger(r.equivalents, `input.${name}.equivalents`, 1),
        Ka: typeof r.Ka === "number" ? r.Ka : undefined,
        Ka1: typeof r.Ka1 === "number" ? r.Ka1 : undefined,
        Ka2: typeof r.Ka2 === "number" ? r.Ka2 : undefined,
        Kb: typeof r.Kb === "number" ? r.Kb : undefined
    };
}
export function isDiproticAcid(acid) {
    return acid.strength === "weak" && (acid.equivalents >= 2 || !!(acid.Ka1 && acid.Ka2));
}
