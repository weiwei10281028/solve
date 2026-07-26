import { EngineError } from "../../core/errors.js";
export function positiveNumber(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是大於 0 的有限數值`, field);
    }
    return value;
}
export function positiveInteger(value, field, defaultValue = 1) {
    if (value === undefined)
        return defaultValue;
    const parsed = positiveNumber(value, field);
    if (!Number.isInteger(parsed)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是正整數`, field);
    }
    return parsed;
}
export function oneOf(value, choices, field) {
    if (typeof value !== "string" || !choices.includes(value)) {
        throw new EngineError("INVALID_INPUT", `${field} 必須是 ${choices.join("、")} 之一`, field);
    }
    return value;
}
