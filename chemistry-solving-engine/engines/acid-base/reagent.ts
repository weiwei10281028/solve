import { oneOf, positiveInteger, positiveNumber } from "./validation.js";

export type AcidBaseReagent = {
  strength: "strong" | "weak";
  species: unknown;
  concentration: number;
  volumeL: number;
  equivalents: number;
  Ka?: number;
  Ka1?: number;
  Ka2?: number;
  Kb?: number;
};

export function parseReagent(raw: unknown, name: "acid" | "base"): AcidBaseReagent {
  if (!raw || typeof raw !== "object") throw new Error(`${name} 必須是物件`);
  const r = raw as Record<string, unknown>;
  return {
    strength: oneOf(r.strength, ["strong", "weak"] as const, `input.${name}.strength`),
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

export function isDiproticAcid(acid: AcidBaseReagent) {
  return acid.strength === "weak" && (acid.equivalents >= 2 || !!(acid.Ka1 && acid.Ka2));
}
