(function () {
  'use strict';

  const CASES = [
    { id: 1, image: 'tests/benchmark/images/q01-05.png', answer: 'C' },
    { id: 2, image: 'tests/benchmark/images/q01-05.png', answer: 'E' },
    { id: 3, image: 'tests/benchmark/images/q01-05.png', answer: 'A' },
    { id: 4, image: 'tests/benchmark/images/q01-05.png', answer: 'D' },
    { id: 5, image: 'tests/benchmark/images/q01-05.png', answer: 'B' },
    { id: 6, image: 'tests/benchmark/images/q06-07.png', answer: 'E' },
    { id: 7, image: 'tests/benchmark/images/q06-07.png', answer: 'B' },
    { id: 8, image: 'tests/benchmark/images/q08-10.png', answer: 'CE' },
    { id: 9, image: 'tests/benchmark/images/q08-10.png', answer: 'CE' },
    { id: 10, image: 'tests/benchmark/images/q08-10.png', answer: 'BD' },
    { id: 11, image: 'tests/benchmark/images/q11-12.png', answer: 'ABC' },
    { id: 12, image: 'tests/benchmark/images/q11-12.png', answer: 'ABD' },
    { id: 13, image: 'tests/benchmark/images/q13-14.png', answer: 'CD' },
    { id: 14, image: 'tests/benchmark/images/q13-14.png', answer: 'CD' },
    { id: 15, image: 'tests/benchmark/images/q15.png', answer: 'DE' },
    { id: 16, image: 'tests/benchmark/images/q16.png', answer: 'AB' },
    { id: 17, image: 'tests/benchmark/images/q17-18.png', answer: 'BDE' },
    { id: 18, image: 'tests/benchmark/images/q17-18.png', answer: 'BDE' },
    { id: 19, image: 'tests/benchmark/images/q19.png', answer: 'AC' }
  ];

  const imageCache = new Map();
  let stopRequested = false;
  let latestResults = [];

  function getStored(name, fallback = '') {
    return localStorage.getItem(name) || sessionStorage.getItem(name) || fallback;
  }

  function providerModelKey(provider) {
    return `aim:${provider}`;
  }

  function providerKeyKey(provider) {
    return `aik:${provider}`;
  }

  function getCfg() {
    const provider = getStored('aip', 'gemini');
    const key = cleanKey(getStored(providerKeyKey(provider), getStored('aik', '')));
    const fallbackModel = provider === 'openai' ? 'gpt-5-nano' : 'gemini-3.5-flash-lite';
    const model = getStored(providerModelKey(provider), getStored('aim', fallbackModel));
    return { provider, key, model };
  }

  function normalizeAnswer(value) {
    const raw = String(value || '').toUpperCase();
    const answerMark = raw.match(/(?:@@ANSWER@@|答案|ANSWER)\s*[:：]?\s*\(?\s*([A-E](?:\s*[,、]?\s*[A-E])*)\s*\)?/);
    const source = answerMark ? answerMark[1] : raw;
    return [...new Set((source.match(/[A-E]/g) || []))].sort().join('');
  }

  function answersEqual(actual, expected) {
    return normalizeAnswer(actual) === normalizeAnswer(expected);
  }

  function parseCaseFilter(value) {
    const text = String(value || '').trim();
    if (!text) return new Set(CASES.map((item) => item.id));
    const ids = new Set();
    text.split(/[,\s、，]+/).filter(Boolean).forEach((part) => {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        for (let id = Math.min(start, end); id <= Math.max(start, end); id += 1) ids.add(id);
      } else if (/^\d+$/.test(part)) {
        ids.add(Number(part));
      }
    });
    return ids;
  }

  async function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function loadImageDataURL(path) {
    if (imageCache.has(path)) return imageCache.get(path);
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`題圖讀取失敗：${path} (${response.status})`);
    const dataUrl = await blobToDataURL(await response.blob());
    imageCache.set(path, dataUrl);
    return dataUrl;
  }

  function imageMessage(dataUrl, text) {
    return [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        { type: 'text', text }
      ]
    }];
  }

  function solveSchema() {
    return JSON.parse(JSON.stringify(window.SolutionCore.SCHEMA));
  }

  function solveOptions(stage) {
    if (isPlainOutputMode()) {
      return {
        temperature: 0.25,
        maxOutputTokens: 4096,
        timeoutMs: 120000,
        maxContinue: 0,
        tokenStage: stage,
        responseMimeType: 'text/plain'
      };
    }
    return {
      temperature: 0.25,
      maxOutputTokens: 4096,
      timeoutMs: 120000,
      maxContinue: 0,
      tokenStage: stage,
      responseFormat: {
        text: { mimeType: 'APPLICATION_JSON', schema: solveSchema() }
      }
    };
  }

  function isPlainOutputMode() {
    return !!document.getElementById('plainOutputMode')?.checked;
  }

  function plainSolveSystem() {
    return [
      '你是高中化學解題老師。依原圖完整判斷後作答。',
      '請用繁體中文，公式用 AsciiMath。',
      '輸出固定三段：題意、依據與推導、選項分析。',
      '題意簡短；推導保留必要概念與計算；選項分析逐項判正誤。',
      '最後一行必須只寫：答案：<選項字母>，多選請連寫如 AC。'
    ].join('\n');
  }

  function fallbackAnalysisMemo(benchCase, rawText = '') {
    const text = String(rawText || '').replace(/\\n/g, '\n');
    const cardLines = [...text.matchAll(/CARD\s*[:=]\s*([^\n"\\]+)/gi)]
      .map((match) => `CARD=${match[1].trim()}`)
      .filter((line) => line.length > 5);
    const firstCard = cardLines[0] || 'CARD=通用題型核對';
    return [
      firstCard,
      `TARGET:只解第 ${benchCase.id} 題並判斷正確選項`,
      'CHECKS:依原圖讀題，列出足以判斷選項正誤的必要關係與計算'
    ].join('\n');
  }

  function selectAuditCards(questionText, memo, rawText = '') {
    const selected = typeof window.buildSelectedAuditCardBlock === 'function'
      ? window.buildSelectedAuditCardBlock(memo)
      : '';
    if (selected && !/通用/.test(selected)) return selected;
    const source = [questionText, memo, rawText].filter(Boolean).join('\n');
    const local = typeof window.buildLocalAuditCardBlock === 'function'
      ? window.buildLocalAuditCardBlock(source, memo)
      : '';
    return local || selected;
  }

  async function runDirect(cfg, benchCase, dataUrl) {
    const userText = [
      `請只解第 ${benchCase.id} 題。`,
      isPlainOutputMode()
        ? '依原圖判斷；逐項分析；最後一行只寫「答案：選項字母」。'
        : '依原圖判斷並回傳網站指定 JSON；有選項時逐項分析，最後 answer 只填選項字母。'
    ].join('\n');
    const reply = await callAPI(
      cfg,
      imageMessage(dataUrl, userText),
      isPlainOutputMode() ? plainSolveSystem() : window.SolutionCore.buildSystem(),
      solveOptions('benchmark_direct')
    );
    return { raw: reply.text, memo: '', truncated: !!reply.truncated };
  }

  async function runTwoStage(cfg, benchCase, dataUrl) {
    const questionText = `請只解第 ${benchCase.id} 題。`;
    const analysisText = window.buildQuestionAnalysisUserText(questionText);
    let analysisRaw = '';
    let analysisIssue = '';
    let parsed = null;
    try {
      const analysis = await callAPI(
        cfg,
        imageMessage(dataUrl, analysisText),
        window.QuestionAnalysisPrompt.SYSTEM,
        {
          temperature: 0.25,
          maxOutputTokens: 1024,
          timeoutMs: 60000,
          maxContinue: 0,
          tokenStage: 'benchmark_question_analysis',
          responseFormat: {
            text: { mimeType: 'APPLICATION_JSON', schema: window.QuestionAnalysisPrompt.SCHEMA }
          }
        }
      );
      analysisRaw = analysis.text;
      parsed = window.parseQuestionAnalysis(analysis.text);
      if (!parsed) analysisIssue = '審題 JSON 無法解析，已用最小備忘錄續跑';
    } catch (err) {
      analysisIssue = `審題失敗，已用最小備忘錄續跑：${String(err?.message || err)}`;
    }
    if (!parsed) {
      parsed = { memo: fallbackAnalysisMemo(benchCase, analysisRaw) };
    }
    const cardBlock = selectAuditCards(questionText, parsed.memo, analysisRaw);
    const assembled = window.assembleSolveUserContent(
      questionText,
      parsed.memo,
      '',
      '',
      { localAuditCardBlock: cardBlock, mayHaveChoices: true }
    );
    const solve = await callAPI(
      cfg,
      imageMessage(dataUrl, assembled.fullText),
      isPlainOutputMode() ? plainSolveSystem() : window.SolutionCore.buildSystem(),
      solveOptions('benchmark_two_stage')
    );
    const memoParts = [];
    if (analysisIssue) memoParts.push(`ANALYSIS_ISSUE:${analysisIssue}`);
    if (analysisRaw) memoParts.push(`RAW_ANALYSIS:${analysisRaw}`);
    memoParts.push(parsed.memo);
    if (cardBlock) memoParts.push(cardBlock);
    return { raw: solve.text, memo: memoParts.filter(Boolean).join('\n\n'), truncated: !!solve.truncated };
  }

  function extractAnswer(raw) {
    if (isPlainOutputMode()) {
      const text = String(raw || '');
      const answerLine = [...text.matchAll(/答案\s*[:：]\s*\(?\s*([A-E](?:\s*[,、，]?\s*[A-E])*)\s*\)?/gi)].pop();
      if (answerLine) return normalizeAnswer(answerLine[1]);
      return normalizeAnswer(text.slice(-500));
    }
    const prepared = window.SolutionCore.prepare(raw, { allowChoices: true });
    if (prepared.ok && prepared.document?.answer) return normalizeAnswer(prepared.document.answer);
    try {
      const parsed = JSON.parse(String(raw || '').trim());
      if (parsed?.answer) return normalizeAnswer(parsed.answer);
    } catch (_) {
      // fall through
    }
    if (/^\s*\{/.test(String(raw || ''))) return '';
    return normalizeAnswer(raw);
  }

  function modeLabel(mode) {
    return mode === 'direct' ? '直接解題' : '審題+解題';
  }

  function rawJsonDiagnostics(raw) {
    const text = String(raw || '');
    const lines = [];
    lines.push(`rawLength=${text.length}`);
    lines.push(`startsWithJson=${/^\s*\{/.test(text) ? 'yes' : 'no'}`);
    const answerMatch = text.match(/"answer"\s*:\s*"([^"]*)"/);
    lines.push(`answerField=${answerMatch ? answerMatch[1] : '(not found)'}`);
    try {
      JSON.parse(text);
      lines.push('jsonParse=ok');
    } catch (err) {
      lines.push(`jsonParseError=${String(err?.message || err)}`);
    }
    const prepared = window.SolutionCore?.prepare
      ? window.SolutionCore.prepare(text, { allowChoices: true })
      : null;
    if (prepared) {
      lines.push(`solutionPrepare=${prepared.ok ? 'ok' : 'failed'}`);
      if (!prepared.ok) lines.push(`solutionPrepareReason=${prepared.reason || '(none)'}`);
    }
    lines.push('');
    lines.push('--- RAW_HEAD ---');
    lines.push(text.slice(0, 1800) || '(empty)');
    if (text.length > 1800) {
      lines.push('');
      lines.push('--- RAW_TAIL ---');
      lines.push(text.slice(-1800));
    }
    return lines.join('\n');
  }

  function setStatus(text) {
    document.getElementById('benchStatus').textContent = text;
  }

  function renderSummary(results) {
    const host = document.getElementById('benchSummary');
    const groups = ['direct', 'two_stage'].filter((mode) => results.some((item) => item.mode === mode));
    host.innerHTML = groups.map((mode) => {
      const items = results.filter((item) => item.mode === mode);
      const done = items.filter((item) => item.status !== 'running').length;
      const ok = items.filter((item) => item.ok).length;
      const errors = items.filter((item) => item.error).length;
      const avg = items.filter((item) => item.ms).reduce((sum, item) => sum + item.ms, 0) / Math.max(items.filter((item) => item.ms).length, 1);
      return `<div class="bench-stat"><span>${modeLabel(mode)}</span><b>${ok}/${done}</b><small class="muted">錯誤 ${errors}，平均 ${Math.round(avg || 0)} ms</small></div>`;
    }).join('') || '<div class="bench-stat"><span>尚未執行</span><b>0/0</b></div>';
  }

  function renderRows(results) {
    const rows = document.getElementById('benchRows');
    rows.innerHTML = results.map((item) => {
      const cls = item.error ? 'error' : (item.ok ? 'ok' : 'bad');
      const resultText = item.error ? '錯誤' : (item.ok ? '正確' : '不符');
      const detail = item.error
        ? `<details open><summary>${escapeHtml(item.error)}</summary><pre>${escapeHtml(rawJsonDiagnostics(item.raw || ''))}</pre>${item.memo ? `<pre>${escapeHtml(item.memo)}</pre>` : ''}</details>`
        : `<details><summary>查看輸出</summary><pre>${escapeHtml(item.raw || '')}</pre>${item.memo ? `<pre>${escapeHtml(item.memo)}</pre>` : ''}</details>`;
      return `<tr class="${cls}">
        <td>${modeLabel(item.mode)}</td>
        <td>${item.id}</td>
        <td><code>${item.expected}</code></td>
        <td><code>${item.actual || ''}</code></td>
        <td>${resultText}</td>
        <td>${item.ms ? `${Math.round(item.ms / 1000)} 秒` : ''}</td>
        <td>${detail}</td>
      </tr>`;
    }).join('');
    renderSummary(results);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function runOne(mode, cfg, benchCase) {
    const dataUrl = await loadImageDataURL(benchCase.image);
    const started = performance.now();
    const output = mode === 'direct'
      ? await runDirect(cfg, benchCase, dataUrl)
      : await runTwoStage(cfg, benchCase, dataUrl);
    const actual = extractAnswer(output.raw);
    const formatError = !isPlainOutputMode() && !actual && /^\s*\{/.test(String(output.raw || ''));
    return {
      mode,
      id: benchCase.id,
      expected: normalizeAnswer(benchCase.answer),
      actual,
      ok: answersEqual(actual, benchCase.answer),
      error: formatError ? '解題 JSON 格式失敗' : '',
      diagnostics: formatError ? rawJsonDiagnostics(output.raw) : '',
      ms: performance.now() - started,
      raw: output.raw,
      memo: output.memo,
      truncated: output.truncated
    };
  }

  async function runBenchmark() {
    const cfg = getCfg();
    if (!cfg.key) {
      setStatus('找不到 API Key。請先回主頁設定並儲存 API Key。');
      return;
    }
    const modes = [];
    if (document.getElementById('modeDirect').checked) modes.push('direct');
    if (document.getElementById('modeTwoStage').checked) modes.push('two_stage');
    if (!modes.length) {
      setStatus('請至少選一種模式。');
      return;
    }
    const wanted = parseCaseFilter(document.getElementById('caseFilter').value);
    const cases = CASES.filter((item) => wanted.has(item.id));
    latestResults = [];
    stopRequested = false;
    document.getElementById('runBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('downloadBtn').disabled = true;
    renderRows(latestResults);
    try {
      for (const mode of modes) {
        for (const benchCase of cases) {
          if (stopRequested) break;
          setStatus(`執行中：${modeLabel(mode)}，第 ${benchCase.id} 題`);
          try {
            const result = await runOne(mode, cfg, benchCase);
            latestResults.push(result);
          } catch (err) {
            latestResults.push({
              mode,
              id: benchCase.id,
              expected: normalizeAnswer(benchCase.answer),
              actual: '',
              ok: false,
              error: String(err?.message || err),
              ms: 0,
              raw: '',
              memo: ''
            });
          }
          renderRows(latestResults);
        }
      }
      setStatus(stopRequested ? '已停止。' : '評估完成。');
    } finally {
      document.getElementById('runBtn').disabled = false;
      document.getElementById('stopBtn').disabled = true;
      document.getElementById('downloadBtn').disabled = latestResults.length === 0;
    }
  }

  function downloadResults() {
    const payload = {
      createdAt: new Date().toISOString(),
      cfg: { provider: getCfg().provider, model: getCfg().model, plainOutputMode: isPlainOutputMode() },
      results: latestResults
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `solver-benchmark-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  }

  document.getElementById('runBtn').addEventListener('click', runBenchmark);
  document.getElementById('stopBtn').addEventListener('click', () => {
    stopRequested = true;
    setStatus('停止中：等待目前這一題完成。');
  });
  document.getElementById('downloadBtn').addEventListener('click', downloadResults);
  renderSummary([]);
})();
