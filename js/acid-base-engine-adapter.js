/**
 * 網站端 Adapter：第一次 AI 解析 JSON → 引擎標準 JSON → solveChemistry() → 標準結果。
 * 不直接引用 engines/acid-base/solvers/ 內部檔案。
 */
(function (global) {
  'use strict';

  const ENGINE_ID = 'acid_base';
  const OPERATIONS = new Set([
    'strong_acid_base',
    'weak_acid',
    'weak_base',
    'weak_acid_diprotic',
    'reconstruct_diprotic_equilibrium',
    'derive_diprotic_constants',
    'neutralization',
    'titration',
    'buffer'
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

  /** 容錯：支援 input 缺漏、JSON 字串、或參數誤放在頂層。 */
  function normalizeInput(data, operation, questionText) {
    const candidates = [
      data.input,
      data.parameters,
      data.params
    ];

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

    if (global.EngineParseRepair) {
      const collected = {};
      global.EngineParseRepair.collectFromObject(data, collected);
      const fromText = global.EngineParseRepair.extractFromQuestionText(
        [questionText, JSON.stringify(data)].filter(Boolean).join('\n'),
        operation
      );
      input = global.EngineParseRepair.mergeInput(input, collected, fromText);
      input = global.EngineParseRepair.sanitizeInputForOperation(operation, input);
    }

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

  /** 將第一次 AI 的解析結果轉成引擎標準請求。 */
  function toEngineRequest(parseJson, questionText) {
    const source = global.EngineParseRepair
      ? global.EngineParseRepair.repairParseResult(parseJson, questionText)
      : parseJson;
    const parsed = asObject(source, 'parse');
    if (!parsed.ok) return parsed;

    const data = parsed.value;
    if (data.applicable === false) {
      return fail('NOT_APPLICABLE', String(data.unsupportedReason || data.reason || '此題不適用酸鹼計算引擎'));
    }

    const engine = String(data.engine || ENGINE_ID);
    if (engine !== ENGINE_ID) {
      return fail('UNSUPPORTED_ENGINE', `不支援 engine: ${engine}`, 'engine');
    }

    const operation = String(data.operation || '');
    if (!OPERATIONS.has(operation)) {
      return fail('UNSUPPORTED_OPERATION', `不支援 operation: ${operation || '(空)'}`, 'operation');
    }

    const inputObj = normalizeInput(data, String(data.operation || ''), questionText);
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

  /** 解析 JSON → 呼叫引擎 → 回傳完整結果或錯誤。 */
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

  /** 測試／Node 環境可直接傳引擎標準 JSON。 */
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

  global.AcidBaseEngineAdapter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
