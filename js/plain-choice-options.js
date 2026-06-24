/** 純詳解模式：選項 (A)～(E) 上下排列＋說明文字懸掛縮排 */

const CHOICE_LABEL_RE = /^(?:\(|（)([A-E])(?:\)|）)\s*(.*)$/s;
const PUNCT_ONLY_RE = /^[、,，.。；;：:\s]+$/;

function isPunctuationOnly(text) {
  const t = String(text || '').trim();
  return !t || PUNCT_ONLY_RE.test(t);
}

/** 選項後須有實質說明（非僅標點或空白） */
function hasSubstantiveChoiceBody(body) {
  const t = String(body || '').trim();
  if (!t || isPunctuationOnly(t)) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return true;
  if (/\$|\\[a-zA-Z{]/.test(t)) return true;
  if (/[A-Za-z0-9]{2,}/.test(t)) return true;
  return t.length >= 4;
}

/** 答案標示列，如 (C)、(D) 或 答案：(C)、(D) — 不做選項評析排版 */
function isAnswerCitationLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const body = t.replace(/^(?:答案|故|選(?:項)?)[：:]\s*/, '');
  if (/^(?:(?:\(|（)[A-E](?:\)|）)\s*[、,，\s]*)+$/.test(body)) return true;
  if (/^(?:\(|（)[A-E](?:\)|）)\s*[、,，.]?\s*$/.test(t)) return true;
  return false;
}

function isChoiceOptionLine(text) {
  return CHOICE_LABEL_RE.test(String(text || '').trim());
}

function parseChoiceLine(text) {
  const m = String(text || '').trim().match(CHOICE_LABEL_RE);
  if (!m) return null;
  return { letter: m[1], body: (m[2] || '').trim() };
}

/** 同一行多個 (A)(B)… 拆成多段 */
function splitInlineChoices(text) {
  const t = String(text || '').trim();
  if (!t) return [];

  const re = /(?:\(|（)[A-E](?:\)|）)/g;
  const indices = [];
  let m;
  while ((m = re.exec(t))) indices.push(m.index);

  if (!indices.length) return [];
  if (indices.length === 1) {
    return isChoiceOptionLine(t) ? [t] : [];
  }

  const parts = [];
  for (let i = 0; i < indices.length; i++) {
    parts.push(t.slice(indices[i], indices[i + 1] ?? t.length).trim());
  }
  return parts.filter(p => isChoiceOptionLine(p));
}

function buildChoiceOptionHtml(letter, body) {
  const inner = body || '&nbsp;';
  return `<div class="choice-option"><span class="choice-label">(${letter})</span><div class="choice-body">${inner}</div></div>`;
}

function wrapPlainLineAsChoices(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;
  if (isAnswerCitationLine(trimmed)) return null;

  const parts = splitInlineChoices(trimmed);
  if (!parts.length) return null;

  const validParts = parts.filter(p => {
    const parsed = parseChoiceLine(p);
    return parsed && hasSubstantiveChoiceBody(parsed.body);
  });
  if (!validParts.length) return null;

  // 同一行混有「答案標示」(C)、 與完整評析時，整行維持一般排版
  if (parts.length > 1 && validParts.length < parts.length) return null;

  const blocks = validParts.map(p => {
    const parsed = parseChoiceLine(p);
    return parsed ? buildChoiceOptionHtml(parsed.letter, parsed.body) : '';
  }).filter(Boolean).join('');

  return blocks
    ? `<div class="plain-line plain-line--choice"><div class="choice-option-group">${blocks}</div></div>`
    : null;
}
