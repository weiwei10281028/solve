import { engineRegistry } from "./engine-registry.js";
export function solveChemistry(request) {
    if (!request || typeof request !== "object") {
        return {
            success: false,
            engine: "unknown",
            operation: "unknown",
            error: { code: "INVALID_REQUEST", message: "request 必須是物件" },
        };
    }
    const engineName = String(request.engine ?? "unknown");
    const engine = engineRegistry[engineName];
    if (!engine) {
        return {
            success: false,
            engine: engineName,
            operation: String(request.operation ?? "unknown"),
            error: {
                code: "UNSUPPORTED_ENGINE",
                message: `不支援 engine: ${engineName}`,
            },
        };
    }
    return engine(request);
}
