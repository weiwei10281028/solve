export type AcidBaseOperation =
  | "strong_acid_base"
  | "weak_acid"
  | "weak_base"
  | "weak_acid_diprotic"
  | "reconstruct_diprotic_equilibrium"
  | "derive_diprotic_constants"
  | "neutralization"
  | "titration"
  | "buffer";

export type EquilibriumOperation =
  | "dilution_effect"
  | "reaction_quotient_direction"
  | "le_chatelier_disturbance";

export type StoichiometryOperation =
  | "mole_conversion"
  | "stoichiometric_ratio"
  | "limiting_reagent"
  | "theoretical_yield"
  | "percent_yield";

export type EngineRequest =
  | {
      engine: "acid_base";
      operation: AcidBaseOperation;
      input: Record<string, unknown>;
      options?: EngineOptions;
    }
  | {
      engine: "equilibrium";
      operation: EquilibriumOperation;
      input: Record<string, unknown>;
      options?: EngineOptions;
    }
  | {
      engine: "stoichiometry";
      operation: StoichiometryOperation;
      input: Record<string, unknown>;
      options?: EngineOptions;
    };

export type EngineOptions = {
  temperatureC?: number;
  approximationThreshold?: number;
  returnAllIntermediates?: boolean;
};

export type TraceStep = {
  step: string;
  module: string;
  data?: Record<string, unknown>;
};

export type EngineSuccess = {
  success: true;
  engine: string;
  operation: string;
  method: string;
  result: Record<string, unknown>;
  intermediates: Record<string, unknown>;
  checks: Record<string, unknown>;
  trace: TraceStep[];
  warnings: string[];
};

export type EngineFailure = {
  success: false;
  engine: string;
  operation: string;
  error: { code: string; message: string; field?: string };
};

export type EngineResponse = EngineSuccess | EngineFailure;
