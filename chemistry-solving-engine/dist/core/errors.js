export class EngineError extends Error {
    code;
    field;
    constructor(code, message, field) {
        super(message);
        this.name = "EngineError";
        this.code = code;
        this.field = field;
    }
}
