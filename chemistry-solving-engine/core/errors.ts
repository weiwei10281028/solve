export class EngineError extends Error {
  code: string;
  field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.field = field;
  }
}
