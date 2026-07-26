export declare class EngineError extends Error {
    code: string;
    field?: string;
    constructor(code: string, message: string, field?: string);
}
