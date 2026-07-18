/* 單一提示詞入口：題目本身，加上使用者明確點選的進階規則。 */
function parseRequestedSolveScope(input) {
  const text = String(input || '');
  const numbers = [...text.matchAll(/第\s*(\d+)\s*題/g)].map(match => match[1]);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'default', numbers: [] };
}

function parseSolveIntent(input) {
  const scope = parseRequestedSolveScope(input);
  return { questionMode: scope.mode, numbers: scope.numbers, optionMode: 'all', options: [] };
}

window.parseSolveIntent = parseSolveIntent;
window.buildSolveUserText = function (scopeInput, refAnswer, opts = {}) {
  const scope = parseRequestedSolveScope(scopeInput || opts.questionBody);
  const question = String(opts.questionBody || scopeInput || '').trim();
  let text = `【題目】\n${question}`;
  if (scope.mode === 'partial') text += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  if (refAnswer) text += `\n\n【指定正確答案｜不可違反】${String(refAnswer).trim()}\n此答案是本題唯一允許輸出的最終答案。先依題目計算關鍵量，再逐項驗證；若初步推導不符，必須回查公式、物種濃度、單位與選項判斷後修正。每個選項的正確／錯誤判定集合、推導結論與 answer 欄必須完全符合指定答案。輸出前逐一核對；任何一處不一致都不得輸出，必須重做。不得提及答案來源，也不得為了湊答案省略推導。`;
  return text;
};

window.buildFollowUpUserText = function (followText) {
  return `【追問】\n${String(followText || '').trim()}`;
};

window.getSystemPromptForSolve = async function () {
  return window.SolutionCore?.buildSystem?.() || '';
};

window.getSystemPromptForFollowUp = async function () {
  return '你是台灣高中化學老師。使用繁體中文，直接回答追問；公式用 $...$，不要輸出 HTML 或 NOTE 語法。';
};

window.checkSolutionBoardStyle = function () { return []; };
window.checkChoiceAnalysisCompleteness = function () { return []; };

var buildSolveUserText = window.buildSolveUserText;
var buildFollowUpUserText = window.buildFollowUpUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;
