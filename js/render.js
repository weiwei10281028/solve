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
  s = s.replace(/(?<!d)\\frac\{/g, '\\dfrac{');
  s = s.replace(/\\(?:d)?frac\{\s*\$\s*([^$]+?)\s*\$\s*\}\{\s*\$\s*([^$]+?)\s*\$\s*\}/g, '\\dfrac{$1}{$2}');
  s = s.replace(/([^\\a-zA-Z])\s*\\cdot\s*/g, '$1 \\cdot ');
  // 結論前逗號改全形（與中文句號同級標點）
  s = s.replace(/,\s*\\quad\s*\\text\{\s*故\s*\}/g, '\\text{，}\\quad\\text{故 }');
  s = s.replace(/(\\dfrac\{[^}]+\}\{[^}]+\})\s*,\s*(\\quad\s*\\text\{\s*故)/g, '$1\\text{，}$2');
  s = s.replace(/\$\s*([0-9]+(?:\.[0-9]+)?(?:%|％)?)\s*\$/g, '$1');
  s = s.replace(/\$\s+(?=\\[a-zA-Z{])/g, '$');
  s = s.replace(/([^\n]*?)\$\s*(\\begin\{cases\}[\s\S]*?\\end\{cases\})\s*\$/g, (m, prefix, body) => {
    const p = String(prefix || '').trimEnd();
    return p ? `${p}\n\n$$${body}$$\n` : `$$${body}$$\n`;
  });
  s = s.replace(/^\$\s*(\\begin\{cases\}[\s\S]*?\\end\{cases\})\s*\$/gm, '$$$1$$');
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

/** 行內未閉合 $、孤立 $$（選項評析常見） */
function repairUnclosedInlineMath(text) {
  return String(text || '').split('\n').map((line) => {
    if (/^\s*\$\$/.test(line.trim())) return line;
    let s = line;
    s = s.replace(/(?<!\$)\$\$(?!\$)/g, '');
    const singles = s.match(/(?<!\\)\$/g);
    if (singles && singles.length % 2 === 1) s += '$';
    return s;
  }).join('\n');
}

/** 裸寫化學式（SO3、H2O）與 Unicode 下標統一包進 $…$ */
const UNICODE_SUB_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

function normalizeUnicodeChemSubscripts(text) {
  return String(text || '').replace(/([A-Z][a-z]?)([₀₁₂₃₄₅₆₇₈₉]+)/g, (m, el, subs, off) => {
    if (isInsideDollarMath(text, off)) return m;
    const digits = [...subs].map((c) => UNICODE_SUB_MAP[c] || c).join('');
    return `$\\text{${el}}_{${digits}}$`;
  });
}

function chemDigitsToSubscripts(formula) {
  return String(formula || '').replace(/([A-Z][a-z]?)(\d+)/g, '$1_$2');
}

function wrapBareChemicalFormulas(text) {
  let s = normalizeUnicodeChemSubscripts(text);
  const CHEM_RE = /(?<![$\w\\/])([A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)+(?:[A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)*)*)(?![A-Za-z])/g;
  return s.split('\n').map((line) => {
    if (/^\s*\$\$/.test(line.trim())) return line;
    return line.replace(CHEM_RE, (m, formula, off) => {
      if (isInsideDollarMath(line, off)) return m;
      if (/^(Kp|Kc|ICE|Pa|atm|mol|K)$/i.test(formula)) return m;
      const inner = /_\{?\d/.test(formula) ? formula : chemDigitsToSubscripts(formula);
      return `$\\text{${inner}}$`;
    });
  }).join('\n');
}

/** 裸寫 \\text{…}、\\mathrm{…}（含上下標）包進 $…$ */
function repairBareTextMacros(text) {
  return String(text || '').replace(
    /(?<!\$)\\(?:text|mathrm)\{([^{}]+)\}((?:_\{?[^{}$]+\}?|\^\{?[^{}$]+\}?)*)/g,
    (m, inner, tail, off) => {
      if (isInsideDollarMath(text, off)) return m;
      const macro = m.includes('\\mathrm') ? 'mathrm' : 'text';
      return `$\\${macro}{${inner}}${tail || ''}$`;
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
    s = s.replace(/(?<!\$)(\d(?:\\text\{[spdf]\}\^?\{?\d+\}?)+)(?!\$)/gi, (m, expr, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$${expr}$`;
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

/** 單題解題時移除 AI 誤當步驟標題的「第 N 題」獨立行 */
function stripStandaloneQuestionHeadingLines(text) {
  if (window.__solveMultiQuestion) return String(text || '');
  return String(text || '').split('\n').filter((line) => {
    const t = line.trim();
    return !QUESTION_HEADING_LINE_RE.test(t);
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

  return merged.filter((line) => {
    const t = String(line || '').trim();
    return t !== '$' && t !== '$$';
  }).map((line) => {
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

/** 全形等號改半形；裸寫比例／等號式包進 $…$（走 KaTeX 字體，與電荷同路徑） */
function normalizeMathOperatorsInPlain(text) {
  const hasHan = (s) => /[\u4e00-\u9fff]/.test(s);
  return String(text || '').split('\n').map((line) => {
    if (/^\s*\$\$/.test(line)) return line;
    let s = line;
    s = s.replace(/\$([^$\n]+)\$/g, (_, inner) => `$${inner.replace(/＝/g, '=')}$`);
    s = s.replace(
      /(?<![$\w\u4e00-\u9fff（(])([0-9A-Za-z%％.+×·\s:：\-]+?)＝([0-9A-Za-z%％.+×·\s:：\-]+?)(?![$\w\u4e00-\u9fff）)])/g,
      (m, a, b) => {
        if (hasHan(a) || hasHan(b)) return m;
        const expr = `${a.trim().replace(/：/g, ':')}=${b.trim().replace(/：/g, ':')}`;
        return `$${expr}$`;
      }
    );
    return s;
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
  text = wrapBareChemicalFormulas(text);
  text = normalizeMathOperatorsInPlain(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessEarly(text);
  text = repairBareTextMacros(text);
  if (typeof mergeAdjacentInlineMath === 'function') text = mergeAdjacentInlineMath(text);
  if (typeof mergeOrphanMathContinuationLines === 'function') text = mergeOrphanMathContinuationLines(text);
  if (typeof mergeOrphanUnitLines === 'function') text = mergeOrphanUnitLines(text);
  text = mergeOrphanPunctuationLines(text);
  text = repairOrphanDollarLines(text);
  text = repairUnclosedInlineMath(text);
  text = repairBareTextMacros(text);
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

function parseAnswerNumeric(text) {
  const t = String(text || '').replace(/\$/g, '').trim();
  const m = t.match(/(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*([A-Za-z°%％μ\/·\-\^⁰¹²³⁴⁵⁶⁷⁸⁹]+)?/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (m[2] || '').trim().toLowerCase();
  return { value, unit };
}

/** 從使用者輸入的參考答案解析 */
window.parseReferenceAnswerInput = function(raw) {
  const cleaned = cleanAnswerDisplay(raw);
  if (!cleaned) return { raw: '', choices: '', numeric: null };
  return {
    raw: cleaned,
    choices: extractChoiceLetters(cleaned),
    numeric: parseAnswerNumeric(cleaned)
  };
};

/** 從 AI 全文解析 @@ANSWER@@ 簡答 */
window.extractAnswerFromReply = function(text) {
  const { answerText } = splitBodyAndAnswer(text);
  const cleaned = cleanAnswerDisplay(answerText);
  if (!cleaned || cleaned === '—') {
    return { raw: '', choices: '', numeric: null };
  }
  return {
    raw: cleaned,
    choices: extractChoiceLetters(cleaned),
    numeric: parseAnswerNumeric(cleaned)
  };
};

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
  if (window.__solveMultiQuestion && countQuestionSections(preprocessed) >= 2) {
    window.__solveHeadingMode = 'numbered';
  }
  preprocessed = stripStandaloneQuestionHeadingLines(preprocessed);
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
  const avail = inner.clientWidth
    || inner.getBoundingClientRect().width
    || inner.parentElement?.clientWidth
    || 0;
  if (avail <= 0) return false;
  content.classList.add('plain-line-xcontent--measure');
  const needX = content.scrollWidth > avail + 1;
  content.classList.remove('plain-line-xcontent--measure');
  return needX;
}

function lineHasLeakedLatex(el) {
  if (!el) return false;
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent || '';
      if (/\\(?:text|mathrm)\{/.test(t)) return true;
      if (/(?<!\$)\d\\text\{[spdf]\}/i.test(t)) return true;
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains('katex')) return false;
      for (const ch of node.childNodes) if (walk(ch)) return true;
    }
    return false;
  };
  return walk(el);
}

function applyLineHorizontalScroll(inner, wrap, content) {
  if (!inner?.isConnected || !wrap || !content) return;
  const avail = inner.clientWidth
    || inner.getBoundingClientRect().width
    || inner.parentElement?.clientWidth
    || 0;
  if (avail <= 0) {
    requestAnimationFrame(() => applyLineHorizontalScroll(inner, wrap, content));
    return;
  }
  if (lineHasLeakedLatex(content)) {
    wrap.classList.remove('plain-line-xwrap--scroll');
    inner.classList.remove('plain-line-inner--xscroll');
    content.style.whiteSpace = 'normal';
    inner.style.whiteSpace = 'normal';
    return;
  }
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
    inner.style.overflowX = '';
    inner.style.overflowY = '';
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
      if (inner.parentElement) ro.observe(inner.parentElement);
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

const LEAKED_LATEX_SNIPPET_RE = /\\(?:text|mathrm)\{[^{}]+\}(?:_\{?[^{}$]+\}?|\^\{?[^{}$]+\}?)*|\d(?:\\text\{[spdf]\}\^?\{?\d+\}?)+/gi;

function recoverLeakedLatexInDom(root) {
  if (!root) return;
  root.querySelectorAll('.plain-line-inner, .choice-body').forEach((inner) => {
    [...inner.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const t = node.textContent || '';
      if (!LEAKED_LATEX_SNIPPET_RE.test(t)) return;
      LEAKED_LATEX_SNIPPET_RE.lastIndex = 0;
      const parent = node.parentNode;
      if (!parent) return;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let m;
      while ((m = LEAKED_LATEX_SNIPPET_RE.exec(t))) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(t.slice(lastIdx, m.index)));
        const holder = tryRenderLatex(m[0], false);
        frag.appendChild(holder || document.createTextNode(m[0]));
        lastIdx = LEAKED_LATEX_SNIPPET_RE.lastIndex;
      }
      if (lastIdx < t.length) frag.appendChild(document.createTextNode(t.slice(lastIdx)));
      parent.replaceChild(frag, node);
    });
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

/**
 * 巢狀分式排版（KaTeX 0.16 vlist-t2）
 * 1. 分子區內層：拉開內層分母離外層中線
 * 2. 分母區內層：拉開內層分子離外層中線
 * 3. 外層中線中心對齊同行所有等號（transform，不用 vertical-align）
 */
function markAndSpaceNestedFractions(root) {
  if (!root) return;

  const ATTR_ORIG_TOP = 'data-nfrac-orig-top';
  const ATTR_ORIG_VH = 'data-nfrac-orig-vh';
  const ATTR_ORIG_TF = 'data-nfrac-orig-tf';
  const ATTR_BAR_ALIGN = 'data-nfrac-bar-align';

  const INNER_SPREAD_EM = 0.16;
  const INNER_SPREAD_NOTE_EM = 0.20;
  const NUM_NUMPART_LIFT = 0.06;
  const NUM_EXTRA_UP_PX = 2;
  const INNER_VH_EM = 0.18;
  const INNER_VH_NOTE_EM = 0.22;
  const OUTER_VH_EM = 0.10;
  const GAP_PX = 5;
  const GAP_NOTE_PX = 6;

  const isTopLevelMfrac = (mfrac) => !mfrac.parentElement?.closest('.mfrac');
  const isEqualsRel = (el) => ['=', '＝', '≈'].includes((el.textContent || '').trim());
  const centerY = (el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const partHasNote = (part) => !!(part && part.querySelector('.math-note, [data-note]'));

  const parseVlistT2 = (mfrac) => {
    const vlistT = mfrac.querySelector(':scope > .vlist-t');
    if (!vlistT) return null;
    const mainRow = vlistT.querySelector(':scope > .vlist-r');
    const vlist = mainRow?.querySelector(':scope > .vlist');
    if (!vlist) return null;
    const parts = [...vlist.children];
    const lineIdx = parts.findIndex((el) => el.querySelector('.frac-line'));
    if (lineIdx < 0) return null;
    const linePart = parts[lineIdx];
    return {
      vlist,
      numPart: parts[lineIdx - 1] || null,
      linePart,
      fracLine: linePart.querySelector('.frac-line'),
      denPart: parts[lineIdx + 1] || null,
    };
  };

  const restoreAll = () => {
    root.querySelectorAll(`[${ATTR_ORIG_TOP}]`).forEach((el) => {
      el.style.top = el.getAttribute(ATTR_ORIG_TOP);
      el.removeAttribute(ATTR_ORIG_TOP);
    });
    root.querySelectorAll(`[${ATTR_ORIG_VH}]`).forEach((el) => {
      el.style.height = el.getAttribute(ATTR_ORIG_VH);
      el.removeAttribute(ATTR_ORIG_VH);
    });
    root.querySelectorAll(`[${ATTR_ORIG_TF}]`).forEach((el) => {
      el.style.transform = el.getAttribute(ATTR_ORIG_TF) || '';
      el.removeAttribute(ATTR_ORIG_TF);
    });
    root.querySelectorAll(`[${ATTR_BAR_ALIGN}]`).forEach((el) => {
      el.style.transform = el.getAttribute(ATTR_BAR_ALIGN) || '';
      el.removeAttribute(ATTR_BAR_ALIGN);
    });
    root.querySelectorAll('.mfrac-has-nested, .mfrac-has-note, .mfrac-inner-in-num, .mfrac-inner-in-den').forEach((mfrac) => {
      mfrac.classList.remove('mfrac-has-nested', 'mfrac-has-note', 'mfrac-inner-in-num', 'mfrac-inner-in-den');
      if (!mfrac.hasAttribute(ATTR_BAR_ALIGN)) {
        mfrac.style.transform = '';
        mfrac.style.verticalAlign = '';
      }
      mfrac.querySelectorAll('.frac-line').forEach((line) => {
        const wrap = line.parentElement;
        if (wrap) {
          wrap.style.position = '';
          wrap.style.zIndex = '';
        }
        line.style.position = '';
        line.style.zIndex = '';
      });
    });
  };

  const nudgeTopEm = (el, deltaEm) => {
    if (!el?.style?.top || !deltaEm) return;
    const m = String(el.style.top).match(/^(-?[\d.]+)em$/);
    if (!m) return;
    if (!el.hasAttribute(ATTR_ORIG_TOP)) el.setAttribute(ATTR_ORIG_TOP, el.style.top);
    el.style.top = `${parseFloat(m[1]) + deltaEm}em`;
  };

  const expandVlistHeight = (vlist, extraEm) => {
    if (!vlist?.style?.height || extraEm <= 0) return;
    const m = String(vlist.style.height).match(/^([\d.]+)em$/);
    if (!m) return;
    if (!vlist.hasAttribute(ATTR_ORIG_VH)) vlist.setAttribute(ATTR_ORIG_VH, vlist.style.height);
    vlist.style.height = `${parseFloat(m[1]) + extraEm}em`;
  };

  const setPartTranslateY = (el, px) => {
    if (!el) return;
    if (!el.hasAttribute(ATTR_ORIG_TF)) el.setAttribute(ATTR_ORIG_TF, el.style.transform || '');
    el.style.transform = px ? `translateY(${px}px)` : (el.getAttribute(ATTR_ORIG_TF) || '');
  };

  const liftFracLineAboveNotes = (layout) => {
    if (!layout?.linePart || !layout.fracLine) return;
    layout.linePart.style.position = 'relative';
    layout.linePart.style.zIndex = '5';
    layout.fracLine.style.position = 'relative';
    layout.fracLine.style.zIndex = '6';
  };

  const getInnerZone = (outer, inner) => {
    const layout = parseVlistT2(outer);
    if (!layout) return null;
    if (layout.numPart?.contains(inner)) return 'numerator';
    if (layout.denPart?.contains(inner)) return 'denominator';
    return null;
  };

  const collectRowEquals = (mfrac) => {
    const row = mfrac.closest('.katex-html') || mfrac.closest('.katex');
    if (!row) return [];
    return [...row.querySelectorAll('.mrel')].filter(isEqualsRel);
  };

  const tagNestedMfracs = () => {
    root.querySelectorAll('.katex .mfrac').forEach((mfrac) => {
      const vlistT = mfrac.querySelector(':scope > .vlist-t');
      if (!vlistT?.querySelector('.mfrac')) return;
      mfrac.classList.add('mfrac-has-nested');
      const layout = parseVlistT2(mfrac);
      if (layout && (partHasNote(layout.numPart) || partHasNote(layout.denPart))) {
        mfrac.classList.add('mfrac-has-note');
      }
    });
    root.querySelectorAll('.katex .mfrac-has-nested .mfrac').forEach((inner) => {
      const layout = parseVlistT2(inner);
      if (layout && (partHasNote(layout.numPart) || partHasNote(layout.denPart))) {
        inner.classList.add('mfrac-has-note');
      }
    });
  };

  const layoutOneOuter = (outer) => {
    if (!isTopLevelMfrac(outer)) return;
    const outerLayout = parseVlistT2(outer);
    if (!outerLayout) return;
    liftFracLineAboveNotes(outerLayout);

    const inners = [...outer.querySelectorAll('.mfrac')].filter((m) => m !== outer);
    inners.forEach((inner) => {
      const zone = getInnerZone(outer, inner);
      if (!zone) return;
      inner.classList.add(zone === 'numerator' ? 'mfrac-inner-in-num' : 'mfrac-inner-in-den');

      const innerLayout = parseVlistT2(inner);
      if (!innerLayout) return;
      liftFracLineAboveNotes(innerLayout);
      const hasNote = partHasNote(innerLayout.numPart) || partHasNote(innerLayout.denPart);
      const spread = hasNote ? INNER_SPREAD_NOTE_EM : INNER_SPREAD_EM;
      const vh = hasNote ? INNER_VH_NOTE_EM : INNER_VH_EM;

      if (zone === 'numerator') {
        nudgeTopEm(innerLayout.denPart, -spread);
        nudgeTopEm(innerLayout.numPart, -spread * NUM_NUMPART_LIFT / INNER_SPREAD_EM);
      } else {
        nudgeTopEm(innerLayout.numPart, spread);
      }
      expandVlistHeight(innerLayout.vlist, vh);
    });

    inners.forEach((inner) => {
      const zone = getInnerZone(outer, inner);
      const innerLayout = parseVlistT2(inner);
      if (!zone || !innerLayout || !outerLayout.fracLine) return;
      const line = outerLayout.fracLine.getBoundingClientRect();
      const hasNote = partHasNote(innerLayout.numPart) || partHasNote(innerLayout.denPart);
      const target = hasNote ? GAP_NOTE_PX : GAP_PX;

      if (zone === 'numerator' && innerLayout.denPart) {
        const denR = innerLayout.denPart.getBoundingClientRect();
        const gap = line.top - denR.bottom;
        const shift = (gap < target ? -(target - gap) : 0) - NUM_EXTRA_UP_PX;
        if (shift) setPartTranslateY(innerLayout.denPart, shift);
      }
      if (zone === 'denominator' && innerLayout.numPart) {
        const numR = innerLayout.numPart.getBoundingClientRect();
        const gap = numR.top - line.bottom;
        if (gap < target) setPartTranslateY(innerLayout.numPart, target - gap);
      }
    });

    expandVlistHeight(outerLayout.vlist, OUTER_VH_EM);

    const equals = collectRowEquals(outer);
    if (!equals.length || !outerLayout.fracLine) return;

    const refY = equals.reduce((sum, el) => sum + centerY(el), 0) / equals.length;
    const barY = centerY(outerLayout.fracLine);
    const dy = refY - barY;
    if (Math.abs(dy) < 0.25) return;

    if (!outer.hasAttribute(ATTR_BAR_ALIGN)) {
      outer.setAttribute(ATTR_BAR_ALIGN, outer.style.transform || '');
    }
    outer.style.transform = `translateY(${dy}px)`;
    outer.style.verticalAlign = 'baseline';
  };

  const layoutAll = () => {
    tagNestedMfracs();
    root.querySelectorAll('.katex .mfrac-has-nested').forEach(layoutOneOuter);
  };

  const runPass = () => {
    restoreAll();
    layoutAll();
  };

  runPass();
  requestAnimationFrame(runPass);
}

/** 標籤垂直中心對齊各選項首行說明文字（算式在次行不影響） */
function measureChoiceAnchorRect(anchor) {
  if (!anchor || !anchor.getBoundingClientRect) return null;
  const katex = anchor.querySelector(':scope .katex');
  if (!katex) return anchor.getBoundingClientRect();

  const firstStep = anchor.closest('.choice-body')?.querySelector('.choice-step .plain-line-inner');
  if (firstStep && firstStep !== anchor) return firstStep.getBoundingClientRect();

  try {
    const range = document.createRange();
    range.setStart(anchor, 0);
    const stopNode = katex.closest('.plain-katex-nowrap') || katex;
    if (stopNode && anchor.contains(stopNode)) {
      range.setEndBefore(stopNode);
    } else {
      range.setEndBefore(katex);
    }
    if (!range.collapsed) return range.getBoundingClientRect();
  } catch { /* fallback */ }
  return anchor.getBoundingClientRect();
}

function lineHasFraction(line) {
  const inner = line.querySelector('.plain-line-inner') || line;
  return !!inner.querySelector('.mfrac, .katex .mfrac');
}

function getPlainLineGapPx(container, prevLine, curLine) {
  const base = (() => {
    if (!container) return 12;
    const plain = container.classList?.contains('ai-plain')
      ? container
      : container.closest('.ai-plain');
    const el = plain || container;
    const raw = getComputedStyle(el).getPropertyValue('--plain-line-gap').trim();
    if (!raw) return 12;
    if (raw.endsWith('px')) return parseFloat(raw) || 12;
    if (raw.endsWith('em')) {
      return (parseFloat(raw) || 0) * (parseFloat(getComputedStyle(el).fontSize) || 15);
    }
    return parseFloat(raw) || 12;
  })();
  const fracRaw = container?.closest?.('.ai-plain')
    ? getComputedStyle(container.closest('.ai-plain')).getPropertyValue('--plain-line-gap-frac').trim()
    : '';
  const fracGap = fracRaw.endsWith('px') ? (parseFloat(fracRaw) || 16) : 16;
  if (lineHasFraction(prevLine) || lineHasFraction(curLine)) return Math.max(base, fracGap);
  return base;
}

function getLineVisualBounds(line) {
  const inner = line.querySelector('.plain-line-inner') || line;
  const rect = inner.getBoundingClientRect();
  let top = rect.top;
  let bottom = rect.bottom;
  inner.querySelectorAll('.katex, .math-block').forEach((node) => {
    const r = node.getBoundingClientRect();
    if (r.height > 0) {
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
  });
  return { top, bottom };
}

function collectPlainLineSiblings(container) {
  if (!container) return [];
  if (container.classList?.contains('choice-body--steps')) {
    return [...container.querySelectorAll(':scope > .choice-step')].filter((el) => el.offsetParent !== null);
  }
  return [...container.children].filter((el) => {
    if (!el.classList?.contains('plain-line')) return false;
    if (el.classList.contains('plain-line--empty')) return false;
    return true;
  });
}

/** 量測相鄰行視覺間距，補足至 --plain-line-gap（分式行高等不影響間格） */
function normalizePlainLineGapsInContainer(container) {
  const lines = collectPlainLineSiblings(container);
  if (lines.length < 2) return;

  lines.forEach((line) => {
    line.style.marginTop = '';
    line.classList.remove('plain-line--has-frac');
  });

  lines.forEach((line, i) => {
    if (i > 0 && (lineHasFraction(lines[i - 1]) || lineHasFraction(line))) {
      line.classList.add('plain-line--has-frac');
    }
  });

  lines.forEach((line, i) => {
    if (i === 0) return;
    const targetGap = getPlainLineGapPx(container, lines[i - 1], line);
    const prevBounds = getLineVisualBounds(lines[i - 1]);
    const curBounds = getLineVisualBounds(line);
    const actualGap = curBounds.top - prevBounds.bottom;
    const extra = targetGap - actualGap;
    if (extra > 0.25) {
      const cssMargin = parseFloat(getComputedStyle(line).marginTop) || 0;
      line.style.marginTop = `${cssMargin + extra}px`;
    }
  });
}

function normalizePlainLineGaps(root) {
  if (!root) return;
  const plains = root.classList?.contains('ai-plain')
    ? [root]
    : [...root.querySelectorAll('.ai-plain')];
  plains.forEach((plain) => {
    normalizePlainLineGapsInContainer(plain);
    plain.querySelectorAll('.choice-body--steps, .structure-item-text').forEach(normalizePlainLineGapsInContainer);
  });
}

function syncChoiceLabelBaselines(root) {
  if (!root) return;
  root.querySelectorAll('.choice-option').forEach((opt) => {
    const label = opt.querySelector('.choice-label');
    const body = opt.querySelector('.choice-body');
    if (!label || !body) return;
    label.style.marginTop = '';

    const anchor = body.querySelector('.choice-step .plain-line-inner')
      || body.querySelector('.plain-line-inner')
      || body;
    const labelRect = label.getBoundingClientRect();
    const anchorRect = measureChoiceAnchorRect(anchor);
    if (!labelRect.height || !anchorRect?.height) return;

    const labelMid = labelRect.top + labelRect.height / 2;
    const anchorMid = anchorRect.top + anchorRect.height / 2;
    const dy = anchorMid - labelMid;
    if (Math.abs(dy) >= 0.5) {
      label.style.marginTop = `${dy}px`;
    }
  });
}

const BOARD_KEEP_TEXT = /^(起始|變化|結果|移至左|移至右|完全反應|完全移至|完全向左|再向右|後來體積|原來體積|初|平|平衡)$/;

function collectBoardPlainScopes(root) {
  const scope = new Set();
  if (!root) return [];
  const tryAdd = (el) => {
    if (el?.classList?.contains('ai-plain') && el.closest('.board, .board-reply, .followup-reply')) {
      scope.add(el);
    }
  };
  tryAdd(root);
  root.querySelectorAll?.('.ai-plain').forEach(tryAdd);
  return [...scope];
}

/** KaTeX 前：\mathrm{Cl}、\text{M} → 數學斜體字母；\text{起始} 等中文標籤保留 */
function normalizeChemLatexInPlain(root) {
  const scopes = collectBoardPlainScopes(root);
  scopes.forEach((plain) => {
    const textNodes = [];
    const walker = document.createTreeWalker(plain, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    textNodes.forEach((textNode) => {
      const parent = textNode.parentElement;
      if (!parent || parent.closest('.choice-label, .katex')) return;
      let s = textNode.textContent || '';
      if (!/\\(?:mathrm|text)\{/.test(s)) return;
      s = s.replace(/\\mathrm\{([^{}]+)\}/g, '$1');
      s = s.replace(/\\text\{([^{}]+)\}/g, (m, inner) => {
        const t = String(inner || '').trim();
        if (BOARD_KEEP_TEXT.test(t) || /[\u4e00-\u9fff]/.test(t)) return m;
        if (/^[A-Za-z]+$/.test(t)) return t;
        return m;
      });
      textNode.textContent = s;
    });
  });
}

/** KaTeX 後：純文字僅包英文字母（數字、標點不包，避免字級與排版跑掉） */
function applyBoardLetterTypography(root) {
  if (!root || typeof document === 'undefined') return;
  const skipSel = '.katex, .math-block, .math-note-popover, .board-latin, .choice-label, script, style';
  collectBoardPlainScopes(root).forEach((plain) => {
    const textNodes = [];
    const walker = document.createTreeWalker(plain, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    textNodes.forEach((textNode) => {
      const parent = textNode.parentElement;
      if (!parent || parent.closest(skipSel)) return;
      const text = textNode.textContent || '';
      if (!/[A-Za-z]/.test(text)) return;
      const re = /[A-Za-z]+/g;
      const frag = document.createDocumentFragment();
      let last = 0;
      let changed = false;
      let match;
      while ((match = re.exec(text))) {
        if (match.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        const span = document.createElement('span');
        span.className = 'board-latin';
        span.textContent = match[0];
        frag.appendChild(span);
        last = match.index + match[0].length;
        changed = true;
      }
      if (!changed) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      parent.replaceChild(frag, textNode);
    });
  });
}

/** 中文與英數片段之間補齊一致空白，避免忽遠忽近 */
function normalizeCjkLatinSpacing(root) {
  if (!root || typeof document === 'undefined') return;
  const scopes = collectBoardPlainScopes(root);
  const addBoundarySpace = (s) => String(s || '')
    .replace(/([\u4e00-\u9fff])([A-Za-z0-9]+(?:[./^_-][A-Za-z0-9]+)*)/g, '$1 $2')
    .replace(/([A-Za-z0-9]+(?:[./^_-][A-Za-z0-9]+)*)([\u4e00-\u9fff])/g, '$1 $2')
    .replace(/([A-Za-z]+)\s*(\d+)/g, '$1$2')
    .replace(/\s{2,}/g, ' ');
  scopes.forEach((plain) => {
    const textNodes = [];
    const walker = document.createTreeWalker(plain, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    textNodes.forEach((textNode) => {
      const parent = textNode.parentElement;
      if (!parent) return;
      if (parent.closest('.katex, .math-block, .choice-label, .solve-section-title')) return;
      const src = textNode.textContent || '';
      if (!/[\u4e00-\u9fff]/.test(src) || !/[A-Za-z0-9]/.test(src)) return;
      const fixed = addBoundarySpace(src);
      if (fixed !== src) textNode.textContent = fixed;
    });
  });
}

function postProcessPlainBoard(root) {
  if (!root) return;
  if (typeof wrapKatexNowrap === 'function') wrapKatexNowrap(root);
  if (typeof bindKatexNumericUnits === 'function') bindKatexNumericUnits(root);
  if (typeof keepMathUnitTails === 'function') keepMathUnitTails(root);
  if (typeof adjustPlainReactionTables === 'function') adjustPlainReactionTables(root);
  hideKatexErrors(root);
  recoverLeakedLatexInDom(root);
  recoverLeakedStashCases(root);
  if (typeof MathNote !== 'undefined') MathNote.postProcessBoard(root);
  markAndSpaceNestedFractions(root);
  syncChoiceLabelBaselines(root);
  normalizePlainLineGaps(root);
  setupHorizontalLineScroll(root);
  requestAnimationFrame(() => {
    normalizePlainLineGaps(root);
    setupHorizontalLineScroll(root);
    requestAnimationFrame(() => normalizePlainLineGaps(root));
  });
  if (typeof stripStrayDollarsInPlain === 'function') stripStrayDollarsInPlain(root);
  normalizeCjkLatinSpacing(root);
  applyBoardLetterTypography(root);
}

function doKaTeX(element) {
  if (!element || typeof renderMathInElement !== 'function') return;
  normalizeChemLatexInPlain(element);
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
