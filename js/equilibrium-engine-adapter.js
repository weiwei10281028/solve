/**
 * 平衡引擎網站端 Adapter：第一次 AI 解析 JSON → solveChemistry() → 標準結果。
 */
(function (global) {
  'use strict';

  const ENGINE_ID = 'equilibrium';
  const OPERATIONS = new Set([
    'dilution_effect',
    'reaction_quotient_direction',
    'le_chatelier_disturbance'
  ]);

  function fail(code, message, field) {
    return { ok: false, error: { code, message, field: field || undefined } };
  }

  function asObject(value, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: `${field} 必須是物件`, field } };
    }
    return { ok: true, value };
  }

  const RESERVED_TOP_LEVEL_KEYS = new Set([
    'applicable',
    'engine',
    'operation',
    'options',
    'classification',
    'missingFields',
    'unsupportedReason',
    'reason',
    'input',
    'parameters',
    'params'
  ]);

  function tryParseJsonObject(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function hoistTopLevelParams(data) {
    const hoisted = {};
    for (const [key, value] of Object.entries(data)) {
      if (!RESERVED_TOP_LEVEL_KEYS.has(key) && value !== undefined) {
        hoisted[key] = value;
      }
    }
    return hoisted;
  }

  function normalizeInput(data, operation, questionText) {
    const candidates = [data.input, data.parameters, data.params];
    let input = null;
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        input = { ...candidate };
        break;
      }
      const parsed = tryParseJsonObject(candidate);
      if (parsed) {
        input = parsed;
        break;
      }
    }

    const hoisted = hoistTopLevelParams(data);
    if (!input) input = {};
    input = { ...hoisted, ...input };

    if (!Object.keys(input).length) {
      return fail(
        'INVALID_INPUT',
        'applicable=true 時必須提供 input 物件（計算參數不可省略）',
        'input'
      );
    }

    return { ok: true, value: input };
  }

  function normalizeOptions(options) {
    const src = options && typeof options === 'object' ? options : {};
    const out = {};
    if (src.temperatureC !== undefined) out.temperatureC = Number(src.temperatureC);
    if (src.approximationThreshold !== undefined) out.approximationThreshold = Number(src.approximationThreshold);
    if (src.returnAllIntermediates !== undefined) out.returnAllIntermediates = !!src.returnAllIntermediates;
    return Object.keys(out).length ? out : undefined;
  }

  function toEngineRequest(parseJson, questionText) {
    const parsed = asObject(parseJson, 'parse');
    if (!parsed.ok) return parsed;

    const data = parsed.value;
    if (data.applicable === false) {
      return fail('NOT_APPLICABLE', String(data.unsupportedReason || data.reason || '此題不適用平衡計算引擎'));
    }

    const engine = String(data.engine || ENGINE_ID);
    if (engine !== ENGINE_ID) {
      return fail('UNSUPPORTED_ENGINE', `不支援 engine: ${engine}`, 'engine');
    }

    const operation = String(data.operation || '');
    if (!OPERATIONS.has(operation)) {
      return fail('UNSUPPORTED_OPERATION', `不支援 operation: ${operation || '(空)'}`, 'operation');
    }

    const inputObj = normalizeInput(data, operation, questionText);
    if (!inputObj.ok) return inputObj;

    const request = {
      engine: ENGINE_ID,
      operation,
      input: inputObj.value
    };
    const options = normalizeOptions(data.options);
    if (options) request.options = options;
    return { ok: true, request };
  }

  function getSolver() {
    return global.ChemistryEngine && typeof global.ChemistryEngine.solveChemistry === 'function'
      ? global.ChemistryEngine.solveChemistry
      : null;
  }

  function run(parseJson, runContext) {
    const questionText = runContext && runContext.questionText;
    const mapped = toEngineRequest(parseJson, questionText);
    if (!mapped.ok) return mapped;

    const solveChemistry = getSolver();
    if (!solveChemistry) {
      return fail('ENGINE_NOT_LOADED', 'chemistry-solving-engine 尚未載入');
    }

    const engineResponse = solveChemistry(mapped.request);
    if (!engineResponse || engineResponse.success !== true) {
      return {
        ok: false,
        request: mapped.request,
        engineResponse: engineResponse || null,
        error: (engineResponse && engineResponse.error) || { code: 'ENGINE_FAILURE', message: '引擎計算失敗' }
      };
    }

    return {
      ok: true,
      request: mapped.request,
      engineResponse
    };
  }

  function runRequest(request) {
    const solveChemistry = getSolver();
    if (!solveChemistry) {
      return fail('ENGINE_NOT_LOADED', 'chemistry-solving-engine 尚未載入');
    }
    const engineResponse = solveChemistry(request);
    if (!engineResponse || engineResponse.success !== true) {
      return {
        ok: false,
        request,
        engineResponse: engineResponse || null,
        error: (engineResponse && engineResponse.error) || { code: 'ENGINE_FAILURE', message: '引擎計算失敗' }
      };
    }
    return { ok: true, request, engineResponse };
  }

  const api = Object.freeze({
    ENGINE_ID,
    OPERATIONS,
    RESERVED_TOP_LEVEL_KEYS,
    normalizeInput,
    toEngineRequest,
    run,
    runRequest
  });

  global.EquilibriumEngineAdapter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
