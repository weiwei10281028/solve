import test from "node:test";
import assert from "node:assert/strict";
import { solveChemistry } from "../dist/index.js";

function close(actual, expected, tolerance = 1e-3) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not close to ${expected}`);
}

test("0.1 M HCl", () => {
  const r = solveChemistry({ engine: "acid_base", operation: "strong_acid_base", input: { kind: "acid", concentration: 0.1, equivalents: 1 } });
  assert.equal(r.success, true);
  close(r.result.pH, 1, 1e-10);
});

test("0.1 M acetic acid", () => {
  const r = solveChemistry({ engine: "acid_base", operation: "weak_acid", input: { species: "CH3COOH", concentration: 0.1, Ka: 1.8e-5 } });
  assert.equal(r.success, true);
  close(r.result.pH, 2.88, 0.02);
  assert.equal(r.checks.massBalancePassed, true);
});

test("half-neutralized acetic acid buffer", () => {
  const r = solveChemistry({ engine: "acid_base", operation: "neutralization", input: {
    acid: { strength: "weak", concentration: 0.1, volumeL: 0.1, equivalents: 1, Ka: 1.8e-5 },
    base: { strength: "strong", concentration: 0.1, volumeL: 0.05, equivalents: 1 }
  }});
  assert.equal(r.success, true);
  close(r.result.pH, -Math.log10(1.8e-5), 1e-10);
  assert.equal(r.intermediates.routedModule, "buffer");
});

test("weak acid equivalence point is basic", () => {
  const r = solveChemistry({ engine: "acid_base", operation: "neutralization", input: {
    acid: { strength: "weak", concentration: 0.1, volumeL: 0.1, equivalents: 1, Ka: 1.8e-5 },
    base: { strength: "strong", concentration: 0.1, volumeL: 0.1, equivalents: 1 }
  }});
  assert.equal(r.success, true);
  assert.ok(r.result.pH > 7);
  assert.equal(r.method, "conjugate_base_hydrolysis");
});

test("0.1 M H2S diprotic weak acid", () => {
  const r = solveChemistry({
    engine: "acid_base",
    operation: "weak_acid_diprotic",
    input: { species: "H2S", concentration: 0.1, Ka1: 9.1e-8, Ka2: 1.2e-19, volumeL: 1 }
  });
  assert.equal(r.success, true);
  close(r.result.pH, 4.03, 0.05);
  assert.equal(r.checks.massBalancePassed, true);
});

test("diprotic acid titration before first equivalence", () => {
  const r = solveChemistry({
    engine: "acid_base",
    operation: "titration",
    input: {
      acid: { strength: "weak", concentration: 0.1, volumeL: 0.1, equivalents: 2, Ka1: 4.3e-7, Ka2: 4.7e-11 },
      base: { strength: "strong", concentration: 0.1, volumeL: 0.03, equivalents: 1 }
    }
  });
  assert.equal(r.success, true);
  assert.equal(r.intermediates.region, "before_first_equivalence");
  assert.ok(r.result.pH > 0 && r.result.pH < 14);
});

test("standalone buffer operation", () => {
  const r = solveChemistry({
    engine: "acid_base",
    operation: "buffer",
    input: { bufferType: "acid", Ka: 1.8e-5, acidMoles: 0.01, conjugateBaseMoles: 0.01, totalVolumeL: 0.2 }
  });
  assert.equal(r.success, true);
  close(r.result.pH, -Math.log10(1.8e-5), 1e-10);
});

test("reconstruct diprotic equilibrium H2A state problem", () => {
  const r = solveChemistry({
    engine: "acid_base",
    operation: "reconstruct_diprotic_equilibrium",
    input: {
      formalConcentration: 0.24,
      pH: 4.0,
      degreeOfDissociation: 11 / 12,
      ratioHAtoA2: 10
    }
  });
  assert.equal(r.success, true);
  close(r.result.constants.pKa1, 3.0, 0.05);
  close(r.result.constants.pKa2, 5.0, 0.05);
  close(r.result.species.HA_minus, 0.2, 0.01);
  assert.equal(r.checks.massBalancePassed, true);
});
