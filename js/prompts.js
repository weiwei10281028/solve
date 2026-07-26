/* 主解題固定為兩段：先產生審題備忘錄，再由解題 AI 輸出詳解。 */
function parseRequestedSolveScope(input) {
  const text = String(input || '');
  const numbers = [...text.matchAll(/第\s*(\d+)\s*題/g)].map(match => match[1]);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'default', numbers: [] };
}

const QUESTION_ANALYSIS_SYSTEM = `你是題目審題 AI。使用繁體中文，只做審題，不寫詳解，也不給最終答案。
完整讀取題目文字或圖片，保留題幹、選項、圖表資訊、數值與單位，整理成給下一個解題 AI 使用的簡潔備忘錄。
備忘錄依題型自然說明解題目標、可用條件、必要關係或計算、選項需要核對之處及任何辨識不確定處；不必硬湊固定項目。
只回傳指定 JSON，不得輸出 Markdown 或其他文字。`;

const QUESTION_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questionText', 'memo'],
  properties: {
    questionText: { type: 'string' },
    memo: { type: 'string' }
  }
};

window.buildQuestionAnalysisUserText = function (questionText) {
  const scope = parseRequestedSolveScope(questionText);
  let questionBody = String(questionText || '').trim();
  if (scope.mode === 'partial') questionBody += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  return questionBody
    ? `【題目或使用者補充】\n${questionBody}\n\n請完成審題並輸出本題解題備忘錄。`
    : '請完整讀取圖片中的題目，完成審題並輸出本題解題備忘錄。';
};

window.parseQuestionAnalysis = function (raw, fallbackQuestion = '') {
  try {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(text);
    const questionText = String(parsed?.questionText || fallbackQuestion || '').trim();
    const memo = String(parsed?.memo || '').trim();
    if (!questionText || !memo) return null;
    return { questionText, memo };
  } catch (_) {
    return null;
  }
};

window.assembleSolveUserContent = function (questionText, analysisMemo, advancedBlock, refAnswer, opts = {}) {
  const scope = parseRequestedSolveScope(questionText);
  let questionBody = String(questionText || '').trim();
  if (scope.mode === 'partial') questionBody += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;

  const parts = [
    `【原題】\n${questionBody}`,
    `【本題解題備忘錄｜僅供內部參考】\n${String(analysisMemo || '').trim()}`
  ];
  const advanced = String(advancedBlock || '').trim();
  if (advanced) parts.push(`【使用者啟用的進階設定】\n${advanced}`);

  const reference = String(refAnswer || '').trim();
  if (reference) {
    const mode = opts.verifyReference
      ? '請加強檢查關鍵數值、守恆、單位與每個選項後再對齊。'
      : '請完成必要計算與驗算後再對齊。';
    parts.push(`【待對齊參考答案】${reference}\n${mode}若參考答案與題目及正確推導相容，answer 與「選項分析」必須對齊；若確有矛盾，才可不對齊，且不得改寫題目條件或硬湊計算。`);
  }

  return {
    constraintPrefix: advanced,
    questionBody: `【原題】\n${questionBody}`,
    fullText: parts.join('\n\n')
  };
};

window.buildSolveUserText = function (scopeInput, _refAnswer, opts = {}) {
  const question = String(opts.questionBody || scopeInput || '').trim();
  const scope = parseRequestedSolveScope(scopeInput || opts.questionBody);
  let text = `【題目】\n${question}`;
  if (scope.mode === 'partial') text += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  return text;
};

window.buildFollowUpUserText = function (followText) {
  return `【追問】\n${String(followText || '').trim()}`;
};

window.getQuestionAnalysisSystem = function () {
  return QUESTION_ANALYSIS_SYSTEM;
};

window.getSystemPromptForSolve = async function () {
  return window.SolutionCore?.buildSystem?.() || '';
};

window.getSystemPromptForFollowUp = async function () {
  const notation = window.SolutionCore?.buildQuantityNotationPrompt?.('followup') || '';
  return `你是台灣高中化學老師。使用繁體中文，直接回答追問。回答計算題時，必須列出判斷答案所需的完整計算過程。一般化學式與離子可用一般文字或直接 AsciiMath（例：H3PO4、H3O+）。所有公式直接使用 AsciiMath；不使用 LaTeX、$、$$、Markdown、HTML、\\htmlData 或 NOTE。分式用 frac(分子)(分母)，根號用 sqrt(...)。\n${notation}`;
};

var buildSolveUserText = window.buildSolveUserText;
var buildFollowUpUserText = window.buildFollowUpUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;

window.QuestionAnalysisPrompt = Object.freeze({
  SYSTEM: QUESTION_ANALYSIS_SYSTEM,
  SCHEMA: QUESTION_ANALYSIS_SCHEMA
});
