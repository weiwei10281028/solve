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
      '【NOTE 修正｜只補標註，勿改推導與答案】',
      '在下方詳解原文上補足 $\\htmlData{note=白話短註}{數值或式子}$；',
      '化學推導、選項判斷、@@ANSWER@@ 須與修正前一致，禁止為了標 NOTE 改算式或改答案。',
      '',
      '【密度】',
      `目前約 ${have} 個 \\htmlData，至少需約 ${need} 個（含等號推導行須在式內標關鍵數）。`,
      '乘積各因子、分式分子與分母、比較式分子分母須分標；禁止只在最終答案標一個 NOTE。',
      '禁止 note=質量、note=濃度 等過泛詞；須寫清物理量語意（如「N₂莫耳數」「初態體積 V」「定壓新體積 2V」）。',
      '濃度分式 $\\dfrac{9}{2V}$、$\\dfrac{4}{V}$：**9、2V、4、V 各自**包 \\htmlData，禁止只標外層 $r\'/r_0$ 或最終比值。',
      '',
      '【$K_c$ 代入行】表後只一行 $…$；分子、分母各一個 \\htmlData 即可（共 2 個）。**只補 NOTE，禁止**改 \\dfrac 大括號、禁止嵌套第二層通式、禁止 \\濃度。',
      '速率比較式分母須與分子對稱展開（$k\\cdot\\dfrac{n}{V}\\cdot\\dfrac{n}{V}$），禁止分母寫 $\\dfrac{4k}{V^2}$ 等預先合併式。',
      '',
      '【寫法範例（模式，數值依題）】',
      '$n = \\dfrac{\\htmlData{note=沉澱物質量}{8.00}}{\\htmlData{note=式量}{100}} = 0.08$',
      '$\\dfrac{r\'}{a}=\\dfrac{k \\cdot \\dfrac{\\htmlData{note=加N_2後莫耳數}{9}}{\\htmlData{note=定壓新體積}{2V}} \\cdot \\dfrac{\\htmlData{note=H_2莫耳數}{1}}{\\htmlData{note=定壓新體積}{2V}}}{k \\cdot \\dfrac{\\htmlData{note=初態N_2莫耳數}{4}}{\\htmlData{note=初態體積}{V}} \\cdot \\dfrac{1}{V}}=\\dfrac{9}{16}\\text{，}\\quad\\text{故 }r\'=\\dfrac{9}{16}a$',
      '',
    ];
    if (issues.length) {
      lines.push('【待修正】' + issues.join('；'));
    }
    if (global.NoteRules && typeof global.NoteRules.buildAppendixText === 'function') {
      lines.push(global.NoteRules.buildAppendixText({}));
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
