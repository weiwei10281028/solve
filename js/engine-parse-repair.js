/**
 * 修復第一次 AI 解析：補齊空 input、別名欄位、從題幹抽取數值、強制數值化。
 */
(function (global) {
  'use strict';

  const INPUT_FIELD_ALIASES = {
    formalConcentration: [
      'formalConcentration', 'concentration', 'totalConcentration', 'C', 'c',
      'formal_concentration', 'total_concentration', 'acidConcentration',
      '形式濃度', '總濃度', '分析濃度', '酸濃度'
    ],
    pH: ['pH', 'ph', 'PH'],
    degreeOfDissociation: [
      'degreeOfDissociation', 'alpha', 'firstDissociationAlpha', 'dissociationDegree',
      'dissociation', '解離度', 'dissociation_alpha'
    ],
    ratioHAtoA2: [
      'ratioHAtoA2', 'haToA2Ratio', 'speciesRatio', 'HA_to_A2_ratio',
      'haToA2', 'HA_minus_to_A2_minus_ratio', 'concentrationRatio', 'ha_a2_ratio'
    ],
    species: ['species', 'acid', 'name'],
    Ka: ['Ka', 'ka', 'Ka1', 'ka1'],
    Ka1: ['Ka1', 'ka1'],
    Ka2: ['Ka2', 'ka2'],
    Kb: ['Kb', 'kb'],
    volumeL: ['volumeL', 'volume', 'V']
  };

  const OPERATION_REQUIRED = {
    reconstruct_diprotic_equilibrium: [
      'formalConcentration', 'pH', 'degreeOfDissociation', 'ratioHAtoA2'
    ],
    derive_diprotic_constants: ['pH'],
    weak_acid: ['concentration', 'Ka'],
    weak_base: ['concentration', 'Kb'],
    weak_acid_diprotic: ['concentration', 'Ka1', 'Ka2'],
    strong_acid_base: ['concentration']
  };

  const DIPROTIC_HINT = /H2A|H₂A|H\u2082A|二元酸|二質子酸|diprotic|多質子酸|reconstruct_diprotic|解離度|α\s*[=＝]|alpha\s*[=＝]|\[HA/i;

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'boolean') return null;
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(/,/g, '');
    if (!text) return null;
    const frac = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (frac) {
      const den = Number(frac[2]);
      return den ? Number(frac[1]) / den : null;
    }
    const sci = text
      .replace(/[×x]\s*10\s*\^?\s*([+-]?\d+)/i, 'e$1')
      .replace(/×\s*10⁻?(\d+)/i, 'e-$1');
    const n = Number(sci);
    return Number.isFinite(n) ? n : null;
  }

  function positiveNumber(value) {
    const n = toNumber(value);
    return n !== null && n > 0 ? n : null;
  }

  function normalizeKey(key) {
    return String(key || '')
      .replace(/\s+/g, '')
      .replace(/[⁻−\-]/g, '-')
      .replace(/[²2]/g, '2')
      .toLowerCase();
  }

  function aliasToCanonical(key) {
    const nk = normalizeKey(key);
    for (const [canonical, aliases] of Object.entries(INPUT_FIELD_ALIASES)) {
      for (const alias of aliases) {
        if (normalizeKey(alias) === nk) return canonical;
      }
    }
    if (/^ha.*a2.*ratio$/.test(nk) || nk.includes('ha-/a2-')) return 'ratioHAtoA2';
    if (nk.includes('解離度') || nk === 'α' || nk === 'alpha') return 'degreeOfDissociation';
    if (nk === 'c' || nk.includes('濃度')) return 'formalConcentration';
    return null;
  }

  function assignField(out, canonical, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return;
    if (canonical === 'species') {
      if (typeof rawValue === 'string' && rawValue.trim()) out.species = rawValue.trim();
      return;
    }
    const num = toNumber(rawValue);
    if (num === null) return;
    if (canonical === 'degreeOfDissociation') {
      if (num > 0 && num <= 1) out.degreeOfDissociation = num;
      else if (num > 1 && num <= 100) out.degreeOfDissociation = num / 100;
      else if (num > 1 && num <= 12) out.degreeOfDissociation = num / 12;
      return;
    }
    if (canonical === 'pH') {
      if (num >= 0) out.pH = num;
      return;
    }
    if (num > 0) out[canonical] = num;
  }

  function collectFromObject(node, out, depth = 0) {
    if (!isPlainObject(node) || depth > 8) return;
    for (const [key, value] of Object.entries(node)) {
      const canonical = aliasToCanonical(key);
      if (canonical) assignField(out, canonical, value);
      if (isPlainObject(value)) collectFromObject(value, out, depth + 1);
      else if (typeof value === 'string' && value.trim()) {
        collectFromText(value, out);
      }
    }
  }

  function collectFromText(text, out) {
    const extracted = extractDiproticEquilibriumFromText(text);
    mergeInput(out, extracted);
  }

  function extractDiproticEquilibriumFromText(text) {
    const t = String(text || '');
    const out = {};

    const ph = t.match(/pH\s*[=＝：:]\s*([\d.]+)/i);
    if (ph) out.pH = Number(ph[1]);

    const alphaFrac = t.match(/(?:解離度|α|alpha)\s*[=＝：:]\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i)
      || t.match(/(?:解離度|α|alpha)\s*(?:為|是|=\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i)
      || t.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:的)?解離度/i);
    if (alphaFrac) {
      out.degreeOfDissociation = Number(alphaFrac[1]) / Number(alphaFrac[2]);
    } else {
      const alphaDec = t.match(/(?:解離度|α|alpha)\s*[=＝：:]\s*([\d.]+)/i);
      if (alphaDec) assignField(out, 'degreeOfDissociation', alphaDec[1]);
    }

    const ratio = t.match(
      /(?:\[\s*HA\s*[-⁻]?\s*\]\s*\/\s*\[\s*A\s*2?\s*[-⁻²]?\s*\]|HA\s*[-⁻]?\s*\/\s*A\s*2?\s*[-⁻]?|濃度比|莫耳濃度比)\s*[=＝：:]\s*(\d+(?:\.\d+)?)/i
    );
    if (ratio) out.ratioHAtoA2 = Number(ratio[1]);

    const concPatterns = [
      /(?:總濃度|形式濃度|分析濃度|酸濃度|濃度)\s*(?:為|是)?\s*[=＝：:]\s*([\d.]+)\s*(?:M|mol)/i,
      /([\d.]+)\s*(?:M|mol\s*\/\s*L|mol\/L)[^\n]{0,80}(?:H[\u2082₂2]?A|H2A|二元酸|二質子酸)/i,
      /(?:H[\u2082₂2]?A|H2A|二元酸|二質子酸)[^\n]{0,80}([\d.]+)\s*(?:M|mol\s*\/\s*L|mol\/L)/i,
      /(?:取|將|配製|製成)[^\n]{0,30}([\d.]+)\s*(?:M|mol\s*\/\s*L|mol\/L)/i,
      /"formalConcentration"\s*:\s*"?([\d.]+)"?/i,
      /"concentration"\s*:\s*"?([\d.]+)"?/i,
      /([\d.]+)\s*(?:M|mol\s*\/\s*L|mol\/L)\b/i
    ];
    for (const pattern of concPatterns) {
      const m = t.match(pattern);
      if (m) {
        const n = Number(m[1]);
        if (n > 0 && (out.pH === undefined || Math.abs(n - out.pH) > 0.001)) {
          out.formalConcentration = n;
          break;
        }
      }
    }

    return out;
  }

  function extractFromQuestionText(questionText, operation) {
    if (operation === 'reconstruct_diprotic_equilibrium' || looksLikeDiproticEquilibrium(questionText)) {
      return extractDiproticEquilibriumFromText(questionText);
    }
    return {};
  }

  function looksLikeDiproticEquilibrium(text) {
    return DIPROTIC_HINT.test(String(text || ''));
  }

  function mergeInput(existing, ...sources) {
    const out = { ...(isPlainObject(existing) ? existing : {}) };
    for (const src of sources) {
      if (!isPlainObject(src)) continue;
      for (const [key, value] of Object.entries(src)) {
        if (value === undefined || value === null || value === '') continue;
        if (out[key] === undefined || out[key] === null || out[key] === '') {
          out[key] = value;
        }
      }
    }
    if (out.concentration !== undefined && out.formalConcentration === undefined) {
      out.formalConcentration = out.concentration;
    }
    if (out.formalConcentration !== undefined && out.concentration === undefined) {
      out.concentration = out.formalConcentration;
    }
    return out;
  }

  function firstPositive(input, keys) {
    for (const key of keys) {
      const n = positiveNumber(input[key]);
      if (n !== null) return n;
    }
    return null;
  }

  function nonnegativeNumber(value) {
    const n = toNumber(value);
    return n !== null && n >= 0 ? n : null;
  }

  function isNonemptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function hasPositiveField(input, key) {
    return positiveNumber(input?.[key]) !== null;
  }

  function hasNonnegativeField(input, key) {
    return nonnegativeNumber(input?.[key]) !== null;
  }

  function hasSpeciesList(value, key = 'species') {
    return isPlainObject(value)
      && Array.isArray(value[key])
      && value[key].length > 0
      && value[key].every((entry) => (
        isPlainObject(entry)
        && isNonemptyString(entry.id)
        && positiveNumber(entry.coefficient) !== null
      ));
  }

  function hasReactionSides(value) {
    return isPlainObject(value)
      && hasSpeciesList(value, 'reactants')
      && hasSpeciesList(value, 'products');
  }

  function isStoichiometryInputSufficient(operation, input) {
    if (!isPlainObject(input) || !Object.keys(input).length) return false;
    if (operation === 'mole_conversion') {
      const mode = String(input.mode || '');
      if (mode === 'mass_to_moles') {
        return hasPositiveField(input, 'mass_g') && hasPositiveField(input, 'molarMass_g_mol');
      }
      if (mode === 'moles_to_mass') {
        return hasPositiveField(input, 'amount_mol') && hasPositiveField(input, 'molarMass_g_mol');
      }
      if (mode === 'particles_to_moles') {
        return hasPositiveField(input, 'particles')
          && (input.avogadroConstant === undefined || hasPositiveField(input, 'avogadroConstant'));
      }
      if (mode === 'moles_to_particles') {
        return hasPositiveField(input, 'amount_mol')
          && (input.avogadroConstant === undefined || hasPositiveField(input, 'avogadroConstant'));
      }
      return false;
    }
    if (operation === 'stoichiometric_ratio') {
      return hasSpeciesList(input.reaction)
        && isPlainObject(input.known)
        && isNonemptyString(input.known.speciesId)
        && hasPositiveField(input.known, 'amount_mol')
        && isNonemptyString(input.targetSpeciesId);
    }
    if (operation === 'limiting_reagent') {
      return hasReactionSides(input.reaction)
        && isPlainObject(input.reactantAmounts_mol)
        && Object.keys(input.reactantAmounts_mol).length > 0
        && Object.values(input.reactantAmounts_mol).every((value) => positiveNumber(value) !== null)
        && isNonemptyString(input.targetProductId)
        && (input.productMolarMass_g_mol === undefined || hasPositiveField(input, 'productMolarMass_g_mol'));
    }
    if (operation === 'theoretical_yield') {
      return isPlainObject(input.limitingReactant)
        && isNonemptyString(input.limitingReactant.id)
        && hasPositiveField(input.limitingReactant, 'coefficient')
        && hasPositiveField(input.limitingReactant, 'amount_mol')
        && isPlainObject(input.product)
        && isNonemptyString(input.product.id)
        && hasPositiveField(input.product, 'coefficient')
        && (input.product.molarMass_g_mol === undefined || hasPositiveField(input.product, 'molarMass_g_mol'));
    }
    if (operation === 'percent_yield') {
      const hasMass = input.actualYield_g !== undefined || input.theoreticalYield_g !== undefined;
      const hasMoles = input.actualYield_mol !== undefined || input.theoreticalYield_mol !== undefined;
      if (hasMass === hasMoles) return false;
      if (hasMass) return hasNonnegativeField(input, 'actualYield_g') && hasPositiveField(input, 'theoreticalYield_g');
      return hasNonnegativeField(input, 'actualYield_mol') && hasPositiveField(input, 'theoreticalYield_mol');
    }
    return null;
  }

  function sanitizeInputForOperation(operation, input) {
    const src = isPlainObject(input) ? { ...input } : {};
    const out = {};

    if (operation === 'reconstruct_diprotic_equilibrium') {
      const formal = firstPositive(src, [
        'formalConcentration', 'concentration', 'C', 'c', 'totalConcentration',
        'formal_concentration', 'acidConcentration'
      ]);
      if (formal !== null) {
        out.formalConcentration = formal;
        out.concentration = formal;
      }

      const ph = toNumber(src.pH ?? src.ph);
      if (ph !== null && ph >= 0) out.pH = ph;

      let alpha = toNumber(src.degreeOfDissociation ?? src.alpha ?? src.firstDissociationAlpha);
      if (alpha !== null) {
        if (alpha > 1 && alpha <= 100) alpha /= 100;
        if (alpha > 0 && alpha <= 1) out.degreeOfDissociation = alpha;
      }

      const ratio = firstPositive(src, [
        'ratioHAtoA2', 'haToA2Ratio', 'speciesRatio', 'HA_to_A2_ratio', 'haToA2'
      ]);
      if (ratio !== null) out.ratioHAtoA2 = ratio;

      if (src.species) out.species = String(src.species);
      return out;
    }

    for (const [key, value] of Object.entries(src)) {
      if (typeof value === 'string') {
        const n = toNumber(value);
        if (n !== null) out[key] = n;
        else out[key] = value;
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function isInputSufficient(operation, input) {
    const sanitized = sanitizeInputForOperation(operation, input);
    if (!isPlainObject(sanitized) || !Object.keys(sanitized).length) return false;
    const stoichiometry = isStoichiometryInputSufficient(operation, sanitized);
    if (stoichiometry !== null) return stoichiometry;
    const required = OPERATION_REQUIRED[operation];
    if (!required) return true;
    return required.every((field) => {
      if (field === 'concentration') {
        return positiveNumber(sanitized.concentration ?? sanitized.formalConcentration) !== null;
      }
      if (field === 'formalConcentration') {
        return positiveNumber(sanitized.formalConcentration ?? sanitized.concentration) !== null;
      }
      if (field === 'degreeOfDissociation') {
        const a = toNumber(sanitized.degreeOfDissociation);
        return a !== null && a > 0 && a <= 1;
      }
      if (field === 'pH') {
        const p = toNumber(sanitized.pH);
        return p !== null && p >= 0;
      }
      return positiveNumber(sanitized[field]) !== null;
    });
  }

  function buildLocalDiproticParse(questionText) {
    if (!looksLikeDiproticEquilibrium(questionText)) return null;
    const input = sanitizeInputForOperation(
      'reconstruct_diprotic_equilibrium',
      extractDiproticEquilibriumFromText(questionText)
    );
    if (!isInputSufficient('reconstruct_diprotic_equilibrium', input)) return null;
    return {
      applicable: true,
      engine: 'acid_base',
      operation: 'reconstruct_diprotic_equilibrium',
      classification: '二質子酸平衡態（本機抽取）',
      input
    };
  }

  function repairParseResult(parseResult, questionText) {
    if (!isPlainObject(parseResult)) return parseResult;

    let operation = String(parseResult.operation || '');
    const blob = JSON.stringify(parseResult);
    const hintText = [questionText, blob, parseResult.classification].filter(Boolean).join('\n');

    if (!operation && looksLikeDiproticEquilibrium(hintText)) {
      operation = 'reconstruct_diprotic_equilibrium';
    }
    if (looksLikeDiproticEquilibrium(hintText) && (
      !operation || operation === 'weak_acid_diprotic' || operation === 'derive_diprotic_constants'
    )) {
      operation = 'reconstruct_diprotic_equilibrium';
    }

    if (parseResult.applicable !== true) {
      const local = buildLocalDiproticParse(hintText);
      if (local) return { ...local, _repair: { source: 'local_diprotic_override' } };
      return parseResult;
    }

    const collected = {};
    collectFromObject(parseResult, collected);
    collectFromText(hintText, collected);
    const fromText = extractFromQuestionText(hintText, operation);
    const mergedInput = sanitizeInputForOperation(
      operation,
      mergeInput(parseResult.input, collected, fromText)
    );

    return {
      ...parseResult,
      operation,
      input: mergedInput,
      _repair: {
        collectedFields: Object.keys(collected),
        textFields: Object.keys(fromText),
        sufficient: isInputSufficient(operation, mergedInput),
        sanitizedInput: mergedInput
      }
    };
  }

  const api = Object.freeze({
    INPUT_FIELD_ALIASES,
    OPERATION_REQUIRED,
    toNumber,
    positiveNumber,
    collectFromObject,
    collectFromText,
    extractDiproticEquilibriumFromText,
    extractFromQuestionText,
    looksLikeDiproticEquilibrium,
    mergeInput,
    sanitizeInputForOperation,
    isInputSufficient,
    buildLocalDiproticParse,
    repairParseResult
  });

  global.EngineParseRepair = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
