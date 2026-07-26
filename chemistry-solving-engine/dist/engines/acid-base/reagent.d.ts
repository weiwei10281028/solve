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
export declare function parseReagent(raw: unknown, name: "acid" | "base"): AcidBaseReagent;
export declare function isDiproticAcid(acid: AcidBaseReagent): boolean;
