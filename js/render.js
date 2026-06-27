/**
 * js/render.js — plain-line 渲染、簡答欄、KaTeX 後處理
 */

const BOARD_LAYOUT_ENABLED = false;
const ANSWER_MARKER = '@@ANSWER@@';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LATEX_ENV_NAMES = 'cases|array|aligned|matrix|pmatrix|bmatrix';

function isInsideDollarMath(str, index) {
  const before = String(str || '').slice(0, Math.max(0, index));
  let n = 0;
  for (const ch of before) if (ch === '$') n++;
  return n % 2 === 1;
}

function addCasesRowSpacing(block, env) {
  let b = String(block || '');
  if (env === 'array' && /\\rightleftharpoons|\\rightarrow/.test(b)) return b;
  if (env !== 'cases' && env !== 'array') return b;
  return b.replace(/\\\\(?!\[)/g, '\\\\[1.1em]');
}

/** 統一修正 LaTeX 區塊邊界（cases/array、巢狀 $、連續算式） */
function fixLatexBlocks(text) {
  let s = String(text || '');
  s = s.replace(/\\(?:d)?frac\{\s*\$\s*([^$]+?)\s*\$\s*\}\{\s*\$\s*([^$]+?)\s*\$\s*\}/g, '\\dfrac{$1}{$2}');
  s = s.replace(/\$\s*([0-9]+(?:\.[0-9]+)?(?:%|％)?)\s*\$/g, '$1');
  s = s.replace(/\$\s+(?=\\[a-zA-Z{])/g, '$');
  s = s.replace(/([^\n]*?)\$\s*(\\begin\{cases\}[\s\S]*?\\end\{cases\})\s*\$/g, (m, prefix, body) => {
    const p = String(prefix || '').trimEnd();
    return p ? `${p}\n\n$$${body}$$\n` : `$$${body}$$\n`;
  });
  s = s.replace(/([：:])\s*\$\s*(\\begin\{cases\}[\s\S]*?\\end\{cases\})\s*\$/g, '$1\n\n$$$2$$');

  const beginRe = new RegExp(`\\\\begin\\{(${LATEX_ENV_NAMES})\\}`, 'g');
  let out = '';
  let cursor = 0;
  let m;
  while ((m = beginRe.exec(s))) {
    const env = m[1];
    const beginIdx = m.index;
    const endTag = `\\end{${env}}`;
    const endIdx = s.indexOf(endTag, beginRe.lastIndex);
    if (endIdx < 0) continue;
    const blockEnd = endIdx + endTag.length;

    let before = s.slice(cursor, beginIdx).replace(/\${1,2}\s*$/, '').replace(/[ \t]+$/g, '');
    out += before;
    if (before && !/\n\s*\n$/.test(out)) out += '\n\n';

    out += `$$${addCasesRowSpacing(s.slice(beginIdx, blockEnd).replace(/\$/g, ''), env)}$$`;

    let next = blockEnd;
    while (s[next] === ' ' || s[next] === '\t') next++;
    if (s.startsWith('$$', next)) next += 2;
    else if (s[next] === '$') next += 1;
    if (next < s.length && s[next] !== '\n') out += '\n\n';

    cursor = next;
    beginRe.lastIndex = next;
  }
  out += s.slice(cursor);
  s = out.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/\$\$\s*(\$\$[\s\S]*?\$\$)\s*\$\$/g, '$1');
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => `$$${inner.replace(/\$/g, '')}$$`);
  s = s.replace(/(?<!\$)(\\mathrm\{[^{}]+\}(?:_\{?[^{}$]+\}?)?)/g, (match, cmd, off) => {
    if (isInsideDollarMath(s, off)) return match;
    return `$${cmd}$`;
  });
  s = s.split('\n').map((line) => {
    if (/\\begin\{|^\$\$/.test(line)) return line;
    if (!/\\frac|\\dfrac|\\times/.test(line)) return line;
    if ((line.match(/=/g) || []).length < 2 && !/≈|＝/.test(line)) return line;
    return line
      .replace(/(=\s*[\d.]+(?:%|％|\\%)?)\s+(?=\d+\s*[-+×]\s*[a-zA-Z(]|[a-zA-Z]\s*=)/g, '$1；\n')
      .replace(/(≈\s*[\d.]+(?:%|％|\\%)?)\s+(?=[a-zA-Z(])/gi, '$1；\n');
  }).join('\n');
  return s;
}

/** 裸寫 \\text{…} 包進 $…$ */
function repairBareTextMacros(text) {
  return String(text || '').replace(
    /(?<!\$)\\text\{([^{}]+)\}(_\{?[^{}$]+\}?)?/g,
    (m, inner, sub, off) => {
      if (isInsideDollarMath(text, off)) return m;
      return `$\\text{${inner}}${sub || ''}$`;
    }
  );
}

/** 裸寫分式、Δt 等片段包進 $…$ */
function wrapBareLatexSnippets(text) {
  return String(text || '').split('\n').map((line) => {
    if (/^\s*\$\$/.test(line)) return line;
    let s = line;
    s = s.replace(/(?<!\$)\\(?:d)?frac\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, (m, n, d, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$\\dfrac{${n}}{${d}}$`;
    });
    s = s.replace(/(?<!\$)(\\Delta\s+[A-Za-z_]+(?:_\{?[A-Za-z0-9]+\}?)?\s*[=≈＝]\s*[^，。；\n$]{1,80})(?!\$)/g, (m, expr, off) => {
      if (isInsideDollarMath(s, off) || /\$/.test(expr)) return m;
      return `$${expr.trim()}$`;
    });
    return s;
  }).join('\n');
}

const LATEX_ENV_RE = '\\begin\\{(?:array|aligned|matrix|pmatrix|bmatrix|cases)\\}[\\s\\S]*?\\end\\{(?:array|aligned|matrix|pmatrix|bmatrix|cases)\\}';
const ORPHAN_LATEX_LINE_RE = /^\\(?:text|mathrm|dfrac|frac|times|Rightarrow|htmlData|begin\{cases\}|end\{cases\})\b/;
const ORPHAN_CASES_ROW_RE = /^(?:[A-Z]\\text\{原子不滅\}|[A-Z]原子不滅|\\text\{[^}]*原子不滅[^}]*\})\s*[:：]/;

function buildCasesLatex(rows) {
  const body = rows
    .map((row) => {
      let r = String(row || '').trim();
      r = r.replace(/\s+(\d+)\s*\\\\\s*$/g, ' \\\\');
      r = r.replace(/^([A-Z])原子不滅/, '$1\\text{原子不滅}');
      return r;
    })
    .filter(Boolean)
    .join(' \\\\[1.1em] ');
  return `\\begin{cases} ${body} \\end{cases}`;
}

/** 移除 AI 常誤寫的總論段落 */
function dropCoreConceptLines(text) {
  return String(text || '').split('\n').filter((line) => {
    const t = line.trim();
    if (/^【核心觀念】/.test(t)) return false;
    if (/^【題目核心/.test(t)) return false;
    if (/^【解題關鍵/.test(t)) return false;
    return true;
  }).join('\n');
}

/** 裸寫的 cases 列（\\text{…}…\\\\）合併為 $$\\begin{cases}…\\end{cases}$$ */
function wrapOrphanCasesLineGroups(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let group = [];

  const flush = () => {
    if (!group.length) return;
    const parts = [];
    let cur = [];
    for (const row of group) {
      const t = String(row || '').trim();
      if (/^\\Rightarrow\b/.test(t)) {
        if (cur.length) parts.push(cur);
        cur = [];
        continue;
      }
      cur.push(t);
    }
    if (cur.length) parts.push(cur);
    const latex = parts.map((p) => buildCasesLatex(p)).join(' \\Rightarrow ');
    out.push(`$$${latex}$$`);
    group = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flush();
      out.push(line);
      continue;
    }
    if (/^\$\$[\s\S]+\$\$$/.test(t)) {
      flush();
      out.push(line);
      continue;
    }
    if (/^\$[^$]+\$$/.test(t) && /\\begin\{cases\}/.test(t)) {
      flush();
      out.push(t.replace(/^\$([\s\S]+)\$$/, '$$$1$$'));
      continue;
    }
    if (/^\$[^$]+\$$/.test(t) && !ORPHAN_LATEX_LINE_RE.test(t) && !ORPHAN_CASES_ROW_RE.test(t)) {
      flush();
      out.push(line);
      continue;
    }
    const isCasesFrag = ORPHAN_LATEX_LINE_RE.test(t)
      || ORPHAN_CASES_ROW_RE.test(t)
      || (group.length > 0 && /^[xyz]\s*=/.test(t))
      || (group.length > 0 && /^\\Rightarrow\b/.test(t));
    if (isCasesFrag) {
      group.push(t);
      continue;
    }
    flush();
    out.push(line);
  }
  flush();
  return out.join('\n');
}

/** 單行裸 LaTeX 指令包進 $…$ */
function wrapSingleOrphanLatexLines(text) {
  return String(text || '').split('\n').map((line) => {
    const t = line.trim();
    if (!t || /\$/.test(t)) return line;
    if (/^\\(?:text|mathrm|dfrac|frac|Rightarrow)\{/.test(t) || /^\\Rightarrow\s*$/.test(t)) {
      return `$${t}$`;
    }
    return line;
  }).join('\n');
}

/** 反應式與聯立大括號拆成獨立區塊 */
function organizeReactionCasesLayout(text) {
  let s = String(text || '');
  s = s.replace(
    /(反應式[為是][^$\n。]{0,160})\s*[,，]\s*(\$?\$?\\begin\{cases\}[\s\S]+?\\end\{cases\}[\s\S]*?\\end\{cases\}\$?\$?)/g,
    '$1\n\n$$$2$$\n'
  );
  s = s.replace(/\$\$\$+/g, '$$');
  s = s.replace(/\$\$\s*\$\$/g, '$$');
  return s;
}

function normalizeAiHeadings(text) {
  return String(text || '')
    .replace(/^#{1,6}\s*(.+)$/gm, '【$1】')
    .replace(/^\*\*([^*]+)\*\*\s*$/gm, '【$1】');
}

/** 修復 AI 輸出中殘留的 HTML 實體與斷裂的比較符 */
function repairGarbledEntities(text) {
  let s = String(text || '');
  s = s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  s = s.replace(/(\d)\s*gt;\s*\$/gi, '$1 > $');
  s = s.replace(/\$\s*gt;\s*/gi, '$ > ');
  s = s.replace(/\$([^$]+)\$\s*>\s*\$([^$]+)\$/g, '$$$1 > $2$$');
  s = s.replace(/([^\s$])\s*>\s*\$([^$]+)\$/g, '$1 $$$2$$');
  return s;
}

function dropNoiseLines(text) {
  return String(text || '').split('\n').filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/^【核心觀念】/.test(t)) return false;
    if (/^修正[：:]/u.test(t)) return false;
    if (/修正比例/u.test(t)) return false;
    return true;
  }).join('\n');
}

/** 合併斷行摘要，如「(B) 與」＋「(D) 皆為錯誤敘述。」 */
function mergeBrokenSummaryLines(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i];
    while (i + 1 < lines.length) {
      const t = cur.trim();
      const next = lines[i + 1].trim();
      if (!next) break;
      if (/\([A-E]\)\s*與\s*$/.test(t) && /^\([A-E]\)/.test(next)) {
        cur = `${t}${next}`;
        i++;
        continue;
      }
      if (/[與及、]\s*$/.test(t) && /^\([A-E]\)/.test(next) && next.length < 48) {
        cur = `${t}${next}`;
        i++;
        continue;
      }
      break;
    }
    out.push(cur);
  }
  return out.join('\n');
}

/** 移除詳解末尾重複總結（選項已評析過） */
function dropRedundantTailSummary(text) {
  const lines = String(text || '').split('\n');
  while (lines.length) {
    const t = lines[lines.length - 1].trim();
    if (!t) {
      lines.pop();
      continue;
    }
    if (/^\([A-E]\)\s*與\s*$/.test(t)) {
      lines.pop();
      continue;
    }
    if (/^(?:\([A-E]\)\s*[與及、]\s*)+\([A-E]\)\s*皆為/.test(t)
      || /\([A-E]\)\s*與\s*\([A-E]\)\s*皆為/.test(t)
      || /^\([A-E]\)\s*與\s*\([A-E]\)\s*皆為錯誤/.test(t)) {
      lines.pop();
      continue;
    }
    if (/^皆為錯誤敘述[。.]?$/.test(t)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n');
}

/** （已停用）勿對行內大括號做盲目替換，會破壞 \\begin{array}、\\htmlData 等 */
function repairInlineLatexInProse(text) {
  return String(text || '');
}

const QUESTION_HEADING_LINE_RE = /^(?:#{1,3}\s*)?(?:【\s*)?第\s*[\d一二三四五六七八九十]+\s*題(?:\s*】)?\s*(?:[（(][^)）]*[)）])?\s*$/;

/** 移除題庫配對用 HTML 註解，不顯示在板書上 */
function stripMatchComments(text) {
  return String(text || '').replace(/<!--\s*MATCH:[\s\S]*?-->\s*/gi, '');
}

/** 未指定題號時，將 AI／題庫的「第 N 題」改為中性小節標題 */
function neutralizeQuestionHeadings(text) {
  if (window.__solveHeadingMode === 'numbered') return String(text || '');
  let n = 0;
  return String(text || '').split('\n').map((line) => {
    const t = line.trim();
    if (!QUESTION_HEADING_LINE_RE.test(t)) return line;
    n += 1;
    if (n === 1) return '【詳解】';
    return '【補充說明】';
  }).join('\n');
}

function mergeOrphanPunctuationLines(raw) {
  const lines = String(raw || '').split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (out.length && /^[。．.,，；;、]+$/.test(t)) {
      out[out.length - 1] = `${out[out.length - 1].replace(/\s*$/, '')}${t}`;
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/** 修復 AI 斷裂或誤用的 $：單獨一行 $、純中文算式被包進 $…$／$$…$$ */
function repairOrphanDollarLines(text) {
  const lines = String(text || '').split('\n');
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '$' || t === '$$') {
      if (i + 1 < lines.length) {
        const inner = lines[i + 1].trim();
        const close = (i + 2 < lines.length) ? lines[i + 2].trim() : '';
        if (inner && (close === '$' || close === '$$')) {
          if (!/\\[a-zA-Z]/.test(inner)) {
            merged.push(inner);
          } else {
            merged.push(close === '$$' ? `$$${inner}$$` : `$${inner}$`);
          }
          i += 2;
          continue;
        }
        if (/^\$[^$]+\$$/.test(inner) || /^\$\$[\s\S]+\$\$$/.test(inner)) {
          merged.push(lines[i + 1]);
          i += 1;
          continue;
        }
      }
      continue;
    }
    merged.push(lines[i]);
  }

  const unwrapPlainMath = (inner) => {
    const s = String(inner || '').trim();
    if (!s || /\\[a-zA-Z]/.test(s)) return null;
    if (/[\u4e00-\u9fff]/.test(s) && !/[_^{}\\]/.test(s)) return s;
    if (/^[\u4e00-\u9fffA-Za-z0-9\s=+\-×÷*/（）().,，、：:次個片段段莫耳mol%％°℃]+$/.test(s)) return s;
    return null;
  };

  return merged.map((line) => {
    let s = String(line || '');
    s = s.replace(/\$\$([^$]+)\$\$/g, (m, inner) => unwrapPlainMath(inner) || m);
    s = s.replace(/\$([^$\n\\]+)\$/g, (m, inner) => unwrapPlainMath(inner) || m);
    return s;
  }).join('\n');
}

/** 計算式 $…$ 內移除 mol/g/g·mol⁻¹ 等（意義改由 NOTE 承載；保留 °C、M 等） */
function stripCalcUnitsInInlineMath(text) {
  const unitChunk = String.raw`\\,?\s*\\(?:text|mathrm)\{(?:mol|g|莫耳|克)(?:\s*\/\s*\\(?:text|mathrm)\{(?:mol|莫耳|g|克)\})?\}`;
  const unitRatio = String.raw`\\(?:text|mathrm)\{g\/mol\}|\\(?:text|mathrm)\{mol\/g\}|\\(?:text|mathrm)\{g\\,mol\^\{-1\}\}`;
  return String(text || '').split('\n').map((line) => {
    if (!/\$/.test(line) || /^\s*\$\$/.test(line.trim())) return line;
    return line.replace(/\$(?!\$)([\s\S]+?)\$/g, (full, inner) => {
      if (/\\begin\{array\}|\\begin\{cases\}/.test(inner)) return full;
      let s = inner;
      s = s.replace(new RegExp(`(${unitChunk})(?=\\s*$|[；;])`, 'gi'), '');
      s = s.replace(new RegExp(`([\\d.])${unitChunk}`, 'gi'), '$1');
      s = s.replace(new RegExp(`\\}${unitChunk}`, 'gi'), '}');
      s = s.replace(new RegExp(unitRatio, 'gi'), '');
      s = s.replace(/\{\s*([^}]*?)\s*\\(?:text|mathrm)\{g\/mol\}\s*\}/gi, '{$1}');
      s = s.replace(/\s{2,}/g, ' ');
      return `$${s}$`;
    });
  }).join('\n');
}

function preprocessPlainText(raw) {
  let text = stripMatchComments(String(raw || '').trim());
  text = normalizeAiHeadings(text);
  text = dropCoreConceptLines(text);
  text = repairGarbledEntities(text);
  if (typeof flattenReactionIceTables === 'function') text = flattenReactionIceTables(text);
  text = fixLatexBlocks(text);
  if (typeof flattenReactionIceTables === 'function') text = flattenReactionIceTables(text);
  if (typeof collapseReactionTableBlocks === 'function') text = collapseReactionTableBlocks(text);
  text = dropNoiseLines(text);
  text = repairOrphanDollarLines(text);
  text = mergeBrokenSummaryLines(text);
  text = dropRedundantTailSummary(text);
  text = wrapOrphanCasesLineGroups(text);
  text = organizeReactionCasesLayout(text);
  text = wrapSingleOrphanLatexLines(text);
  text = wrapBareLatexSnippets(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessEarly(text);
  text = repairBareTextMacros(text);
  if (typeof mergeAdjacentInlineMath === 'function') text = mergeAdjacentInlineMath(text);
  if (typeof mergeOrphanMathContinuationLines === 'function') text = mergeOrphanMathContinuationLines(text);
  if (typeof mergeOrphanUnitLines === 'function') text = mergeOrphanUnitLines(text);
  text = mergeOrphanPunctuationLines(text);
  text = repairOrphanDollarLines(text);
  text = stripCalcUnitsInInlineMath(text);
  text = fixLatexBlocks(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessLate(text);
  text = repairOrphanDollarLines(text);
  return text;
}

function visiblePlainLen(line) {
  return String(line || '')
    .replace(/\$\$[\s\S]+?\$\$/g, '§')
    .replace(/\$[^$\n]+?\$/g, '§')
    .replace(/\s+/g, '').length;
}

function cleanAnswerDisplay(raw) {
  return String(raw || '')
    .trim()
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/^(?:答|答案)\s*[：:]\s*/u, '')
    .trim();
}

function extractChoiceLetters(text) {
  const letters = [];
  for (const m of String(text).matchAll(/\(([A-E])\)/g)) {
    if (!letters.includes(m[1])) letters.push(m[1]);
  }
  if (!letters.length) return '';
  return letters.map(l => `(${l})`).join('');
}

function briefAnswerPayload(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const compact = t.replace(/\s+/g, '');
  if (/^(?:\([A-E]\))+$/.test(compact)) return t.replace(/\s+/g, '');
  const choices = extractChoiceLetters(t);
  if (choices && (t.length > 36 || /不符|計算|選項|依據|與.*不符|解析/.test(t))) return choices;
  if (t.length > 100 && choices) return choices;
  return t.length > 120 ? t.slice(0, 120) : t;
}

function compressAnswerLine(line) {
  const t = cleanAnswerDisplay(line);
  if (!t) return '';
  const qm = t.match(/^(第\s*[\d一二三四五六七八九十]+\s*題)\s*[：:]\s*(.*)$/);
  if (qm) {
    const brief = briefAnswerPayload(qm[2]);
    return brief ? `${qm[1]}：${brief}` : qm[1];
  }
  return briefAnswerPayload(t);
}

function splitAnswerLines(raw) {
  const text = String(raw || '').trim();
  const byQuestion = text.split(/(?=第\s*[\d一二三四五六七八九十]+\s*題\s*[：:])/g)
    .map(s => s.trim())
    .filter(Boolean);
  if (byQuestion.length > 1) return byQuestion;
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

function distillBriefAnswer(raw) {
  const lines = splitAnswerLines(raw);
  if (!lines.length) return '';
  const parts = lines.map(compressAnswerLine).filter(Boolean);
  if (!parts.length) return '';
  return parts.join('\n');
}

/** 結構化簡答欄：優先 @@ANSWER@@，否則取尾端短行 */
function splitBodyAndAnswer(text) {
  const raw = String(text || '').trim();
  if (!raw) return { body: '', answerText: '—' };

  const markerIdx = raw.lastIndexOf(ANSWER_MARKER);
  if (markerIdx >= 0) {
    const body = raw.slice(0, markerIdx).trim();
    const answerText = distillBriefAnswer(raw.slice(markerIdx + ANSWER_MARKER.length)) || '—';
    return { body, answerText };
  }

  const lines = raw.split('\n');
  const indexed = lines.map((l, i) => ({ i, t: l.trim() })).filter(x => x.t);
  if (!indexed.length) return { body: '', answerText: '—' };

  const tail = [];
  let start = indexed.length - 1;
  for (let j = indexed.length - 1; j >= 0 && tail.length < 2; j--) {
    const len = visiblePlainLen(indexed[j].t);
    if (tail.length === 0) {
      if (len > 140) break;
      tail.unshift(indexed[j]);
      start = j;
      continue;
    }
    if (len > 80) break;
    tail.unshift(indexed[j]);
    start = j;
  }

  if (!tail.length) {
    const last = indexed[indexed.length - 1].t;
    const plain = cleanAnswerDisplay(last.replace(/\$[^$]+\$/g, '').slice(0, 80));
    return { body: raw, answerText: plain || '—' };
  }

  const body = lines.slice(0, indexed[start].i).join('\n').trim();
  const answerText = distillBriefAnswer(tail.map(x => x.t).join('\n')) || '—';
  return { body, answerText };
}

function buildAnswerHtml(answerText, opts) {
  opts = opts || {};
  let raw = cleanAnswerDisplay(answerText) || '—';
  let lines = String(raw).split('\n').map(l => l.trim()).filter(l => l && l !== '—');
  if (opts.singleQuestion) {
    lines = lines.map(l => l.replace(/^第\s*[\d一二三四五六七八九十]+\s*題\s*[：:]\s*/, ''));
  }
  if (!lines.length) {
    return '<div class="answer-box answer-box--final">答：—</div>';
  }
  if (lines.length === 1) {
    return `<div class="answer-box answer-box--final">答：${esc(lines[0])}</div>`;
  }
  const items = lines.map(l => `<div class="answer-box-item">${esc(l)}</div>`).join('');
  return `<div class="answer-box answer-box--final answer-box--multi"><span class="answer-box-prefix">答</span><div class="answer-box-items">${items}</div></div>`;
}

function findInlineMathEnd(s, start) {
  let j = start + 1;
  while (j < s.length) {
    if (s.startsWith('\\begin{cases}', j) || s.startsWith('\\begin{array}', j) || s.startsWith('\\begin{aligned}', j)) {
      const envM = s.slice(j).match(/^\\begin\{(cases|array|aligned|matrix|pmatrix|bmatrix)\}/);
      if (envM) {
        const env = envM[1];
        const endTag = `\\end{${env}}`;
        const endIdx = s.indexOf(endTag, j);
        if (endIdx >= 0) {
          const close = s.indexOf('$', endIdx + endTag.length);
          if (close >= 0) return close;
          return endIdx + endTag.length - 1;
        }
      }
    }
    if (s[j] === '$' && s[j - 1] !== '\\') return j;
    j++;
  }
  return -1;
}

/** 將文字切成「一般文字／算式」；不再用 M0 暫存（避免還原失敗露出亂碼） */
function tokenizeMathSegments(text) {
  const s = String(text || '');
  const parts = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('$$', i)) {
      const end = s.indexOf('$$', i + 2);
      if (end >= 0) {
        parts.push({ type: 'math', content: s.slice(i, end + 2) });
        i = end + 2;
        continue;
      }
    }
    const bareEnv = s.slice(i).match(new RegExp(`^\\\\begin\\{(${LATEX_ENV_NAMES})\\}`));
    if (bareEnv) {
      const env = bareEnv[1];
      const endTag = `\\end{${env}}`;
      const endIdx = s.indexOf(endTag, i);
      if (endIdx >= 0) {
        const end = endIdx + endTag.length;
        parts.push({ type: 'math', content: s.slice(i, end) });
        i = end;
        continue;
      }
    }
    if (s[i] === '$' && s[i + 1] !== '$') {
      const close = findInlineMathEnd(s, i);
      if (close > i) {
        parts.push({ type: 'math', content: s.slice(i, close + 1) });
        i = close + 1;
        continue;
      }
    }
    let next = s.length;
    for (const needle of ['$$', '$', '\\begin{']) {
      const p = s.indexOf(needle, i);
      if (p >= 0 && p < next) next = p;
    }
    if (next > i) {
      parts.push({ type: 'text', content: s.slice(i, next) });
      i = next;
    } else {
      parts.push({ type: 'text', content: s[i] });
      i += 1;
    }
  }
  return parts;
}

function escapeMathSegment(content) {
  let c = String(content || '');
  if (!/^\$/.test(c) && /\\begin\{/.test(c)) c = `$$${c}$$`;
  return c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapePlainBody(text) {
  return tokenizeMathSegments(text).map((seg) => {
    if (seg.type === 'math') return escapeMathSegment(seg.content);
    let t = esc(seg.content);
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return t;
  }).join('');
}

const EXAM_QUESTION_HEAD_RE = /^(\d{1,2})\.\s*(.*)$/s;

function normalizeExamQuestionHeadings(text) {
  return String(text || '').split('\n').map((line) => {
    const t = line.trim();
    if (QUESTION_HEADING_LINE_RE.test(t)) return line;
    const m = t.match(EXAM_QUESTION_HEAD_RE);
    if (!m) return line;
    const rest = String(m[2] || '').trim();
    if (/^\d/.test(rest)) return line;
    return rest ? `第 ${m[1]} 題\n${rest}` : `第 ${m[1]} 題`;
  }).join('\n');
}

function countQuestionSections(text) {
  let n = 0;
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (QUESTION_HEADING_LINE_RE.test(t)) n++;
    else if (/^第\s*[\d一二三四五六七八九十]+\s*題/.test(t)) n++;
  }
  return n;
}

function updateSolveHeadingMode(input) {
  const raw = String(input || '').trim();
  let scope = { mode: 'all', numbers: [] };
  if (typeof parseRequestedSolveScope === 'function') {
    scope = parseRequestedSolveScope(raw);
  }
  const wantsNumbers = scope.mode === 'partial'
    || /第\s*[\d一二三四五六七八九十]+\s*題/.test(raw)
    || (typeof countQuestionSections === 'function' && countQuestionSections(raw) >= 2);
  window.__solveHeadingMode = wantsNumbers ? 'numbered' : 'neutral';
  window.__solveMultiQuestion = wantsNumbers && (
    scope.mode === 'partial'
    || (typeof countQuestionSections === 'function' && countQuestionSections(raw) >= 2)
  );
}

function render(rawText) {
  if (!rawText) return `<div class="ai-plain">${buildAnswerHtml('—')}</div>`;

  const { body, answerText } = splitBodyAndAnswer(String(rawText).trim());
  let preprocessed = preprocessPlainText(body);
  preprocessed = normalizeExamQuestionHeadings(preprocessed);
  if (countQuestionSections(preprocessed) >= 2) {
    window.__solveHeadingMode = 'numbered';
  }
  if (typeof neutralizeQuestionHeadings === 'function') {
    preprocessed = neutralizeQuestionHeadings(preprocessed);
  }
  if (typeof injectReactionTableHtml === 'function') {
    preprocessed = injectReactionTableHtml(preprocessed);
  }
  const escaped = escapePlainBody(preprocessed);
  const layoutInput = typeof restoreReactionTablePlaceholders === 'function'
    ? restoreReactionTablePlaceholders(escaped)
    : escaped;

  const layoutFn = typeof layoutPlainSolveText === 'function'
    ? layoutPlainSolveText
    : fallbackPlainLayout;

  const qCount = countQuestionSections(preprocessed);
  return `<div class="ai-plain">${layoutFn(layoutInput)}${buildAnswerHtml(answerText, { singleQuestion: qCount <= 1 })}</div>`;
}

function fallbackPlainLayout(text) {
  return String(text || '').split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    return `<div class="plain-line"><div class="plain-line-inner">${t}</div></div>`;
  }).join('');
}

function measureLineOverflow(inner, content) {
  if (!inner || !content) return false;
  const avail = inner.clientWidth;
  if (avail <= 0) return false;
  content.classList.add('plain-line-xcontent--measure');
  const needX = content.scrollWidth > avail + 1;
  content.classList.remove('plain-line-xcontent--measure');
  return needX;
}

function applyLineHorizontalScroll(inner, wrap, content) {
  if (!inner?.isConnected || !wrap || !content) return;
  const needX = measureLineOverflow(inner, content);
  wrap.classList.toggle('plain-line-xwrap--scroll', needX);
  inner.classList.toggle('plain-line-inner--xscroll', needX);
  inner.classList.remove('plain-line--hscroll', 'plain-line--hscroll-math');
  inner.style.whiteSpace = 'normal';
}

const lineScrollObservers = new WeakMap();

function setupHorizontalLineScroll(root) {
  if (!root) return;
  const rows = root.querySelectorAll(
    '.plain-line-inner, .choice-body, .choice-step .plain-line-inner'
  );
  rows.forEach((inner) => {
    if (!inner.querySelector('.katex, .math-block, .math-unit-tail')) return;

    inner.style.overflow = 'visible';
    inner.style.overflowX = 'visible';
    inner.style.overflowY = 'visible';
    inner.style.maxHeight = 'none';
    inner.style.whiteSpace = 'normal';

    let wrap = inner.querySelector(':scope > .plain-line-xwrap');
    let content = wrap?.querySelector(':scope > .plain-line-xcontent');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'plain-line-xwrap';
      content = document.createElement('div');
      content.className = 'plain-line-xcontent';
      while (inner.firstChild) content.appendChild(inner.firstChild);
      wrap.appendChild(content);
      inner.appendChild(wrap);
    }

    const run = () => applyLineHorizontalScroll(inner, wrap, content);

    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const prev = lineScrollObservers.get(inner);
      if (prev) prev.disconnect();
      const ro = new ResizeObserver(() => run());
      ro.observe(inner);
      lineScrollObservers.set(inner, ro);
    }
  });
}

function getKatexOpts() {
  const trust = typeof MathNote !== 'undefined' ? MathNote.getKatexTrust() : () => false;
  const macros = typeof MathNote !== 'undefined' ? MathNote.getKatexMacros() : { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' };
  return { trust, macros };
}

function tryRenderLatex(tex, display) {
  if (typeof katex === 'undefined') return null;
  try {
    const holder = document.createElement('span');
    if (display) holder.className = 'math-block';
    const { trust, macros } = getKatexOpts();
    katex.render(tex, holder, {
      displayMode: !!display,
      throwOnError: false,
      strict: 'ignore',
      trust,
      macros
    });
    return holder.querySelector('.katex') ? holder : null;
  } catch (_) {
    return null;
  }
}

function hideKatexErrors(root) {
  if (!root) return;
  root.querySelectorAll('.katex-error').forEach(el => {
    const tex = (el.textContent || '').trim();
    if (/\\htmlData\{/.test(tex)) return;
    const envM = tex.match(new RegExp(LATEX_ENV_RE));
    if (envM) {
      const holder = tryRenderLatex(envM[0], true);
      if (holder) { el.replaceWith(holder); return; }
    }
    if (/\\[a-zA-Z]/.test(tex)) {
      const holder = tryRenderLatex(tex, /\\begin\{(array|cases|aligned)/.test(tex));
      if (holder) { el.replaceWith(holder); return; }
    }
    el.remove();
  });
}

function recoverLeakedStashCases(root) {
  if (!root) return;
  root.querySelectorAll('.plain-line-inner, .choice-body').forEach((inner) => {
    inner.childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const t = node.textContent || '';
      const m = t.match(/M\d+(\\begin\{(?:cases|array|aligned)\}[\s\S]*?\\end\{(?:cases|array|aligned)\})\s*\$?/);
      if (!m) return;
      const before = t.slice(0, m.index);
      const parent = node.parentNode;
      if (!parent) return;
      if (before) parent.insertBefore(document.createTextNode(before), node);
      const holder = tryRenderLatex(m[1], true);
      parent.insertBefore(holder || document.createTextNode(m[1]), node);
      parent.removeChild(node);
    });
  });
}

function postProcessPlainBoard(root) {
  if (!root) return;
  if (typeof wrapKatexNowrap === 'function') wrapKatexNowrap(root);
  if (typeof bindKatexNumericUnits === 'function') bindKatexNumericUnits(root);
  if (typeof keepMathUnitTails === 'function') keepMathUnitTails(root);
  if (typeof adjustPlainReactionTables === 'function') adjustPlainReactionTables(root);
  setupHorizontalLineScroll(root);
  if (typeof stripStrayDollarsInPlain === 'function') stripStrayDollarsInPlain(root);
  hideKatexErrors(root);
  recoverLeakedStashCases(root);
  if (typeof MathNote !== 'undefined') MathNote.postProcessBoard(root);
  setupHorizontalLineScroll(root);
}

function doKaTeX(element) {
  if (!element || typeof renderMathInElement !== 'function') return;
  const { trust, macros } = getKatexOpts();
  const katexOpts = {
    throwOnError: false,
    strict: 'ignore',
    trust,
    macros
  };
  renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    ...katexOpts
  });
  postProcessPlainBoard(element);
}
