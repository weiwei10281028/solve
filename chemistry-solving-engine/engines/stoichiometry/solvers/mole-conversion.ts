import { EngineError } from "../../../core/errors.js";

const DEFAULT_AVOGADRO_CONSTANT = 6.02e23;
const MODES = [
  "mass_to_moles",
  "moles_to_mass",
  "particles_to_moles",
  "moles_to_particles",
] as const;

type MoleConversionMode = (typeof MODES)[number];

function positiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new EngineError("INVALID_INPUT", `${field} 必須是大於 0 的有限數值`, field);
  }
  return value;
}

function modeValue(value: unknown): MoleConversionMode {
  if (typeof value !== "string" || !MODES.includes(value as MoleConversionMode)) {
    throw new EngineError("INVALID_INPUT", `input.mode 不支援`, "input.mode");
  }
  return value as MoleConversionMode;
}

export function solveMoleConversion(input: Record<string, unknown>) {
  const mode = modeValue(input.mode);

  switch (mode) {
    case "mass_to_moles": {
      const mass_g = positiveNumber(input.mass_g, "input.mass_g");
      const molarMass_g_mol = positiveNumber(input.molarMass_g_mol, "input.molarMass_g_mol");
      const amount_mol = mass_g / molarMass_g_mol;

      return {
        method: "mass_to_moles",
        result: { amount_mol },
        intermediates: { mass_g, molarMass_g_mol },
        checks: { resultFinite: Number.isFinite(amount_mol), resultPositive: amount_mol > 0 },
        trace: [
          { step: "validate_input", module: "mole_conversion" },
          { step: "divide_mass_by_molar_mass", module: "mole_conversion", data: { mass_g, molarMass_g_mol, amount_mol } },
        ],
        warnings: [],
      };
    }

    case "moles_to_mass": {
      const amount_mol = positiveNumber(input.amount_mol, "input.amount_mol");
      const molarMass_g_mol = positiveNumber(input.molarMass_g_mol, "input.molarMass_g_mol");
      const mass_g = amount_mol * molarMass_g_mol;

      return {
        method: "moles_to_mass",
        result: { mass_g },
        intermediates: { amount_mol, molarMass_g_mol },
        checks: { resultFinite: Number.isFinite(mass_g), resultPositive: mass_g > 0 },
        trace: [
          { step: "validate_input", module: "mole_conversion" },
          { step: "multiply_moles_by_molar_mass", module: "mole_conversion", data: { amount_mol, molarMass_g_mol, mass_g } },
        ],
        warnings: [],
      };
    }

    case "particles_to_moles": {
      const particles = positiveNumber(input.particles, "input.particles");
      const avogadroConstant = input.avogadroConstant === undefined
        ? DEFAULT_AVOGADRO_CONSTANT
        : positiveNumber(input.avogadroConstant, "input.avogadroConstant");
      const amount_mol = particles / avogadroConstant;

      return {
        method: "particles_to_moles",
        result: { amount_mol },
        intermediates: { particles, avogadroConstant },
        checks: { resultFinite: Number.isFinite(amount_mol), resultPositive: amount_mol > 0 },
        trace: [
          { step: "validate_input", module: "mole_conversion" },
          { step: "divide_particles_by_avogadro_constant", module: "mole_conversion", data: { particles, avogadroConstant, amount_mol } },
        ],
        warnings: [],
      };
    }

    case "moles_to_particles": {
      const amount_mol = positiveNumber(input.amount_mol, "input.amount_mol");
      const avogadroConstant = input.avogadroConstant === undefined
        ? DEFAULT_AVOGADRO_CONSTANT
        : positiveNumber(input.avogadroConstant, "input.avogadroConstant");
      const particles = amount_mol * avogadroConstant;

      return {
        method: "moles_to_particles",
        result: { particles },
        intermediates: { amount_mol, avogadroConstant },
        checks: { resultFinite: Number.isFinite(particles), resultPositive: particles > 0 },
        trace: [
          { step: "validate_input", module: "mole_conversion" },
          { step: "multiply_moles_by_avogadro_constant", module: "mole_conversion", data: { amount_mol, avogadroConstant, particles } },
        ],
        warnings: [],
      };
    }
  }
}
