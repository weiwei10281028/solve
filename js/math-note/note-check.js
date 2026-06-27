/**
 * js/math-note/note-check.js — NOTE 本地驗收（不擋渲染、預設不呼叫第二次 API）
 */
(function (global) {
  'use strict';

  /** 過泛 note（須具體化） */
  const VAGUE_NOTE_RE = /^(質量|濃度|莫耳數|原子量|分子量|式量|體積|時間|常數|數值|結果)$/;

  const NOTE_ATTR_RE = /\\htmlData\{note=([^}]*)\}/g;

  function stripAnswer(text) {
    return String(text || '').split('@@ANSWER@@')[0];
  }

  function countHtmlData(body) {
    return (body.match(/\\htmlData\{/g) || []).length;
  }

  /** 含等號／推導且含 $ 或 LaTeX 的行（粗略視為關鍵算式行） */
  function countEquationLines(body) {
    let n = 0;
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const hasEq = /[=＝≈]|\\implies|\\Rightarrow/.test(t);
      const hasMath = /\$|\\htmlData|\\frac|\\dfrac|\\begin\{/.test(t);
      if (hasEq && hasMath) n += 1;
    }
    return n;
  }

  function extractNotes(body) {
    const notes = [];
    let m;
    const re = new RegExp(NOTE_ATTR_RE.source, 'g');
    while ((m = re.exec(body)) !== null) {
      notes.push(String(m[1] || '').trim());
    }
    return notes;
  }

  function findVagueNotes(notes) {
    return notes.filter((n) => VAGUE_NOTE_RE.test(n));
  }

  /**
   * @returns {{ ok: boolean, htmlDataCount: number, eqLineCount: number, issues: string[], vagueNotes: string[], summary: string }}
   */
  function check(text, opts) {
    opts = opts || {};
    const body = stripAnswer(text);
    const htmlDataCount = countHtmlData(body);
    const eqLineCount = countEquationLines(body);
    const notes = extractNotes(body);
    const vagueNotes = findVagueNotes(notes);
    const issues = [];

    const minEq = opts.minEqLines != null ? opts.minEqLines : 3;
    /** 以最末行可能不標 NOTE 估算，略降門檻 */
    const effectiveLines = Math.max(1, eqLineCount - 1);
    const minNotes = opts.minNotes != null
      ? opts.minNotes
      : Math.max(2, Math.ceil(effectiveLines * 0.35));

    if (eqLineCount < minEq) {
      return {
        ok: true,
        htmlDataCount,
        eqLineCount,
        issues: [],
        vagueNotes,
        summary: '算式行數少，略過 NOTE 密度檢查',
        skipped: true,
      };
    }

    if (htmlDataCount === 0) {
      issues.push('未發現 \\htmlData（關鍵數可能皆未標 NOTE）');
    } else if (htmlDataCount < minNotes) {
      issues.push(`NOTE 偏少（${htmlDataCount} 個，建議至少約 ${minNotes} 個）`);
    }

    if (htmlDataCount <= 1 && eqLineCount >= 4) {
      issues.push('可能只在最終答案標 NOTE，缺少乘積因子或分數分子');
    }

    if (vagueNotes.length) {
      issues.push(`note 過泛：${vagueNotes.slice(0, 3).join('、')}`);
    }

    const ok = issues.length === 0;
    const summary = ok
      ? `NOTE ${htmlDataCount} 處／算式行 ${eqLineCount}`
      : issues.join('；');

    return {
      ok,
      htmlDataCount,
      eqLineCount,
      issues,
      vagueNotes,
      summary,
      skipped: false,
    };
  }

  global.NoteCheck = {
    check,
    VAGUE_NOTE_RE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
