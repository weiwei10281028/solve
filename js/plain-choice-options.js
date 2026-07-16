/** 純詳解模式：選項 (A)～(E) 上下排列＋說明文字懸掛縮排；多行收進同一選項；步驟標籤併算式 */

// 選項數量由題目決定；不把規則鎖死在 (A)～(E)。
const CHOICE_LABEL_RE = /^(?:\(|（)([A-Z])(?:\)|）)\s*(.*)$/s;
const PUNCT_ONLY_RE = /^[、,，.。；;：:\s]+$/;
const CHEM_STEP_LABEL_RE = /^(?:總溶質|總重|溶質|溶液|濃度|分子量|原子數|莫耳數|莫耳分率|體積|質量|分壓|密度|係數|反應量|剩餘率|變化量|初始|變化|結果)$/;

const OPTION_ANALYSIS_HEADING_RE = /^各選項分析如下[：:]?$/;

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
  if (/^(?:(?:\(|（)[A-Z](?:\)|）)\s*[、,，\s]*)+$/.test(body)) return true;
  if (/^(?:\(|（)[A-Z](?:\)|）)\s*[、,，.]?\s*$/.test(t)) return true;
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

  const re = /(?:\(|（)[A-Z](?:\)|）)/g;
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
  return buildChoiceOptionBlock(letter, [body]);
}

function isChemStepLabelLine(text) {
  const t = String(text || '').trim().replace(/[：:，,。.．；;]+$/, '');
  if (!t || t.length > 10) return false;
  return CHEM_STEP_LABEL_RE.test(t);
}

function lineLooksLikeMathContinuation(line) {
  const t = String(line || '').trim();
  if (!t || isChemStepLabelLine(t) || isChoiceOptionLine(t)) return false;
  if (isAnswerCitationLine(t) || /^答[：:]/.test(t)) return false;
  return /\$\$|\\\$|\\begin\{|\\dfrac|\\frac|\\times|≈|＝|=/u.test(t) || /^\d/.test(t);
}

/** 行尾為「，濃度」「，總重」等、下一行是算式 → 併成同一行 */
function lineEndsAwaitingMath(text) {
  const t = String(text || '').trim();
  if (!t || /[。.．！？]$/.test(t)) return false;
  if (/[：:]$/.test(t)) return true;
  if (/[\x00]M\d+[\x00]\s*[，,]$/.test(t)) return true;
  return /(?:，|,|：|:|\s)(溶劑|溶質|總重|濃度|溶液|分子量|莫耳數|體積|質量|分壓|反應量|剩餘率)\s*$/.test(t);
}

function mergeTailLabelWithNextMath(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = String(lines[i] ?? '');
    while (i + 1 < lines.length) {
      let ni = i + 1;
      let nt = String(lines[ni] ?? '').trim();
      if ((nt === '$' || nt === '$$') && ni + 1 < lines.length) {
        const after = String(lines[ni + 1] ?? '').trim();
        if (lineLooksLikeMathContinuation(after)) {
          ni += 1;
          nt = after;
        }
      }
      if (
        !lineEndsAwaitingMath(cur)
        || !lineLooksLikeMathContinuation(nt)
        || /\\begin\{cases\}|^\$\$/.test(nt)
      ) {
        break;
      }
      cur = `${cur.trim()} ${nt}`;
      i = ni;
    }
    out.push(cur);
  }
  return out;
}

function mergeSplitWordLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = String(lines[i] ?? '');
    while (i + 1 < lines.length) {
      const ct = cur.trimEnd();
      const nt = String(lines[i + 1] ?? '').trimStart();
      if (/總$/.test(ct) && /^重/.test(nt)) {
        cur = ct + nt;
        i++;
        continue;
      }
      if (/溶$/.test(ct) && /^質/.test(nt)) {
        cur = ct + nt;
        i++;
        continue;
      }
      if (/分$/.test(ct) && /^子/.test(nt)) {
        cur = ct + nt;
        i++;
        continue;
      }
      if (/濃$/.test(ct) && /^度/.test(nt)) {
        cur = ct + nt;
        i++;
        continue;
      }
      if (/(?:\$\$|\\begin\{cases\})(?:\s*[。．.,，])?\s*$/.test(ct) && /^倍[，,]/.test(nt)) {
        cur = `${ct} ${nt}`;
        i++;
        continue;
      }
      break;
    }
    out.push(cur);
  }
  return out;
}

function mergePlainLineFragments(lines) {
  const cleaned = lines.filter((l) => {
    const t = String(l ?? '').trim();
    return t !== '$' && t !== '$$';
  });
  return mergeTailLabelWithNextMath(
    mergeChemStepLabelLines(mergeSplitWordLines(mergeMultilineDisplayMath(cleaned)))
  );
}

/** 單獨一行的「總重」「濃度」等併入下一行算式 */
function mergeChemStepLabelLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = String(lines[i] ?? '');
    const next = lines[i + 1];
    if (next !== undefined && isChemStepLabelLine(cur) && lineLooksLikeMathContinuation(next)) {
      out.push(`${cur.trim()} ${String(next).trim()}`);
      i++;
    } else {
      out.push(cur);
    }
  }
  return out;
}

function shouldStopChoiceCollect(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (isChoiceOptionLine(t)) return true;
  if (isAnswerCitationLine(t)) return true;
  if (/^答[：:]/.test(t) || /^\*\*答/.test(t)) return true;
  if (/^第\s*[\d一二三四五六七八九十]+\s*題/.test(t)) return true;
  if (/^【\s*第\s*[\d一二三四五六七八九十]+\s*題/.test(t)) return true;
  if (/^\d{1,2}\.\s*(?:[\u4e00-\u9fff$\\(]|$)/.test(t)) return true;
  return false;
}

/** 將 (A)～(E) 底下連續行收進同一選項區塊 */
function groupPlainLinesForLayout(lines) {
  const result = [];
  const arr = lines.map(l => String(l ?? ''));
  let i = 0;

  while (i < arr.length) {
    const trimmed = arr[i].trim();
    if (!trimmed) { i++; continue; }

    const choice = parseChoiceLine(trimmed);
    if (choice) {
      const steps = [];
      if (choice.body) steps.push(choice.body);
      i++;
      let collected = 0;
      while (i < arr.length) {
        const nextTrim = arr[i].trim();
        if (!nextTrim) { i++; continue; }
        if (shouldStopChoiceCollect(arr[i])) break;
        steps.push(arr[i]);
        collected++;
        i++;
      }
      if (choice.body || collected > 0) {
        result.push({ type: 'choice', letter: choice.letter, steps });
        continue;
      }
    }

    result.push({ type: 'line', text: arr[i] });
    i++;
  }
  return result;
}

function coalesceChoiceGroups(groups) {
  const out = [];
  let buf = [];
  for (const g of groups) {
    if (g.type === 'choice') {
      buf.push(g);
    } else {
      if (buf.length) {
        out.push({ type: 'choice-group', items: buf.splice(0) });
      }
      out.push(g);
    }
  }
  if (buf.length) out.push({ type: 'choice-group', items: buf });
  return out;
}

function buildChoiceOptionBlock(letter, steps) {
  const merged = mergePlainLineFragments(steps || []);
  const letterUp = String(letter || '').toUpperCase();
  if (merged.length <= 1) {
    const body = String(merged[0] || '').trim() || '&nbsp;';
    return `<div class="choice-option">` +
      `<span class="choice-label">(${letterUp})</span>` +
      `<div class="choice-body"><div class="plain-line-inner">${body}</div></div></div>`;
  }
  const stepsHtml = merged.map((step) => {
    const inner = String(step || '').trim() || '&nbsp;';
    return `<div class="choice-step"><div class="plain-line-inner">${inner}</div></div>`;
  }).join('');
  return `<div class="choice-option choice-option--multistep">` +
    `<span class="choice-label">(${letterUp})</span>` +
    `<div class="choice-body choice-body--steps">${stepsHtml}</div></div>`;
}

function buildChoiceGroupHtml(items) {
  const blocks = items.map((g) => buildChoiceOptionBlock(g.letter, g.steps)).join('');
  return `<div class="plain-line plain-line--choice"><div class="choice-option-group">${blocks}</div></div>`;
}

function classifyPlainLine(line) {
  const t = String(line || '').trim();
  if (!t) return 'empty';
  if (OPTION_ANALYSIS_HEADING_RE.test(t)) return 'choice-heading';
  if (/^【[^【】]+】$/.test(t)) return 'section';
  if (/^第\s*[\d一二三四五六七八九十]+\s*題/.test(t)) {
    return (typeof window !== 'undefined' && typeof window.isSolveQuestionHeadingAllowed === 'function'
      && window.isSolveQuestionHeadingAllowed(t)) ? 'section' : 'skip';
  }
  if (/^題目核心|^解題關鍵|^核心觀念/.test(t)) return 'skip';
  if (/^\(\d+\)/.test(t)) return 'step';
  return 'normal';
}

function renderPlainLayoutPart(g) {
  if (g.type === 'choice-group') {
    const items = g.items.map((item) => ({
      ...item,
      steps: mergePlainLineFragments(item.steps)
    }));
    return buildChoiceGroupHtml(items);
  }
  if (g.type === 'choice') {
    return buildChoiceGroupHtml([{ letter: g.letter, steps: mergePlainLineFragments(g.steps) }]);
  }
  const choiceHtml = wrapPlainLineAsChoices(g.text);
  if (choiceHtml) return choiceHtml;
  return wrapOnePlainLineInner(g.text);
}

/** 取代 wrapPlainLines：行像排列（選項收攏、步驟標籤併算式） */
function layoutPlainSolveText(escapedMultiline) {
  const rawLines = String(escapedMultiline || '').split('\n');
  const merged = mergePlainLineFragments(rawLines);
  const groups = coalesceChoiceGroups(groupPlainLinesForLayout(merged));
  return groups.map(g => renderPlainLayoutPart(g)).join('');
}

function wrapOnePlainLineInner(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || /^\$\s*$/.test(trimmed)) return '<div class="plain-line plain-line--empty"></div>';
  let cleaned = String(line);
  if (!/\$\$|\\begin\{/.test(cleaned)) {
    while (/\$(\s*)$/.test(cleaned) && (cleaned.match(/\$/g) || []).length % 2 === 1) {
      cleaned = cleaned.replace(/\$(\s*)$/, '$1');
    }
  }
  if (/reaction-table-stacked/.test(cleaned)) {
    return `<div class="plain-line plain-line--reaction"><div class="plain-line-inner">${cleaned}</div></div>`;
  }
  const kind = classifyPlainLine(cleaned);
  if (kind === 'skip') return '';
  if (kind === 'choice-heading') {
    return `<div class="plain-line plain-line--choice-heading"><div class="plain-line-inner">${cleaned}</div></div>`;
  }
  if (kind === 'section') {
    const title = cleaned.replace(/^【|】$/g, '');
    return `<div class="solve-section"><div class="solve-section-title">${title}</div></div>`;
  }
  if (kind === 'step') {
    return `<div class="plain-line plain-line--step"><div class="plain-line-inner">${cleaned}</div></div>`;
  }
  return `<div class="plain-line"><div class="plain-line-inner">${cleaned}</div></div>`;
}

function buildMultistepChoiceHtml(letter, steps) {
  return buildChoiceGroupHtml([{ letter, steps }]);
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
