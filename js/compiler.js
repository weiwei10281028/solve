/*
 * js/compiler.js — v2 排版編譯單一入口（雙通道）
 *
 * 設計理念：AI 只交付語意 JSON，本機負責所有顯示語法。編譯分兩個通道：
 *   mathPass  ── calculation：代數／對數／分數／根號／科學記號，走嚴格數學 LaTeX。
 *   chemPass  ── paragraph / choice / chemical_equation：物種、離子、反應式走 mhchem。
 * 兩者實作沿用 solution-core.js（calculation / chemistry / formatText / compile），
 * 此檔提供統一、易讀的外部呼叫點與文件，不重複實作正則。
 */
(function (global) {
  'use strict';

  function core() {
    const c = global.SolutionCore;
    if (!c) throw new Error('compiler.js 需在 solution-core.js 之後載入');
    return c;
  }

  /** 數學通道：一條算式 → 正規化後的數學 LaTeX（次方、\dfrac、\sqrt、內嵌 \ce）。 */
  function mathPass(expression) {
    return core().calculation(String(expression || ''));
  }

  /** 化學通道：純文字化學式／反應式 → mhchem（$\ce{...}$）。 */
  function chemPass(token) {
    return core().chemistry(String(token || ''));
  }

  /** 語意 JSON 文件 → 詳解 Markdown（供 render.js 渲染）。 */
  function compileDocument(doc) {
    return core().compile(doc);
  }

  /** 解析 + 正規化 + 編譯，回傳 { ok, text, document }（與 SolutionCore.prepare 相同）。 */
  function prepare(raw) {
    return core().prepare(raw);
  }

  global.Compiler = Object.freeze({ mathPass, chemPass, compileDocument, prepare });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Compiler;
})(typeof window !== 'undefined' ? window : globalThis);
