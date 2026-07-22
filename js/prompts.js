/* 單一提示詞入口：題目本身，加上使用者明確點選的進階規則。 */
function parseRequestedSolveScope(input) {
  const text = String(input || '');
  const numbers = [...text.matchAll(/第\s*(\d+)\s*題/g)].map(match => match[1]);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'default', numbers: [] };
}

/** 通則卡與章節規格置於題目前，僅提供本題需要的化學條件。 */
window.buildSolveConstraintPrefix = function (advancedBlock, chemRuleBlock) {
  const advanced = String(advancedBlock || '').trim();
  const chemRule = String(chemRuleBlock || '').trim();
  if (!advanced && !chemRule) return '';
  const parts = [];
  if (chemRule) parts.push(chemRule);
  if (advanced) parts.push(advanced);
  return parts.join('\n\n');
};

window.assembleSolveUserContent = function (questionText, advancedBlock, chemRuleBlock) {
  const scope = parseRequestedSolveScope(questionText);
  let questionBody = String(questionText || '').trim();
  if (scope.mode === 'partial') questionBody += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  const question = `【題目】\n${questionBody}`;
  const constraintPrefix = window.buildSolveConstraintPrefix(advancedBlock, chemRuleBlock);
  const fullText = constraintPrefix ? `${constraintPrefix}\n\n${question}` : question;
  return { constraintPrefix, questionBody: question, fullText };
};

window.buildSolveUserText = function (scopeInput, _refAnswer, opts = {}) {
  const question = String(opts.questionBody || scopeInput || '').trim();
  const scope = parseRequestedSolveScope(scopeInput || opts.questionBody);
  let text = `【題目】\n${question}`;
  if (scope.mode === 'partial') text += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  return text;
};

window.buildAnswerVerificationUserText = function (scopeInput, refAnswer, opts = {}, advancedBlock = '', chemRuleBlock = '') {
  const question = String(opts.questionBody || scopeInput || '').trim();
  const constraintPrefix = window.buildSolveConstraintPrefix(advancedBlock, chemRuleBlock);
  const parts = [];
  if (constraintPrefix) parts.push(constraintPrefix);
  parts.push(
    `【題目】\n${question}`,
    `【待驗證參考答案】${String(refAnswer || '').trim()}`,
    '請完全重新計算，不預設參考答案正確。先由題目獨立得到關鍵數值、守恆關係、物種分配、單位與選項判斷，再比較參考答案；若資料不足、計算矛盾或選項不符，consistent 必須為 false。這是內部檢查，禁止撰寫給學生看的詳解。'
  );
  return parts.join('\n\n');
};

window.buildFollowUpUserText = function (followText) {
  return `【追問】\n${String(followText || '').trim()}`;
};

window.getSystemPromptForSolve = async function () {
  return window.SolutionCore?.buildSystem?.() || '';
};

window.getSystemPromptForFollowUp = async function () {
  const notation = window.SolutionCore?.buildQuantityNotationPrompt?.('followup') || '';
  return `你是台灣高中化學老師。使用繁體中文，直接回答追問。一般化學式與離子可用一般文字或直接 AsciiMath（例：H3PO4、H3O+）。所有公式直接使用 AsciiMath；不使用 LaTeX、$、$$、Markdown、HTML、\\htmlData 或 NOTE。分式用 frac(分子)(分母)，根號用 sqrt(...)。\n${notation}`;
};

var buildSolveUserText = window.buildSolveUserText;
var buildAnswerVerificationUserText = window.buildAnswerVerificationUserText;
var buildFollowUpUserText = window.buildFollowUpUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;
