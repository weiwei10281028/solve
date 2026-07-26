/**
 * 開發用 Token 統計（僅 console，不顯示在網頁）。
 * 移除時：刪除此檔、index.html 的 script 標籤、各 callAPI 的 tokenStage 即可。
 */
(function (global) {
  'use strict';

  const ENABLED = true;

  const STAGE_LABELS = {
    question_analysis: '題目審題',
    main_solve: '主解題',
    followup: '追問'
  };

  let session = null;

  function labelFor(stage) {
    return STAGE_LABELS[stage] || stage || 'API';
  }

  function beginSession(kind = 'solve') {
    if (!ENABLED) return;
    session = { kind, startedAt: Date.now(), entries: [] };
  }

  function record(usage, meta = {}) {
    if (!ENABLED || !session || !usage) return;
    session.entries.push({
      stage: meta.stage || 'api',
      model: meta.model || '',
      round: meta.round ?? 0,
      promptTokens: Number(usage.promptTokens) || 0,
      completionTokens: Number(usage.completionTokens) || 0,
      totalTokens: Number(usage.totalTokens) || 0,
      at: Date.now()
    });
  }

  function summarize(entries) {
    return entries.reduce((acc, entry) => {
      acc.promptTokens += entry.promptTokens;
      acc.completionTokens += entry.completionTokens;
      acc.totalTokens += entry.totalTokens;
      acc.calls += 1;
      return acc;
    }, { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 });
  }

  function endSession() {
    if (!ENABLED || !session) return null;
    const { kind, entries } = session;
    const summary = summarize(entries);
    const result = { kind, ...summary, entries: entries.slice() };

    if (entries.length) {
      console.groupCollapsed(
        `[TokenAudit] ${kind}｜輸入 ${summary.promptTokens}｜輸出 ${summary.completionTokens}｜${summary.calls} 次 API`
      );
      console.table(entries.map((entry) => ({
        階段: labelFor(entry.stage) + (entry.round > 0 ? `（續寫${entry.round + 1}）` : ''),
        模型: entry.model,
        輸入: entry.promptTokens,
        輸出: entry.completionTokens,
        合計: entry.totalTokens
      })));
      console.info('[TokenAudit] 合計', {
        輸入: summary.promptTokens,
        輸出: summary.completionTokens,
        total: summary.totalTokens,
        calls: summary.calls
      });
      console.groupEnd();
    } else {
      console.info(`[TokenAudit] ${kind}｜無 API 呼叫`);
    }

    global.__lastTokenAudit = result;
    session = null;
    return result;
  }

  global.__tokenAudit = Object.freeze({
    ENABLED,
    beginSession,
    record,
    endSession,
    getSession: () => session,
    getLast: () => global.__lastTokenAudit || null
  });
})(typeof window !== 'undefined' ? window : globalThis);
