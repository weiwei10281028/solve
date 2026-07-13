/**
 * js/math-note/note-rules.js — NOTE 標註核心規格
 * 題型細節放在 note-presets.js，避免每題注入冗長且重複的提示詞。
 */
(function (global) {
  'use strict';

  function buildAppendixText() {
    return [
      '',
      '[NOTE 規格｜和推導同一輪完成，不另寫 NOTE 說明]',
      'NOTE 只解釋「這一步的數值或因子代表什麼」，不得為了標註改變推導、數值或答案。',
      '在含等號的計算式中，優先標：題目給定量、第一次求得的中間量、換算因子，以及乘積／分式中語意不同的因子。',
      '寫法：$\\htmlData{note=4～12字白話語意}{數值或式子}$；note 要具體且物理量帶原始單位，如「HCl莫耳數（mol）」「30 mL 轉成 L」「平衡時濃度（M）」，不可只寫「質量、濃度、數值、結果」。',
      '最終所求答案與已解釋過的重複量可省略。短題或少於 3 行算式時不必為密度硬加 NOTE。',
      '分子、分母代表不同物理量時分開標；$K_c$ 單行代入只標分子、分母各一次。',
      '算式內不塞中間單位文字；每段最後結果與 @@ANSWER@@ 要有單位。除法用 \\dfrac，尤其質量÷莫耳質量；化學式用 $CO_2$、$H^+$；不可把 $ 單獨占一行。',
    ].join('\n');
  }

  global.NoteRules = { buildAppendixText };
})(typeof window !== 'undefined' ? window : globalThis);
