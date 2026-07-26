function parseDataURL(url) {
  const [h, data] = url.split(',');
  return { mime: h.match(/data:([^;]+)/)[1], data };
}

function formatError(msg) {
  if (/OpenAI/i.test(msg) && /401|invalid|authentication|api key|unauthorized/i.test(msg)) {
    return 'OpenAI API Key 驗證失敗。\n\n請到「API 設定」選 OpenAI GPT，貼上 OpenAI Platform 的 API Key 後儲存。';
  }
  if (/insufficient_quota|billing|quota/i.test(msg) && /OpenAI/i.test(msg)) {
    return 'OpenAI 額度或付款設定不足。\n\n請到 OpenAI Platform 檢查 billing、usage limit 或 API key 權限。';
  }
  if (/rate.?limit|429/i.test(msg) && /OpenAI/i.test(msg)) return 'OpenAI 目前請求過多或達到速率限制，請稍後再試。';
  if (/Gemini 沒有回傳文字/i.test(msg)) {
    return `${msg}\n\n請檢查圖片清晰度，或改用清單中的其他免費 Flash 後再試。`;
  }
  if (/Failed to fetch|Load failed|NetworkError/i.test(msg)) {
    return '無法直接連到 Google Gemini API。\n\n請確認目前網路可連線，並重新整理後再試。';
  }
  if (/invalid authentication credentials|expected oauth|login cookie|authentication credential|api key not valid|API_KEY_INVALID|PERMISSION_DENIED|forbidden|unauthorized/i.test(msg)) {
    return 'API Key 驗證失敗。\n\n請到「API 設定」重新貼上 Gemini API Key 後儲存。';
  }
  if (/high demand|spikes in demand|try again later/i.test(msg)) return 'Gemini 目前請求過多，請稍後再試。';
  if (/no longer available to new users|no longer available/i.test(msg)) {
    return '此 Gemini 模型對新 API 金鑰不可用。\n\n請在「模型」選 Gemini 3.5 Flash 或 Gemini 3.5 Flash Lite，儲存後再試。';
  }
  if (/not found|not supported for generateContent/i.test(msg)) return '此 Gemini 模型目前不可用。請確認模型 ID。';
  if (/decommissioned|model_decommissioned/i.test(msg)) return '此 Gemini 模型已被官方下架或更名。請確認最新模型 ID。';
  if (/quota|rate.?limit|exceeded|limit:\s*0/i.test(msg)) return 'Gemini 額度已用完，請更換 API Key 或等待額度恢復。';
  return msg;
}

function normalizeReturnedText(text) {
  let value = String(text || '').trim();
  // API JSON.parse 會把 \times 吃成 tab+imes；此處 text 是詳解 JSON 原文，要寫回 \\times
  if (typeof window !== 'undefined' && window.SolutionCore && typeof window.SolutionCore.restoreEatenLatexInJsonSource === 'function') {
    value = window.SolutionCore.restoreEatenLatexInJsonSource(value);
  } else {
    value = value
      .replace(/\u0009imes/gi, '\\\\times')
      .replace(/([A-Za-z0-9}\\]])imes(?=\\s*(?:\\d|10\\b|\\\\))/gi, '$1\\\\times');
  }
  return value;
}

function parseGeminiUsageMetadata(data) {
  const usage = data?.usageMetadata;
  if (!usage || typeof usage !== 'object') return null;
  const promptTokens = Number(usage.promptTokenCount);
  const completionTokens = Number(usage.candidatesTokenCount);
  const totalTokens = Number(usage.totalTokenCount);
  if (!Number.isFinite(promptTokens) && !Number.isFinite(completionTokens)) return null;
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens)
      ? totalTokens
      : (Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(completionTokens) ? completionTokens : 0)
  };
}

function parseOpenAIUsage(data) {
  const usage = data?.usage;
  if (!usage || typeof usage !== 'object') return null;
  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  const totalTokens = Number(usage.total_tokens);
  if (!Number.isFinite(promptTokens) && !Number.isFinite(completionTokens)) return null;
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens)
      ? totalTokens
      : (Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(completionTokens) ? completionTokens : 0)
  };
}

function recordTokenUsage(usage, cfg, genOpts, round) {
  if (!usage || typeof window === 'undefined' || !window.__tokenAudit?.record) return;
  window.__tokenAudit.record(usage, {
    stage: genOpts.tokenStage || 'api',
    model: cfg?.model || '',
    round
  });
}

async function callGemini(cfg, apiMessages, systemText, genOpts = {}) {
  const apiKey = cleanKey(cfg.key); cfg.key = apiKey;
  const contents = apiMessages.map(msg => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts = [];
    if (Array.isArray(msg.content)) {
      for (const p of msg.content) {
        if (p.type === 'image_url') {
          const { mime, data } = parseDataURL(p.image_url.url);
          parts.push({ inline_data: { mime_type: mime, data } });
        } else parts.push({ text: p.text });
      }
    } else parts.push({ text: msg.content });
    return { role, parts };
  });
  const payload = {
    model: cfg.model,
    system_instruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: {
      maxOutputTokens: genOpts.maxOutputTokens ?? 8192,
      temperature: genOpts.temperature ?? 0.1,
      ...(genOpts.temperature === 0 ? { seed: 0 } : {}),
      ...(genOpts.responseFormat ? { responseFormat: genOpts.responseFormat } : {}),
      ...(!genOpts.responseFormat && genOpts.responseMimeType ? { responseMimeType: genOpts.responseMimeType } : {}),
      ...(!genOpts.responseFormat && genOpts.responseSchema ? { responseSchema: genOpts.responseSchema } : {})
    }
  };
  const controller = new AbortController(); const timeoutMs = genOpts.timeoutMs ?? 120000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', mode: 'cors', redirect: 'follow', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const raw = await res.text(); let data;
    try { data = JSON.parse(raw); } catch (_) { throw new Error(raw || `HTTP ${res.status}`); }
    if (data.error || !res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    const candidate = data.candidates?.[0];
    const text = normalizeReturnedText((candidate?.content?.parts || []).map(p => p.text || '').join(''));
    if (text) return { text, finishReason: candidate?.finishReason || 'UNKNOWN', usage: parseGeminiUsageMetadata(data) };
    throw new Error(`Gemini 沒有回傳文字。原因：${candidate?.finishReason || data.promptFeedback?.blockReason || '未知原因'}`);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Gemini 請求逾時（超過 ${Math.round(timeoutMs / 1000)} 秒），請稍後再試。`);
    throw err;
  } finally { clearTimeout(timer); }
}

function toOpenAIMessage(msg) {
  const role = msg.role === 'assistant' ? 'assistant' : 'user';
  if (!Array.isArray(msg.content)) return { role, content: String(msg.content || '') };
  return {
    role,
    content: msg.content.map((part) => {
      if (part.type === 'image_url') {
        return { type: 'image_url', image_url: part.image_url };
      }
      return { type: 'text', text: String(part.text || '') };
    })
  };
}

function buildOpenAIResponseFormat(genOpts = {}) {
  const schema = genOpts.responseFormat?.text?.schema || genOpts.responseSchema;
  if (!schema) {
    const mime = genOpts.responseFormat?.text?.mimeType || genOpts.responseMimeType || '';
    return /APPLICATION_JSON/i.test(mime) ? { type: 'json_object' } : undefined;
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: genOpts.tokenStage === 'question_analysis' ? 'question_analysis' : 'solution_document',
      strict: true,
      schema
    }
  };
}

function openAIReasoningEffort(model) {
  return /^gpt-5\.1/i.test(model) ? 'none' : 'minimal';
}

async function callOpenAI(cfg, apiMessages, systemText, genOpts = {}) {
  const apiKey = cleanKey(cfg.key); cfg.key = apiKey;
  const maxCompletionTokens = Math.max(genOpts.maxOutputTokens ?? 8192, 16384);
  const payload = {
    model: cfg.model,
    messages: [
      { role: 'system', content: systemText },
      ...apiMessages.map(toOpenAIMessage)
    ],
    max_completion_tokens: maxCompletionTokens,
    reasoning_effort: openAIReasoningEffort(cfg.model),
    ...(buildOpenAIResponseFormat(genOpts) ? { response_format: buildOpenAIResponseFormat(genOpts) } : {})
  };
  const controller = new AbortController(); const timeoutMs = genOpts.timeoutMs ?? 120000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', mode: 'cors', redirect: 'follow', signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const raw = await res.text(); let data;
    try { data = JSON.parse(raw); } catch (_) { throw new Error(`OpenAI HTTP ${res.status}: ${raw || '無法解析回覆'}`); }
    if (data.error || !res.ok) throw new Error(`OpenAI ${data.error?.message || `HTTP ${res.status}`}`);
    const choice = data.choices?.[0];
    const text = normalizeReturnedText(choice?.message?.content || '');
    if (text) return { text, finishReason: choice?.finish_reason || 'UNKNOWN', usage: parseOpenAIUsage(data) };
    if (choice?.finish_reason === 'length') {
      throw new Error('OpenAI 回覆達到長度限制，沒有輸出文字。已改用較低推理量；請重試，或切換 GPT-5 mini。');
    }
    throw new Error(`OpenAI 沒有回傳文字。原因：${choice?.finish_reason || '未知原因'}`);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`OpenAI 請求逾時（超過 ${Math.round(timeoutMs / 1000)} 秒），請稍後再試。`);
    throw err;
  } finally { clearTimeout(timer); }
}

function looksIncomplete(text, finishReason) {
  const t = String(text || '').trim();
  if (!t || finishReason === 'MAX_TOKENS') return true;
  // JSON 詳解：能 parse 就不算未完成；括號／字串未關則算未完成
  if (t.includes('"blocks"') || /^\s*\{/.test(t)) {
    if (typeof window !== 'undefined' && window.SolutionCore && typeof window.SolutionCore.parse === 'function') {
      const doc = window.SolutionCore.parse(t);
      if (doc && Array.isArray(doc.blocks) && doc.blocks.length) return false;
    }
    try {
      const parsed = JSON.parse(t);
      if (parsed && Array.isArray(parsed.blocks)) return false;
    } catch (_) { /* fallthrough */ }
    return true;
  }
  if (/\*\*答[:：]/.test(t)) return false;
  return /故僅能$|如下$|因此$|可得$|無法$|不能$/.test(t);
}

async function callAPI(cfg, apiMessages, systemText, genOpts = {}) {
  const maxContinue = genOpts.maxContinue ?? 2;
  let messages = apiMessages.map(m => ({ ...m }));
  let combined = '';
  const usageTotal = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const jsonMode = !!(genOpts.responseFormat || genOpts.responseSchema || /APPLICATION_JSON/i.test(genOpts.responseMimeType || ''));
  for (let round = 0; round <= maxContinue; round++) {
    const caller = cfg?.provider === 'openai' ? callOpenAI : callGemini;
    const { text, finishReason, usage } = await caller(cfg, messages, systemText, genOpts);
    if (usage) {
      usageTotal.promptTokens += usage.promptTokens;
      usageTotal.completionTokens += usage.completionTokens;
      usageTotal.totalTokens += usage.totalTokens;
      recordTokenUsage(usage, cfg, genOpts, round);
    }
    combined = combined ? (jsonMode ? `${combined}${text}` : `${combined}\n${text}`) : text;
    if (!looksIncomplete(combined, finishReason)) return { text: combined, truncated: false, usage: usageTotal };
    if (round >= maxContinue) break;
    if (jsonMode) {
      // JSON 被截斷後，從字元中斷處續寫常會遺失引號／括號；改為重新產生一份較精煉的完整 JSON。
      combined = '';
      messages = [...apiMessages, {
        role: 'user',
        content: '上一版 JSON 因長度未完成。請重新輸出一份完整、可解析的 JSON；保留必要化學判斷，刪除重複說明，blocks 不超過 32，勿輸出 Markdown。'
      }];
    } else {
      const continueHint = '上一段詳解尚未寫完。請從中斷處繼續，補完計算並以 **答：** 結尾；不要重複已寫內容。';
      messages = [...apiMessages, { role: 'assistant', content: combined }, { role: 'user', content: continueHint }];
    }
  }
  return { text: combined, truncated: true, usage: usageTotal };
}
