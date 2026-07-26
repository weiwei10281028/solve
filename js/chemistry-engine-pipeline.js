/**
 * 化學計算引擎管線：路由 AI → 抽數 → 引擎計算 → 詳解 AI
 */
(function (global) {
  'use strict';

  const PARSE_SYSTEM = `你是化學計算引擎路由器。只回傳 JSON，不寫學生詳解，不完成最終答案計算。

【任務】
依題目與【可用引擎目錄】決定是否呼叫計算引擎，並列出需執行的任務（可 0 個或多個）。

【輸出格式】
{
  "useEngine": true,
  "tasks": [
    { "engine": "<目錄中的 id>", "operation": "<目錄中的 operation>", "input": {}, "purpose": "一句說明此任務算什麼" }
  ],
  "classification": "一句內部題型",
  "skipReason": ""
}

【規則】
- useEngine=true：題目可由目錄中任一 engine+operation 處理（含驗證選項、多選）
- useEngine=false：僅當題目與目錄中全部引擎皆明顯無關，或完全無可結構化計算線索
- 不可因「多選」「圖片難讀」「input 尚未齊」設 useEngine=false
- 路由階段 input 可為 {}；缺欄位由後續抽取階段補
- 一題若需不同類型計算，tasks 可有多筆
- 濃度 mol/L、體積 L；分數轉小數；不猜題目未給的常數
- 題目只要涉及化學量化計算（質量、莫耳、莫耳質量、粒子數、沉澱或氣體產量、反應係數比、產率），即使不是酸鹼或平衡，也優先嘗試 stoichiometry；不要只因題型是綜合題就略過引擎
- 只使用【可用引擎目錄】內的 engine 與 operation，不可自創`;

  const REPAIR_PARSE_SUFFIX = `【補充｜重試解析】
你上一輪雖判定 useEngine=true，但 tasks 的 input 仍不足。
請重新閱讀題目（含圖片），依【可用引擎目錄】中各 operation 的 input 欄位填入數值。
維持 useEngine=true 與相同 tasks 結構（可調整 purpose）；不可改為 useEngine=false。
分數請換算為小數；數值欄位用 number。`;

  const PARSE_SCHEMA = {
    type: 'object',
    additionalProperties: true,
    required: ['useEngine'],
    properties: {
      useEngine: { type: 'boolean' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          required: ['engine', 'operation'],
          properties: {
            engine: { type: 'string' },
            operation: { type: 'string' },
            input: { type: 'object', additionalProperties: true },
            purpose: { type: 'string' }
          }
        }
      },
      classification: { type: 'string' },
      skipReason: { type: 'string' }
    },
    allOf: [
      {
        if: { properties: { useEngine: { const: true } }, required: ['useEngine'] },
        then: { required: ['tasks'], properties: { tasks: { minItems: 1 } } }
      }
    ]
  };

  const EXPLAIN_ENGINE_RULES = `【計算引擎詳解規則｜必須遵守】
- 詳解中每一個濃度、pH、pKa、Ka 數值必須與引擎 result／intermediates 完全一致，禁止自行重算或改寫
- 不向學生顯示 JSON、engine、operation、trace 等系統用語
- 若有多個任務，依各 purpose 分別用於推導與選項判斷
- 引擎 result／intermediates 中用於判斷答案的數值，須寫成學生看得懂的代入式或關鍵中間量
- 若引擎結果與題目明顯矛盾，在「依據與推導」標記需重新檢查
- 仍只回傳指定 SolutionCore JSON（blocks + answer）`;

  function catalogReady() {
    return typeof global.EngineCatalog !== 'undefined';
  }

  function engineReady() {
    return !!(
      global.ChemistryEngine
      && catalogReady()
      && global.AcidBaseEngineAdapter
      && global.EquilibriumEngineAdapter
      && global.StoichiometryEngineAdapter
    );
  }

  function getEngineAdapter(engineId) {
    return catalogReady() ? global.EngineCatalog.getAdapter(engineId) : null;
  }

  function normalizeRouter(raw) {
    if (!catalogReady()) return { useEngine: false, tasks: [], classification: '', skipReason: 'catalog_not_loaded' };
    return global.EngineCatalog.normalizeRouterResult(raw);
  }

  function runEngineTask(task, runContext) {
    const adapter = getEngineAdapter(task.engine);
    if (!adapter) {
      return {
        ok: false,
        task,
        error: { code: 'UNSUPPORTED_ENGINE', message: `不支援 engine: ${task.engine}` }
      };
    }
    const legacy = global.EngineCatalog.taskToLegacyParse(task, { classification: task.purpose });
    const result = adapter.run(legacy, runContext);
    return { ...result, task };
  }

  function buildExplainSystem() {
    if (typeof global.SolutionCore === 'undefined' || typeof global.SolutionCore.buildSystem !== 'function') {
      throw new Error('SolutionCore 未載入');
    }
    return global.SolutionCore.buildSystem() + EXPLAIN_ENGINE_RULES;
  }

  function parseFirstAi(raw) {
    try {
      const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function buildParseUserText(context) {
    const parts = [];
    if (catalogReady()) {
      parts.push(global.EngineCatalog.buildPrejudgmentBlock(context));
      parts.push('');
      parts.push(global.EngineCatalog.buildCatalogBlock());
      parts.push('');
    }
    if (typeof global.QuestionIngest !== 'undefined' && context?.ingested) {
      const structuredBlock = global.QuestionIngest.buildStructuredBlock(context.ingested);
      if (structuredBlock) {
        parts.push(structuredBlock);
        parts.push('');
      }
    }
    parts.push(
      '【題目】',
      String(context?.questionSource || '').trim(),
      '',
      '請依引擎目錄輸出嚴格 JSON（useEngine + tasks）。'
    );
    return parts.join('\n');
  }

  function buildExplainUserText(questionText, routerResult, engineBundle) {
    return [
      '【題目】',
      String(questionText || '').trim(),
      '',
      '【路由結果】',
      JSON.stringify(routerResult, null, 2),
      '',
      '【計算引擎完整輸出】',
      JSON.stringify(engineBundle, null, 2),
      '',
      '請依上述引擎結果撰寫繁體中文高中化學詳解；數值必須與引擎一致，且關鍵中間量須出現在依據與推導。'
    ].join('\n');
  }

  function buildMessages(textOnly, userText, imageItems) {
    if (textOnly) return [{ role: 'user', content: userText }];
    return [{
      role: 'user',
      content: [
        ...(imageItems || []).map((item) => ({
          type: 'image_url',
          image_url: { url: item.dataUrl, detail: 'high' }
        })),
        { type: 'text', text: userText }
      ]
    }];
  }

  async function callParseAi(cfg, context, extraSystemSuffix) {
    const systemText = extraSystemSuffix ? (PARSE_SYSTEM + extraSystemSuffix) : PARSE_SYSTEM;
    const messages = buildMessages(context.textOnly, buildParseUserText(context), context.imgDataURLs);
    const res = await callAPI(cfg, messages, systemText, {
      temperature: 0,
      maxOutputTokens: 2048,
      timeoutMs: 90000,
      maxContinue: 0,
      tokenStage: 'engine_route',
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: PARSE_SCHEMA } }
    });
    const parsed = parseFirstAi(res.text);
    return { raw: res.text, parsed, parseFailed: !parsed };
  }

  function getRepairQuestionText(context) {
    return [
      context && context.ingested && context.ingested.questionText,
      context && context.questionSource,
      context && context.fullUserText,
      context && context.assembled && context.assembled.questionBody
    ].filter((part) => String(part || '').trim()).join('\n');
  }

  function mergeIngestedInput(task, context) {
    const structured = context?.ingested?.structured;
    if (!structured || typeof structured !== 'object') return task;
    return {
      ...task,
      input: {
        ...(task.input || {}),
        ...structured
      }
    };
  }

  function repairLegacyParse(legacy, questionText) {
    if (typeof global.EngineParseRepair === 'undefined') return legacy;
    return global.EngineParseRepair.repairParseResult(legacy, questionText);
  }

  function taskInputReady(task, questionText) {
    const legacy = repairLegacyParse(global.EngineCatalog.taskToLegacyParse(task), questionText);
    if (typeof global.EngineParseRepair === 'undefined') {
      return !!(legacy.input && Object.keys(legacy.input).length);
    }
    return global.EngineParseRepair.isInputSufficient(String(legacy.operation || ''), legacy.input);
  }

  function localStoichiometryTasks(questionText) {
    const text = String(questionText || '').replace(/\s+/g, ' ');
    if (!looksLikeStoichiometryCalculation(text)) return [];

    const molarMasses = [...text.matchAll(/(?:莫耳質量|分子量|式量|molar\s*mass)\s*(?:為|是|=|：|:)?\s*(\d+(?:\.\d+)?)\s*g\s*\/\s*mol/gi)]
      .map((match) => ({ value: Number(match[1]), index: match.index || 0 }))
      .filter((item) => item.value > 0);
    if (!molarMasses.length) return [];

    const masses = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:g|克)(?:\s*(?:沉澱|樣品|粉末|固體|產物))?/gi)]
      .map((match) => {
        const local = text.slice(match.index || 0, (match.index || 0) + match[0].length + 12);
        return {
          value: Number(match[1]),
          index: match.index || 0,
          priority: /沉澱|產物|氣體/.test(local) ? 2 : (/樣品|粉末|固體/.test(local) ? 1 : 0)
        };
      })
      .filter((item) => item.value > 0);
    if (!masses.length) return [];

    const molarMass = molarMasses[0].value;
    const mass = [...masses].sort((a, b) => b.priority - a.priority || Math.abs(a.index - molarMasses[0].index) - Math.abs(b.index - molarMasses[0].index))[0].value;

    return [{
      engine: 'stoichiometry',
      operation: 'mole_conversion',
      input: {
        mode: 'mass_to_moles',
        mass_g: mass,
        molarMass_g_mol: molarMass
      },
      purpose: '由題目中的質量與莫耳質量換算莫耳數'
    }];
  }

  function mergeTaskFromLegacy(task, legacy) {
    return {
      ...task,
      engine: String(legacy.engine || task.engine),
      operation: String(legacy.operation || task.operation),
      input: legacy.input && typeof legacy.input === 'object' ? legacy.input : (task.input || {})
    };
  }

  async function callExtractAi(cfg, context, operation) {
    const profile = global.EngineCatalog.getExtractProfile(operation);
    if (!profile) return { parsed: null, parseFailed: true };
    const structuredBlock = typeof global.QuestionIngest !== 'undefined'
      ? global.QuestionIngest.buildStructuredBlock(context?.ingested)
      : '';
    const userText = [
      '【題目】',
      getRepairQuestionText(context) || '（請從已擷取題目讀取數值）',
      structuredBlock ? `\n${structuredBlock}` : '',
      '',
      profile.userSuffix || '請輸出指定欄位的 JSON。'
    ].join('\n');
    const messages = buildMessages(true, userText, context.imgDataURLs);
    const res = await callAPI(cfg, messages, profile.system, {
      temperature: 0,
      maxOutputTokens: 512,
      timeoutMs: 90000,
      maxContinue: 0,
      tokenStage: 'engine_extract',
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: profile.schema } }
    });
    const parsed = parseFirstAi(res.text);
    if (!parsed || typeof global.EngineParseRepair === 'undefined') {
      return { raw: res.text, parsed: null, parseFailed: true };
    }
    const input = global.EngineParseRepair.sanitizeInputForOperation(operation, parsed);
    const sufficient = global.EngineParseRepair.isInputSufficient(operation, input);
    return { raw: res.text, parsed: sufficient ? input : null, parseFailed: !sufficient };
  }

  async function ensureTaskInput(cfg, context, task) {
    const questionText = getRepairQuestionText(context);
    const seeded = mergeIngestedInput(task, context);
    let current = mergeTaskFromLegacy(
      seeded,
      repairLegacyParse(global.EngineCatalog.taskToLegacyParse(seeded), questionText)
    );
    if (taskInputReady(current, questionText)) return current;

    const profile = global.EngineCatalog.getExtractProfile(current.operation);
    if (profile) {
      console.warn('引擎管線：task input 不足，啟動數值抽取', current.operation, current.input);
      const extractStage = await callExtractAi(cfg, context, current.operation);
      if (!extractStage.parseFailed && extractStage.parsed) {
        const legacy = repairLegacyParse({
          applicable: true,
          engine: current.engine,
          operation: current.operation,
          input: extractStage.parsed
        }, questionText);
        return mergeTaskFromLegacy(current, legacy);
      }
    }

    return current;
  }

  async function ensureRouterTasks(cfg, context, routerResult) {
    const questionText = getRepairQuestionText(context);
    const tasks = [];
    for (const task of routerResult.tasks) {
      let current = await ensureTaskInput(cfg, context, task);
      if (!taskInputReady(current, questionText)) {
        const localTasks = current.engine === 'stoichiometry' ? localStoichiometryTasks(questionText) : [];
        const localMatch = localTasks.find((item) => item.operation === current.operation) || localTasks[0];
        if (localMatch) {
          current = await ensureTaskInput(cfg, context, { ...current, ...localMatch });
        }
      }
      if (!taskInputReady(current, questionText)) {
        console.warn('引擎管線：task input 仍不足，嘗試路由重試', current);
        const repairStage = await callParseAi(cfg, context, REPAIR_PARSE_SUFFIX);
        if (!repairStage.parseFailed && repairStage.parsed) {
          const repairedRouter = normalizeRouter(repairStage.parsed);
          const matched = repairedRouter.tasks.find((t) => t.engine === task.engine && t.operation === task.operation);
          if (matched) current = await ensureTaskInput(cfg, context, matched);
        }
        if (profileRetryable(current.operation)) {
          const retryExtract = await callExtractAi(cfg, context, current.operation);
          if (!retryExtract.parseFailed && retryExtract.parsed) {
            const legacy = repairLegacyParse({
              applicable: true,
              engine: current.engine,
              operation: current.operation,
              input: retryExtract.parsed
            }, questionText);
            current = mergeTaskFromLegacy(current, legacy);
          }
        }
        if (!taskInputReady(current, questionText) && current.engine === 'stoichiometry') {
          const localTasks = localStoichiometryTasks(questionText);
          const localMatch = localTasks.find((item) => item.operation === current.operation) || localTasks[0];
          if (localMatch) current = await ensureTaskInput(cfg, context, { ...current, ...localMatch });
        }
      }
      tasks.push(current);
    }
    return { ...routerResult, tasks };
  }

  function profileRetryable(operation) {
    return !!(catalogReady() && global.EngineCatalog.getExtractProfile(operation));
  }

  function looksLikeStoichiometryCalculation(text) {
    const source = String(text || '');
    const hasChemicalQuantity = /\d+(?:\.\d+)?\s*(?:g|克|mol|莫耳|mole|分子|粒子)|(?:莫耳質量|分子量|式量|molar\s*mass)|(?:沉澱|氣體|產量|產率)|(?:反應式|係數|莫耳比)|(?:完全反應|過量|限量)/i.test(source);
    const hasChemistrySignal = /[A-Z][a-z]?\d*|化學|反應|樣品|化合物|氧化物|碳酸鈣|澄清石灰水|CO2|CaCO3/i.test(source);
    return hasChemicalQuantity && hasChemistrySignal;
  }

  function buildFallbackRouter(context, questionText) {
    if (typeof global.EngineParseRepair !== 'undefined') {
      const local = global.EngineParseRepair.buildLocalDiproticParse(questionText);
      if (local) return normalizeRouter(local);
      if (global.EngineParseRepair.looksLikeDiproticEquilibrium(questionText)) {
        return {
          useEngine: true,
          tasks: [{
            engine: 'acid_base',
            operation: 'reconstruct_diprotic_equilibrium',
            input: {},
            purpose: '雙質子酸平衡態（後備路由）'
          }],
          classification: '雙質子酸平衡態（後備路由）',
          skipReason: ''
        };
      }
    }
    const spec = context?.solveSpec;
    const hint = questionText;
    const chapterHit = spec?.autoCandidates?.length
      || spec?.chapters?.some((ch) => ch.applicability === 'applicable');
    if (chapterHit && typeof global.EngineParseRepair !== 'undefined'
      && global.EngineParseRepair.looksLikeDiproticEquilibrium(hint)) {
      return {
        useEngine: true,
        tasks: [{
          engine: 'acid_base',
          operation: 'reconstruct_diprotic_equilibrium',
          input: {},
          purpose: '章節預判＋題幹線索（後備路由）'
        }],
        classification: '後備路由',
        skipReason: ''
      };
    }
    if (catalogReady() && global.EngineCatalog.isKnownTask('stoichiometry', 'mole_conversion')
      && looksLikeStoichiometryCalculation(hint)) {
      const tasks = localStoichiometryTasks(hint);
      return {
        useEngine: true,
        tasks: tasks.length ? tasks : [{
          engine: 'stoichiometry',
          operation: 'mole_conversion',
          input: {},
          purpose: '化學量化計算（後備路由，請依題目改成合適 stoichiometry operation）'
        }],
        classification: '化學量化計算（後備路由）',
        skipReason: ''
      };
    }
    return null;
  }

  function shouldOverrideSkip(routerResult, context, questionText) {
    if (routerResult.useEngine) return routerResult;
    const fallback = buildFallbackRouter(context, questionText);
    return fallback || routerResult;
  }

  async function runEngineTasks(tasks, runContext) {
    const engineRuns = [];
    for (const task of tasks) {
      const run = runEngineTask(task, runContext);
      engineRuns.push(run);
      if (!run.ok) {
        return { ok: false, engineRuns, failedTask: task, error: run.error };
      }
    }
    return { ok: true, engineRuns };
  }

  function buildEngineBundle(engineRuns) {
    return {
      tasks: engineRuns.map((run) => ({
        request: run.request,
        response: run.engineResponse,
        purpose: run.task?.purpose || ''
      }))
    };
  }

  async function callExplainAi(cfg, context, routerResult, engineBundle, responseSchema) {
    const userText = buildExplainUserText(context.questionSource, routerResult, engineBundle);
    const messages = buildMessages(context.textOnly, userText, context.imgDataURLs);
    const res = await callAPI(cfg, messages, buildExplainSystem(), {
      temperature: 0.25,
      maxOutputTokens: 8192,
      timeoutMs: 120000,
      maxContinue: 1,
      tokenStage: 'engine_explain',
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: responseSchema } }
    });
    const prepared = global.SolutionCore.prepare(res.text);
    return { raw: res.text, prepared, truncated: res.truncated };
  }

  async function completePipeline(cfg, context, routerResult) {
    const repairQuestionText = getRepairQuestionText(context);
    const readyRouter = await ensureRouterTasks(cfg, context, routerResult);
    const runnableTasks = [];
    for (const task of readyRouter.tasks) {
      if (!global.EngineCatalog.isKnownTask(task.engine, task.operation)) {
        return {
          usedEngine: false,
          stage: 'parse',
          reason: `unknown_task:${task.engine}/${task.operation}`,
          routerResult: readyRouter
        };
      }
      if (!taskInputReady(task, repairQuestionText)) {
        return {
          usedEngine: false,
          stage: 'parse',
          reason: 'input_insufficient',
          routerResult: readyRouter,
          task
        };
      }
      runnableTasks.push(task);
    }

    const batch = await runEngineTasks(runnableTasks, { questionText: repairQuestionText });
    if (!batch.ok) {
      console.warn('引擎管線：計算失敗', batch.error, batch.failedTask);
      return {
        usedEngine: false,
        stage: 'engine',
        reason: batch.error?.message || 'engine_failed',
        routerResult: readyRouter,
        engineRuns: batch.engineRuns
      };
    }

    const engineBundle = buildEngineBundle(batch.engineRuns);
    const explainStage = await callExplainAi(cfg, context, readyRouter, engineBundle, context.responseSchema);
    if (!explainStage.prepared?.ok) {
      return {
        usedEngine: false,
        stage: 'explain',
        reason: 'explain_failed',
        routerResult: readyRouter,
        engineRuns: batch.engineRuns,
        explainStage
      };
    }

    return {
      usedEngine: true,
      stage: 'complete',
      routerResult: readyRouter,
      engineRuns: batch.engineRuns,
      engineRun: batch.engineRuns[0],
      engineBundle,
      prepared: explainStage.prepared,
      reply: explainStage.prepared.text,
      truncated: explainStage.truncated,
      parseResult: global.EngineCatalog.taskToLegacyParse(runnableTasks[0], readyRouter)
    };
  }

  async function tryRun(cfg, context) {
    if (!engineReady()) {
      return { usedEngine: false, stage: 'loader', reason: 'engine_not_loaded' };
    }

    const repairQuestionText = getRepairQuestionText(context);

    const localFallback = buildFallbackRouter(context, repairQuestionText);
    if (localFallback?.useEngine) {
      const localComplete = await completePipeline(cfg, context, localFallback);
      if (localComplete.usedEngine) return localComplete;
    }

    const parseStage = await callParseAi(cfg, context);
    let routerResult;
    if (parseStage.parseFailed || !parseStage.parsed) {
      console.warn('引擎管線：路由 AI 解析失敗，嘗試後備路由');
      routerResult = buildFallbackRouter(context, repairQuestionText);
      if (!routerResult?.useEngine) {
        return { usedEngine: false, stage: 'parse', reason: 'parse_failed', parseStage };
      }
    } else {
      routerResult = shouldOverrideSkip(normalizeRouter(parseStage.parsed), context, repairQuestionText);
    }

    if (!routerResult.useEngine) {
      return {
        usedEngine: false,
        stage: 'parse',
        reason: routerResult.skipReason || 'not_applicable',
        routerResult,
        parseStage
      };
    }

    return completePipeline(cfg, context, routerResult);
  }

  global.ChemistryEnginePipeline = Object.freeze({
    PARSE_SYSTEM,
    PARSE_SCHEMA,
    EXPLAIN_ENGINE_RULES,
    engineReady,
    buildExplainSystem,
    buildParseUserText,
    buildExplainUserText,
    getRepairQuestionText,
    normalizeRouter,
    tryRun
  });
})(typeof window !== 'undefined' ? window : globalThis);
