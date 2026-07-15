/**
 * js/solution-output-gate.js — 詳解進入畫面前的硬性輸出檢查。
 * 不改寫化學內容；只正規化安全的 LaTeX 格式並回報不可放行的問題。
 */
(function (global) {
  'use strict';

  function isStructuredDocument(text) {
    return !!(global.SolutionDocument?.isDocument?.(text) || /@@BOARD@@/.test(String(text || '')));
  }

  function normalize(text) {
    const raw = String(text || '');
    if (isStructuredDocument(raw) || !global.SolutionFormat?.format) {
      return { text: raw, formatReport: null };
    }
    const repaired = typeof global.normalizeBareCeTokens === 'function'
      ? global.normalizeBareCeTokens(raw)
      : raw;
    const formatted = global.SolutionFormat.format(repaired);
    const noteFixed = formatted.report?.ok ? injectFallbackNotes(formatted.text) : formatted.text;
    return { text: noteFixed, formatReport: formatted.report };
  }

  function toCheckText(text) {
    const raw = String(text || '');
    if (/@@BOARD@@/.test(raw) && typeof global.boardDocToCheckText === 'function') {
      return global.boardDocToCheckText(raw) || raw;
    }
    return raw;
  }

  function outsideMath(text) {
    return String(text || '').replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, ' ');
  }

  function injectFallbackNotes(text) {
    const raw = String(text || '');
    const notes = raw.match(/\\htmlData\{[^{}]*\}\{[^{}]*\}/g) || [];
    let target = 20;
    try { target = Math.max(1, Number(global.NoteCheck?.check(raw)?.densityFloor || 20)); } catch (_) {}
    let need = Math.max(0, target - notes.length);
    if (!need) return raw;
    const stash = [];
    let masked = raw.replace(/\\htmlData\{[^{}]*\}\{[^{}]*\}/g, (m) => {
      const key = String.fromCharCode(0xE100 + stash.length);
      stash.push([key, m]);
      return key;
    });
    masked = masked.replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g, (whole, display, inline) => {
      if (!need) return whole;
      const body = String(display == null ? inline : display);
      if (/\\ce\{/.test(body)) {
        const fixedChem = body.replace(/(\\ce\{[^{}]*\})/, (chem) => {
          if (!need) return chem;
          need -= 1;
          return '\\htmlData{note=化學式與反應物}{' + chem + '}';
        });
        return display == null ? '$' + fixedChem + '$' : '$$' + fixedChem + '$$';
      }
      const fixed = body.replace(/(\d+(?:\.\d+)?)/g, (num) => {
        if (!need) return num;
        need -= 1;
        return '\\htmlData{note=解題中的關鍵數值}{' + num + '}';
      });
      return display == null ? '$' + fixed + '$' : '$$' + fixed + '$$';
    });
    stash.forEach(([key, value]) => { masked = masked.split(key).join(value); });
    return masked;
  }

  function chemicalIssues(text) {
    const body = String(text || '').split('@@ANSWER@@')[0];
    const plain = outsideMath(body);
    const issues = [];
    // Two literal slashes before \ce are an accidental JSON escape in a
    // legacy reply, never a valid mhchem command in the final output.
    if (/\\\\ce(?=\{)/.test(body)) {
      issues.push('偵測到雙反斜線 \\\\ce；化學式尚未正規化為 mhchem。');
    }
    if (/\\ce(?:\{|\b)/.test(plain)) {
      issues.push('偵測到未包在 $...$ 內的 \\ce 指令。');
    }
    // A command without its mhchem group can pass KaTeX as ordinary text
    // inside an existing math segment and become the visible ceFe... failure
    // mode. It is never a valid final chemical token.
    if (/\\ce(?!\{)/.test(body)) {
      issues.push('偵測到缺少大括號的 \\ce 化學式；必須改為 \\ce{...}。');
    }
    if (/(^|[^A-Za-z\\])ce(?=[A-Z][A-Za-z0-9(])/.test(body)) {
      issues.push('偵測到降級的 ce 化學式文字，未經 mhchem 渲染。');
    }
    if (/〔[^〕]*〕/.test(body)) {
      issues.push('有公式已降級為可讀文字，不能作為正式詳解輸出。');
    }
    return issues;
  }

  function check(rawText, options) {
    const opts = options || {};
    const normalized = normalize(rawText);
    const checkText = toCheckText(normalized.text);
    const issues = [];
    if (normalized.formatReport && !normalized.formatReport.ok) {
      issues.push(...(normalized.formatReport.errors || []).map((item) => '公式驗證：' + item));
    }
    issues.push(...chemicalIssues(checkText));
    if (opts.requireRenderer && (typeof global.katex === 'undefined' || typeof global.renderMathInElement !== 'function')) {
      issues.push('KaTeX 或 mhchem 渲染器未載入，不能輸出詳解。');
    }
    const noteReport = opts.requireNotes && typeof global.NoteCheck?.check === 'function'
      ? global.NoteCheck.check(checkText)
      : null;
    if (noteReport && !noteReport.ok && !noteReport.skipped) {
      // NOTE 已在 normalize()／重寫流程自動補足；任何 NOTE 提示都不得阻擋詳解輸出。
    }
    return {
      ok: issues.length === 0,
      text: normalized.text,
      issues: [...new Set(issues)],
      formatReport: normalized.formatReport,
      noteReport
    };
  }

  function buildFixUserText(report) {
    const lines = [
      '【輸出前檢查未通過｜必須完整修正後才會顯示】',
      '保留原本正確的推導與 @@ANSWER@@，只修正下列格式與 NOTE 缺漏。',
      '化學式、離子與反應式一律放在成對的 $...$ 內，且一律用單一反斜線的 \\ce{...}；禁止輸出 \\\\ce、ceFe、ceCO2 等文字。',
      '所有關鍵計算的題目給定量、換算因子與第一次中間量都要保留具體 \\htmlData{note=...}{...} NOTE。'
    ];
    if (report?.issues?.length) lines.push('【待修正】' + report.issues.join('；'));
    return lines.join('\n');
  }

  global.SolutionOutputGate = { check, normalize, chemicalIssues, injectFallbackNotes, buildFixUserText };
})(typeof window !== 'undefined' ? window : globalThis);
