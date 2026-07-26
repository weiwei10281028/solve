export declare function positiveNumber(value: unknown, field: string): number;
export declare function positiveInteger(value: unknown, field: string, defaultValue?: number): number;
export declare function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T;
