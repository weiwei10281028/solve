/**
 * js/math-note/note-ensure.js — NOTE 不足時自動重寫（不依賴 DATABASE）
 */
(function (global) {
  'use strict';

  function buildNoteFixUserText(report) {
    const issues = (report && report.issues) || [];
    const have = report?.htmlDataCount ?? 0;
    const need = report?.densityFloor ?? report?.minNotes ?? 5;
    const lines = [
      '【NOTE 修正｜只補標註，不改推導、選項判斷或 @@ANSWER@@】',
      `目前 ${have} 個 NOTE，建議至少 ${need} 個。只補題目給定量、第一次中間量、換算因子及分式／乘積中語意不同的因子。`,
      '格式為 $\\htmlData{note=具體白話語意}{數值或式子}$；勿用「質量、濃度、數值、結果」等空泛 note，也不可有「（）」「()」空括弧。分子分母不同意義時分開標；最終答案可不標。',
      '化學量題須使用正確名稱：元素係數寫「原子量」、分子寫「分子量」、化學式單位寫「式量」、每莫耳質量才寫「莫耳質量」；粒子數換算須標「阿伏加德羅常數」或「個數轉莫耳數」。',
    ];
    if (issues.length) {
      lines.push('【待修正】' + issues.join('；'));
    }
    return lines.join('\n');
  }

  /**
   * NOTE 不足時追加一輪 API 重寫
   * @param {Function} callAPI - 與 app.js 相同簽名
   */
  async function ensureDensityReply(callAPI, cfg, apiMessages, systemText, reply, genOpts = {}) {
    const checkFn = global.NoteCheck && global.NoteCheck.check;
    if (!checkFn || typeof callAPI !== 'function') return reply;

    const maxFix = genOpts.maxNoteFix != null ? genOpts.maxNoteFix : 1;
    let fixCount = Number(genOpts._noteFixed) || 0;
    let current = reply;
    let report = checkFn(current, genOpts.noteCheckOpts);

    if (report.ok || report.skipped || !report.needsFix) return current;
    if (fixCount >= maxFix) return current;

    console.warn('[NOTE 檢查] 密度不足，自動重寫：', report.summary);

    while (fixCount < maxFix) {
      const fixMessages = [
        ...apiMessages,
        { role: 'assistant', content: current },
        { role: 'user', content: buildNoteFixUserText(report) }
      ];
      try {
        const { text: fixed } = await callAPI(cfg, fixMessages, systemText, {
          ...genOpts,
          maxContinue: 0,
          temperature: genOpts.noteFixTemperature != null ? genOpts.noteFixTemperature : 0.2,
          _noteFixed: fixCount + 1
        });
        if (!fixed) break;
        current = fixed;
        fixCount += 1;
        report = checkFn(current, genOpts.noteCheckOpts);
        if (report.ok || report.skipped) return current;
      } catch (err) {
        console.warn('[NOTE 修正] 重試失敗', err);
        break;
      }
    }
    return current;
  }

  global.NoteEnsure = {
    buildNoteFixUserText,
    ensureDensityReply
  };
})(typeof window !== 'undefined' ? window : globalThis);
