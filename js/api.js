function parseDataURL(url) {
  const [h, data] = url.split(',');
  return { mime: h.match(/data:([^;]+)/)[1], data };
}

function formatError(msg) {
  if (/Gemini 沒有回傳文字/i.test(msg)) {
    return `${msg}\n\n請檢查圖片清晰度，或改用 Gemini 3.1 Pro 後再試。`;
  }
  if (/Failed to fetch|Load failed|NetworkError/i.test(msg)) {
    return '無法直接連到 Google Gemini API。\n\n請確認目前網路可連線，並重新整理後再試。';
  }
  if (/invalid authentication credentials|expected oauth|login cookie|authentication credential|api key not valid|API_KEY_INVALID|PERMISSION_DENIED|forbidden|unauthorized/i.test(msg)) {
    return 'API Key 驗證失敗。\n\n請到「API 設定」重新貼上 Gemini API Key 後儲存。';
  }
  if (/high demand|spikes in demand|try again later/i.test(msg)) {
    return 'Gemini 3.1 目前請求過多，請稍後再試。';
  }
  if (/not found|not supported for generateContent/i.test(msg)) {
    return '此 Gemini 3.x 模型目前不可用。請確認 Google AI Studio 是否支援此模型 ID。';
  }
  if (/decommissioned|model_decommissioned/i.test(msg)) {
    return '此 Gemini 3.x 模型已被官方下架或更名。請確認 Google AI Studio 最新模型 ID。';
  }
  if (/quota|rate.?limit|exceeded|limit:\s*0/i.test(msg)) {
    return 'Gemini 3.x 額度已用完，請更換另一把 Gemini API Key 或等待額度恢復。';
  }
  return msg;
}

async function callGemini(cfg, apiMessages, systemText, genOpts = {}) {
  const apiKey = cleanKey(cfg.key);
  cfg.key = apiKey;
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
      temperature: genOpts.temperature ?? 0.1
    }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const timeoutMs = genOpts.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Gemini 請求逾時（超過 ${Math.round(timeoutMs / 1000)} 秒），請稍後再試。`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(raw || `HTTP ${res.status}`);
  }
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();
  const finishReason = candidate?.finishReason || 'UNKNOWN';
  if (text) return { text, finishReason };
  const reason = finishReason || data.promptFeedback?.blockReason || '未知原因';
  throw new Error(`Gemini 沒有回傳文字。原因：${reason}`);
}

function looksIncomplete(text, finishReason) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (finishReason === 'MAX_TOKENS') return true;
  if (/\*\*答[:：]/.test(t)) return false;
  return /故僅能$|如下$|因此$|可得$|無法$|不能$/.test(t);
}

const IMAGE_HINT_SYSTEM = `你是化學題目辨識器。只看圖片，輸出一行「配對用關鍵字」供題庫搜尋，禁止解題。
格式：條件:關鍵數據與概念（濃度、pH、mL體積、解離度、比例、弱酸、電解、並聯、氣體反應、同溫同壓等）
範例：條件:0.24M pH4.0 α11/12 比10 弱酸 二質子 H2A
範例：條件:2mL 1mL 同溫同壓 甲乙丙 氣體 A2 化學式
禁止輸出題號。只輸出一行，繁體中文。`;

async function extractImageMatchHints(cfg, imgDataURL, catalogLine = '') {
  const urls = Array.isArray(imgDataURL) ? imgDataURL : [imgDataURL];
  const valid = urls.filter(Boolean);
  if (!valid.length) return '';
  const multi = valid.length > 1;
  const userText = (catalogLine
    ? `【題庫索引】${catalogLine}\n`
  : '') + (multi
    ? `共 ${valid.length} 張圖，依序閱讀後合併擷取能對上索引的化學條件關鍵字（不要題號）。`
    : (catalogLine
      ? '請從圖片擷取能對上索引的化學條件關鍵字（不要題號）。'
      : '請從圖片擷取化學條件關鍵字（不要題號）。'));
  const { text } = await callAPI(cfg, [{
    role: 'user',
    content: [
      ...valid.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } })),
      { type: 'text', text: userText }
    ]
  }], IMAGE_HINT_SYSTEM, { temperature: 0, maxOutputTokens: 256, maxContinue: 0, timeoutMs: 45000 });
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function callAPI(cfg, apiMessages, systemText, genOpts = {}) {
  const maxContinue = genOpts.maxContinue ?? 2;
  let messages = apiMessages.map(m => ({ ...m }));
  let combined = '';

  for (let round = 0; round <= maxContinue; round++) {
    const { text, finishReason } = await callGemini(cfg, messages, systemText, genOpts);
    combined = combined ? `${combined}\n${text}` : text;
    if (!looksIncomplete(combined, finishReason)) {
      return { text: combined, truncated: false };
    }
    if (round >= maxContinue) break;
    messages = [
      ...apiMessages,
      { role: 'assistant', content: combined },
      { role: 'user', content: '上一段詳解尚未寫完。請從中斷處繼續，補完計算並以 **答：** 結尾；不要重複已寫內容。' }
    ];
  }
  return { text: combined, truncated: true };
}
