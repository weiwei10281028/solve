function parseDataURL(url) {
  const [h, data] = url.split(',');
  return { mime: h.match(/data:([^;]+)/)[1], data };
}

function formatError(msg) {
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
  if (/not found|not supported for generateContent/i.test(msg)) return '此 Gemini 模型目前不可用。請確認模型 ID。';
  if (/decommissioned|model_decommissioned/i.test(msg)) return '此 Gemini 模型已被官方下架或更名。請確認最新模型 ID。';
  if (/quota|rate.?limit|exceeded|limit:\s*0/i.test(msg)) return 'Gemini 額度已用完，請更換 API Key 或等待額度恢復。';
  return msg;
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
    const candidate = data.candidates?.[0]; const text = (candidate?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (text) return { text, finishReason: candidate?.finishReason || 'UNKNOWN' };
    throw new Error(`Gemini 沒有回傳文字。原因：${candidate?.finishReason || data.promptFeedback?.blockReason || '未知原因'}`);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Gemini 請求逾時（超過 ${Math.round(timeoutMs / 1000)} 秒），請稍後再試。`);
    throw err;
  } finally { clearTimeout(timer); }
}

function looksIncomplete(text, finishReason) {
  const t = String(text || '').trim();
  if (!t || finishReason === 'MAX_TOKENS') return true;
  if (/\*\*答[:：]/.test(t)) return false;
  return /故僅能$|如下$|因此$|可得$|無法$|不能$/.test(t);
}

async function callAPI(cfg, apiMessages, systemText, genOpts = {}) {
  const maxContinue = genOpts.maxContinue ?? 2; let messages = apiMessages.map(m => ({ ...m })); let combined = '';
  for (let round = 0; round <= maxContinue; round++) {
    const { text, finishReason } = await callGemini(cfg, messages, systemText, genOpts);
    combined = combined ? `${combined}\n${text}` : text;
    if (!looksIncomplete(combined, finishReason)) return { text: combined, truncated: false };
    if (round >= maxContinue) break;
    messages = [...apiMessages, { role: 'assistant', content: combined }, { role: 'user', content: '上一段詳解尚未寫完。請從中斷處繼續，補完計算並以 **答：** 結尾；不要重複已寫內容。' }];
  }
  return { text: combined, truncated: true };
}
