import test from "node:test";
import assert from "node:assert/strict";
import { solveChemistry } from "../dist/index.js";

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not close to ${expected}`);
}

const n2o4Reaction = {
  reactants: [{ species: "N2O4", coefficient: 1, phase: "g" }],
  products: [{ species: "NO2", coefficient: 2, phase: "g" }],
};

test("reaction quotient: Q < K shifts forward", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "reaction_quotient_direction",
    input: {
      reaction: n2o4Reaction,
      activities: { N2O4: 0.5, NO2: 0.1 },
      K: 0.1,
    },
  });

  assert.equal(r.success, true);
  close(r.result.Q, 0.02);
  assert.equal(r.result.direction, "forward");
});

test("reaction quotient omits pure solid", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "reaction_quotient_direction",
    input: {
      reaction: {
        reactants: [{ species: "CaCO3", coefficient: 1, phase: "s" }],
        products: [
          { species: "CaO", coefficient: 1, phase: "s" },
          { species: "CO2", coefficient: 1, phase: "g" },
        ],
      },
      activities: { CO2: 0.4 },
      K: 0.4,
    },
  });

  assert.equal(r.success, true);
  close(r.result.Q, 0.4);
  assert.equal(r.result.direction, "at_equilibrium");
  assert.deepEqual(r.intermediates.omittedSpecies, ["CaCO3", "CaO"]);
});

test("simple dilution increases weak-electrolyte dissociation", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "dilution_effect",
    input: {
      reaction: {
        reactants: [{ species: "HA", coefficient: 1, phase: "aq" }],
        products: [
          { species: "H", coefficient: 1, phase: "aq" },
          { species: "A", coefficient: 1, phase: "aq" },
        ],
      },
      K: 0.01,
      initialActivities: { HA: 1, H: 0.1, A: 0.1 },
      dilutionFactor: 10,
      mode: "add_water",
      dissociatedSide: "products",
    },
  });

  assert.equal(r.success, true);
  close(r.result.QBefore, 0.01);
  close(r.result.QAfterInstantaneousDilution, 0.001);
  assert.equal(r.result.equilibriumShift, "forward");
  assert.equal(r.result.degreeOfDissociationTrend, "increase");
});

test("constant hydrogen-ion concentration can reverse dilution trend", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "dilution_effect",
    input: {
      reaction: {
        reactants: [{ species: "HA", coefficient: 1, phase: "aq" }],
        products: [
          { species: "H", coefficient: 1, phase: "aq" },
          { species: "A", coefficient: 1, phase: "aq" },
        ],
      },
      K: 0.01,
      initialActivities: { HA: 1, H: 0.1, A: 0.1 },
      dilutionFactor: 10,
      mode: "controlled_concentration",
      controlledSpecies: ["H"],
      dissociatedSide: "products",
    },
  });

  assert.equal(r.success, true);
  close(r.result.QAfterInstantaneousDilution, 0.01);
  assert.equal(r.result.equilibriumShift, "at_equilibrium");
  assert.equal(r.result.degreeOfDissociationTrend, "unchanged");
});

test("decreasing volume favors fewer gas moles", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "le_chatelier_disturbance",
    input: {
      reaction: n2o4Reaction,
      disturbance: "volume_change",
      change: "decrease",
    },
  });

  assert.equal(r.success, true);
  assert.equal(r.result.equilibriumShift, "reverse");
});

test("raising temperature favors endothermic direction", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "le_chatelier_disturbance",
    input: {
      reaction: n2o4Reaction,
      disturbance: "temperature_change",
      change: "increase",
      forwardReactionHeat: "endothermic",
    },
  });

  assert.equal(r.success, true);
  assert.equal(r.result.equilibriumShift, "forward");
});

test("adding inert gas at constant volume causes no shift", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "le_chatelier_disturbance",
    input: {
      reaction: n2o4Reaction,
      disturbance: "add_inert_gas",
      constraint: "constant_volume",
    },
  });

  assert.equal(r.success, true);
  assert.equal(r.result.equilibriumShift, "at_equilibrium");
});

test("invalid operation returns shared failure shape", () => {
  const r = solveChemistry({
    engine: "equilibrium",
    operation: "unknown_operation",
    input: {},
  });

  assert.equal(r.success, false);
  assert.equal(r.engine, "equilibrium");
  assert.equal(r.error.code, "UNSUPPORTED_OPERATION");
  assert.equal(r.error.field, "operation");
});
