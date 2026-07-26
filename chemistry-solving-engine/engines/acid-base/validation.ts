import { EngineError } from "../../core/errors.js";

export function positiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是大於 0 的有限數值`, field);
  }
  return value;
}

export function positiveInteger(value: unknown, field: string, defaultValue = 1): number {
  if (value === undefined) return defaultValue;
  const parsed = positiveNumber(value, field);
  if (!Number.isInteger(parsed)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是正整數`, field);
  }
  return parsed;
}

export function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是 ${choices.join("、")} 之一`, field);
  }
  return value as T;
}
