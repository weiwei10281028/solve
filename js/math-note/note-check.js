/**
 * js/math-note/note-check.js — NOTE 密度驗收（配合 note-ensure.js 可觸發自動重寫）
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

  /** 平衡 $K_c$ 代入行（表後單行分式）：不算 n/V 裸分式，避免 NoteEnsure 逼 AI 嵌套 htmlData */
  function isEquilibriumKcSubstLine(line) {
    const t = String(line || '');
    if (!/K[_c]|K_c|平衡常數/.test(t)) return false;
    if (!/\\(?:d)?frac|\(2[xX]\)|0\.\d+\s*-\s*[xX]/.test(t)) return false;
    return /\\(?:d)?frac\{[^}]*\}\{[^}]*\(2[xX]\)|\\(?:d)?frac\{[^}]*0\.[\d-]*[xX]?[^}]*\}\{[^}]*\(2[xX]\)/.test(t)
      || (/0\.2\s*-\s*[xX]/.test(t) && /\(2[xX]\)\^?\{?\s*2/.test(t));
  }

  /** 濃度分式 n/V、9/2V 等：分子或分母裸數字／裸 2V */
  function findBareConcentrationFractions(body) {
    const issues = [];
    const bareFracRe = /\\dfrac\{(?![^}]*\\htmlData)([^}]+)\}\{(?![^}]*\\htmlData)([^}]+)\}/g;
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (isEquilibriumKcSubstLine(t)) continue;
      if (!/\\dfrac|\\frac/.test(t) || !/[=＝≈]|\\dfrac.*\\dfrac|r['′]*\s*\/\s*r|r\s*\/\s*a/i.test(t)) continue;
      let m;
      const re = new RegExp(bareFracRe.source, 'g');
      while ((m = re.exec(t)) !== null) {
        const num = String(m[1] || '').trim();
        const den = String(m[2] || '').trim();
        const looksConc = /V|v|莫耳|mol|\d/.test(den) || /^\d+$/.test(num) || /\d\s*V|V/.test(den);
        if (!looksConc) continue;
        if (!/\\htmlData/.test(num) && (/^\d+$/.test(num) || /^\d+\s*$/.test(num))) {
          issues.push(`分式分子 ${num} 未標 NOTE（如莫耳數 9、6）`);
        }
        if (!/\\htmlData/.test(den) && (/\d*\s*V/i.test(den) || /^V$/i.test(den) || /^\d+$/.test(den))) {
          issues.push(`分式分母 ${den} 未標 NOTE（如 V、2V、總莫耳）`);
        }
      }
      if (issues.length >= 4) break;
    }
    return [...new Set(issues)].slice(0, 4);
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
      : Math.max(5, Math.ceil(effectiveLines * 0.85));

    const hasNestedFrac = /\\dfrac\{[^}]*\\dfrac/.test(body) || /\\dfrac\{[^}]*\\frac/.test(body);
    const hasChoiceMath = /^\([A-E]\)/m.test(body) && /\\dfrac|\\frac/.test(body);
    const densityFloor = hasNestedFrac || hasChoiceMath
      ? Math.max(minNotes, Math.ceil(effectiveLines * 0.9))
      : minNotes;

    if (eqLineCount < minEq) {
      return {
        ok: true,
        htmlDataCount,
        eqLineCount,
        issues: [],
        vagueNotes,
        summary: '算式行數少，略過 NOTE 密度檢查',
        skipped: true,
        needsFix: false,
      };
    }

    if (htmlDataCount === 0) {
      issues.push('未發現 \\htmlData（關鍵數可能皆未標 NOTE）');
    } else if (htmlDataCount < densityFloor) {
      issues.push(`NOTE 偏少（${htmlDataCount} 個，建議至少約 ${densityFloor} 個）`);
    }

    if (htmlDataCount <= 1 && eqLineCount >= 4) {
      issues.push('可能只在最終答案標 NOTE，缺少乘積因子或分數分子');
    }

    if (hasNestedFrac && htmlDataCount < Math.max(3, Math.ceil(effectiveLines * 0.5))) {
      issues.push('含巢狀分式時，分子／分母內關鍵數宜分標 \\htmlData');
    }

    if (vagueNotes.length) {
      issues.push(`note 過泛：${vagueNotes.slice(0, 3).join('、')}`);
    }

    const bareFracIssues = findBareConcentrationFractions(body);
    for (const bi of bareFracIssues) {
      if (!issues.includes(bi)) issues.push(bi);
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
      minNotes: densityFloor,
      densityFloor,
      needsFix: !ok,
    };
  }

  global.NoteCheck = {
    check,
    VAGUE_NOTE_RE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
