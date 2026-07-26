import type { EngineRequest, EngineResponse } from "./engine-interface.js";
import { solveAcidBase } from "../engines/acid-base/index.js";
import { solveEquilibrium } from "../engines/equilibrium/index.js";
import { solveStoichiometry } from "../engines/stoichiometry/index.js";

export type ChemistryEngine = (request: EngineRequest) => EngineResponse;

/**
 * 所有章節引擎只在此登記。
 * 主網站不應直接匯入個別章節。
 */
export const engineRegistry: Record<string, ChemistryEngine> = {
  acid_base: solveAcidBase,
  equilibrium: solveEquilibrium,
  stoichiometry: solveStoichiometry,
};
