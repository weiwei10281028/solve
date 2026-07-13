/**
 * js/math-note/note-check.js — NOTE 密度驗收（配合 note-ensure.js 可觸發自動重寫）
 */
(function (global) {
  'use strict';

  /** 過泛 note（須具體化） */
  const VAGUE_NOTE_RE = /^(質量|濃度|莫耳數|原子量|分子量|式量|體積|時間|常數|數值|結果)$/;

  const UNIT_ONLY_NOTE_BODY_RE = /^(?:\\(?:text|mathrm)\{\s*)?(?:mL|mol|kg|mg|g|L|M|min|s|h|atm|kPa|Pa|K|%)(?:\s*\})?$/i;
  const PHYSICAL_NOTE_RE = /(?:體積|質量|重量|濃度|莫耳數|物質量|時間|壓力|溫度|密度)/;
  const NOTE_UNIT_RE = /(?:mL|mol|kg|mg|g|L|M|min|s|h|atm|kPa|Pa|K|%)/i;

  function stripAnswer(text) {
    return String(text || '').split('@@ANSWER@@')[0];
  }

  function closeBraceIndex(text, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) return i;
    }
    return -1;
  }

  /** 同時檢查 htmlData 的兩組大括號；可正確讀取 note=Cu^{2+} 這類內容。 */
  function readHtmlData(body) {
    const text = String(body || '');
    const notes = [];
    let invalidCount = 0;
    let unitOnlyCount = 0;
    let pos = 0;
    while (true) {
      const start = text.indexOf('\\htmlData', pos);
      if (start < 0) break;
      const attrOpen = text.indexOf('{', start + 9);
      const attrClose = attrOpen >= 0 ? closeBraceIndex(text, attrOpen) : -1;
      const bodyOpen = attrClose >= 0 ? attrClose + 1 : -1;
      const bodyClose = bodyOpen >= 0 && text[bodyOpen] === '{' ? closeBraceIndex(text, bodyOpen) : -1;
      if (attrClose < 0 || bodyClose < 0) {
        invalidCount++;
        pos = start + 9;
        continue;
      }
      const attr = text.slice(attrOpen + 1, attrClose);
      const value = text.slice(bodyOpen + 1, bodyClose);
      if (UNIT_ONLY_NOTE_BODY_RE.test(String(value || '').trim())) unitOnlyCount++;
      const note = attr.match(/(?:^|,)\s*note=([\s\S]*)$/);
      if (!note || !String(note[1] || '').trim()) invalidCount++;
      else notes.push(String(note[1]).trim());
      pos = bodyClose + 1;
    }
    return { count: (text.match(/\\htmlData\{/g) || []).length, notes, invalidCount, unitOnlyCount };
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

  function findVagueNotes(notes) {
    return notes.filter((n) => VAGUE_NOTE_RE.test(n) || /^(?:該|某)?(?:數字|數值|結果|物理量|因子|量)$/.test(n));
  }

  /** 題目中的物理量數字須在 NOTE 標籤交代原始單位；公式本體仍維持簡潔。 */
  function findPhysicalNotesWithoutUnit(notes) {
    return notes.filter((n) => PHYSICAL_NOTE_RE.test(n) && !NOTE_UNIT_RE.test(n));
  }

  /** 速率比、時間比與最後時間代入是本工具的教學重點，不能被前段 NOTE 密度掩蓋。 */
  function findUnderNotedRateTimeSteps(body) {
    const issues = [];
    const lines = String(body || '').split('\n').map((line) => String(line || '').trim());
    const noteCount = (line) => (line.match(/\\htmlData\{/g) || []).length;
    const rateLine = lines.find((line) => /速率比|(?:r['′]?\s*\/\s*r['′]?)|\\dfrac\{r/.test(line) && /[=＝≈]/.test(line));
    if (rateLine && noteCount(rateLine) < 4) {
      issues.push('速率比推導 NOTE 不足；四個濃度代入值應各自標示');
    }
    const timeRatioLine = lines.find((line) => /時間比|(?:t[_′']?\s*\/\s*t[_′']?)|\\dfrac\{t/.test(line) && /[=＝≈]/.test(line));
    if (timeRatioLine && noteCount(timeRatioLine) < 1) {
      issues.push('時間比推導缺 NOTE；須標示速率比取倒數的意義');
    }
    const finalTimeLine = lines.find((line) => /(?:^|[\s$])t_?\{?\d+\}?\s*[=＝]/.test(line) && /(?:\\times|×|\\cdot)/.test(line));
    if (finalTimeLine && noteCount(finalTimeLine) < 2) {
      issues.push('最後時間代入 NOTE 不足；已知時間與時間比都要標示');
    }
    return issues;
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
    const htmlData = readHtmlData(body);
    const htmlDataCount = htmlData.count;
    const eqLineCount = countEquationLines(body);
    const notes = htmlData.notes;
    const vagueNotes = findVagueNotes(notes);
    const unitlessPhysicalNotes = findPhysicalNotesWithoutUnit(notes);
    const issues = [];

    const minEq = opts.minEqLines != null ? opts.minEqLines : 3;
    /** 以最末行可能不標 NOTE 估算，略降門檻 */
    const effectiveLines = Math.max(1, eqLineCount - 1);
    const minNotes = opts.minNotes != null
      ? opts.minNotes
      : Math.max(3, Math.ceil(effectiveLines * 0.7));

    const hasNestedFrac = /\\dfrac\{[^}]*\\dfrac/.test(body) || /\\dfrac\{[^}]*\\frac/.test(body);
    const hasChoiceMath = /^\([A-E]\)/m.test(body) && /\\dfrac|\\frac/.test(body);
    const densityFloor = hasNestedFrac || hasChoiceMath
      ? Math.max(minNotes, Math.ceil(effectiveLines * 0.9))
      : minNotes;

    if (eqLineCount < minEq && !htmlData.unitOnlyCount) {
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

    if (htmlData.invalidCount) {
      issues.push(`NOTE 語法不完整（${htmlData.invalidCount} 處）；請檢查 \\htmlData 的 note 與內容大括號`);
    }

    if (htmlData.unitOnlyCount) {
      issues.push(`NOTE 不可只包單位（${htmlData.unitOnlyCount} 處）；請改為包數字／因子，單位寫在 note 標籤`);
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

    if (unitlessPhysicalNotes.length) {
      issues.push(`物理量 NOTE 缺單位：${unitlessPhysicalNotes.slice(0, 3).join('、')}（如體積（mL））`);
    }

    const bareFracIssues = findBareConcentrationFractions(body);
    for (const bi of bareFracIssues) {
      if (!issues.includes(bi)) issues.push(bi);
    }

    for (const ri of findUnderNotedRateTimeSteps(body)) {
      if (!issues.includes(ri)) issues.push(ri);
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
