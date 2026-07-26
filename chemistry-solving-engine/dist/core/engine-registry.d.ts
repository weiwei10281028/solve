import type { EngineRequest, EngineResponse } from "./engine-interface.js";
export type ChemistryEngine = (request: EngineRequest) => EngineResponse;
/**
 * 所有章節引擎只在此登記。
 * 主網站不應直接匯入個別章節。
 */
export declare const engineRegistry: Record<string, ChemistryEngine>;
