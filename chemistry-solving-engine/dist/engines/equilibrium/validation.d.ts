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
export declare function finiteNumber(value: unknown, field: string): number;
export declare function positiveNumber(value: unknown, field: string): number;
export declare function nonnegativeNumber(value: unknown, field: string): number;
export declare function nonemptyString(value: unknown, field: string): string;
export declare function booleanValue(value: unknown, field: string, defaultValue?: boolean): boolean;
export declare function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T;
export declare function stringArray(value: unknown, field: string, defaultValue?: string[]): string[];
export declare function numberRecord(value: unknown, field: string): Record<string, number>;
export declare function reactionDefinition(value: unknown, field?: string): ReactionDefinition;
export declare function activeSpecies(reaction: ReactionDefinition): ReactionSpecies[];
export declare function signedStoichiometricCoefficient(reaction: ReactionDefinition, species: string): number | undefined;
export declare function requireSpeciesValues(reaction: ReactionDefinition, values: Record<string, number>, field: string): void;
