import test from "node:test";
import assert from "node:assert/strict";
import { solveChemistry } from "../dist/index.js";

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not close to ${expected}`);
}

test("mole_conversion converts 12 g C to 1 mol", () => {
  const r = solveChemistry({
    engine: "stoichiometry",
    operation: "mole_conversion",
    input: {
      mode: "mass_to_moles",
      mass_g: 12,
      molarMass_g_mol: 12,
    },
  });

  assert.equal(r.success, true);
  close(r.result.amount_mol, 1);
});

test("stoichiometric_ratio converts 2 mol H2 to 2 mol H2O", () => {
  const r = solveChemistry({
    engine: "stoichiometry",
    operation: "stoichiometric_ratio",
    input: {
      reaction: {
        species: [
          { id: "H2", coefficient: 2 },
          { id: "O2", coefficient: 1 },
          { id: "H2O", coefficient: 2 },
        ],
      },
      known: { speciesId: "H2", amount_mol: 2 },
      targetSpeciesId: "H2O",
    },
  });

  assert.equal(r.success, true);
  close(r.result.targetAmount_mol, 2);
  close(r.result.ratio, 1);
});

test("limiting_reagent identifies O2 and calculates 1 mol H2O", () => {
  const r = solveChemistry({
    engine: "stoichiometry",
    operation: "limiting_reagent",
    input: {
      reaction: {
        reactants: [
          { id: "H2", coefficient: 2 },
          { id: "O2", coefficient: 1 },
        ],
        products: [{ id: "H2O", coefficient: 2 }],
      },
      reactantAmounts_mol: { H2: 2, O2: 0.5 },
      targetProductId: "H2O",
    },
  });

  assert.equal(r.success, true);
  assert.equal(r.result.limitingReactantId, "O2");
  close(r.result.reactionExtent_mol, 0.5);
  close(r.result.theoreticalYield_mol, 1);
});

test("theoretical_yield calculates 1 mol product", () => {
  const r = solveChemistry({
    engine: "stoichiometry",
    operation: "theoretical_yield",
    input: {
      limitingReactant: { id: "O2", coefficient: 1, amount_mol: 0.5 },
      product: { id: "H2O", coefficient: 2 },
    },
  });

  assert.equal(r.success, true);
  close(r.result.reactionExtent_mol, 0.5);
  close(r.result.theoreticalYield_mol, 1);
});

test("percent_yield calculates 80 percent", () => {
  const r = solveChemistry({
    engine: "stoichiometry",
    operation: "percent_yield",
    input: { actualYield_g: 8, theoreticalYield_g: 10 },
  });

  assert.equal(r.success, true);
  close(r.result.percentYield, 80);
  assert.equal(r.checks.yieldNotOver100, true);
});

test("invalid unknown speciesId returns INVALID_INPUT", () => {
  const r = solveChemistry({
    engine: "stoichiometry",
    operation: "stoichiometric_ratio",
    input: {
      reaction: {
        species: [
          { id: "H2", coefficient: 2 },
          { id: "O2", coefficient: 1 },
          { id: "H2O", coefficient: 2 },
        ],
      },
      known: { speciesId: "H2", amount_mol: 2 },
      targetSpeciesId: "CO2",
    },
  });

  assert.equal(r.success, false);
  assert.equal(r.error.code, "INVALID_INPUT");
});
