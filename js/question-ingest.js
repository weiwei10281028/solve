/**
 * 題目擷取：圖片只讀一次，產出 questionText + structured 供後續流程共用。
 */
(function (global) {
  'use strict';

  const INGEST_SYSTEM = `你是化學題目擷取器。只回傳 JSON，不寫詳解，不計算答案。
任務：從題目（含圖片）完整擷取題幹、選項與所有可見數值。
questionText：完整繁體中文題目文字（含選項標籤與敘述）。
structured：題目出現的數值欄位；讀不到填 null，不可猜測。
分數解離度請換算為 0~1 小數；濃度單位換算為 mol/L 的數值。
只填題目有寫的欄位，其餘 null。`;

  const INGEST_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['questionText', 'structured'],
    properties: {
      questionText: { type: 'string' },
      structured: {
        type: 'object',
        additionalProperties: true,
        properties: {
          formalConcentration: { type: 'number' },
          concentration: { type: 'number' },
          pH: { type: 'number' },
          degreeOfDissociation: { type: 'number' },
          ratioHAtoA2: { type: 'number' },
          Ka: { type: 'number' },
          Ka1: { type: 'number' },
          Ka2: { type: 'number' },
          Kb: { type: 'number' },
          K: { type: 'number' },
          volumeL: { type: 'number' }
        }
      },
      choices: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  };

  function parseJson(raw) {
    try {
      const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function cleanStructured(structured) {
    if (!structured || typeof structured !== 'object' || Array.isArray(structured)) return {};
    const out = {};
    for (const [key, value] of Object.entries(structured)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
      else if (typeof value === 'string' && value.trim()) {
        if (global.EngineParseRepair) {
          const n = global.EngineParseRepair.toNumber(value);
          if (n !== null) out[key] = n;
        }
      }
    }
    return out;
  }

  function mergeStructured(primary, secondary) {
    const out = { ...(secondary || {}) };
    for (const [key, value] of Object.entries(primary || {})) {
      if (value !== undefined && value !== null) out[key] = value;
    }
    return out;
  }

  function buildFromTextOnly(supplement) {
    const questionText = String(supplement || '').trim();
    let structured = {};
    if (questionText && global.EngineParseRepair) {
      structured = global.EngineParseRepair.extractDiproticEquilibriumFromText(questionText);
    }
    return {
      ok: !!questionText,
      questionText,
      structured,
      choices: [],
      source: 'text_only'
    };
  }

  async function ingest(cfg, options) {
    const supplement = String(options?.supplement || '').trim();
    const imgDataURLs = options?.imgDataURLs || [];
    const hasImage = imgDataURLs.length > 0;

    if (!hasImage) return buildFromTextOnly(supplement);

    const userText = [
      supplement ? `【使用者補充】\n${supplement}` : '',
      '請完整擷取圖片中的題目文字與所有數值。'
    ].filter(Boolean).join('\n\n');

    const messages = [{
      role: 'user',
      content: [
        ...imgDataURLs.map((item) => ({
          type: 'image_url',
          image_url: { url: item.dataUrl, detail: 'high' }
        })),
        { type: 'text', text: userText }
      ]
    }];

    try {
      const res = await callAPI(cfg, messages, INGEST_SYSTEM, {
        temperature: 0,
        maxOutputTokens: 2048,
        timeoutMs: 90000,
        maxContinue: 0,
        tokenStage: 'question_ingest',
        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: INGEST_SCHEMA } }
      });
      const parsed = parseJson(res.text);
      if (!parsed || !String(parsed.questionText || '').trim()) {
        return { ok: false, questionText: supplement, structured: {}, choices: [], source: 'ingest_failed' };
      }

      let structured = cleanStructured(parsed.structured);
      const local = global.EngineParseRepair
        ? global.EngineParseRepair.extractDiproticEquilibriumFromText([parsed.questionText, supplement].join('\n'))
        : {};
      structured = mergeStructured(structured, local);

      const questionText = [String(parsed.questionText).trim(), supplement].filter(Boolean).join('\n\n');
      return {
        ok: true,
        questionText,
        structured,
        choices: Array.isArray(parsed.choices) ? parsed.choices : [],
        source: 'image_ingest',
        raw: res.text
      };
    } catch (err) {
      return {
        ok: false,
        questionText: supplement,
        structured: {},
        choices: [],
        source: 'ingest_error',
        error: err
      };
    }
  }

  function buildStructuredBlock(ingested) {
    if (!ingested?.structured || !Object.keys(ingested.structured).length) return '';
    return ['【已擷取結構化數值】', JSON.stringify(ingested.structured, null, 2)].join('\n');
  }

  const api = Object.freeze({
    INGEST_SYSTEM,
    INGEST_SCHEMA,
    ingest,
    buildStructuredBlock,
    cleanStructured,
    mergeStructured
  });

  global.QuestionIngest = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
