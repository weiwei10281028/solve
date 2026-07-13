/**
 * js/render.js — plain-line 渲染、簡答欄、KaTeX 後處理
 * BUILD: 20250705p4b (修正 \\circC → °C)
 */
window.__RENDER_BUILD = '20260713k';
window.__RENDER_PIPELINE_DEFAULT = 'legacy';

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
  const reactionCount = (b.match(/\\rightleftharpoons|\\rightarrow/g) || []).length;
  if (env === 'array' && reactionCount > 1) return b.replace(/\\\\(?!\[)/g, '\\\\[0.65em]');
  if (env === 'array' && reactionCount) return b;
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
  s = s.replace(/([：:])\s*(\$\$)/g, '$1\n\n$2');
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => `$$${repairInlineMathTypography(inner).replace(/\$/g, '')}$$`);
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

/** 還原 NOTE 嵌套過深而壞掉的 $K_c$ 代入行（保留 2 個 htmlData） */
function salvageBrokenKcDisplayLine(text) {
  if (!/K[_c]|K_c/i.test(text || '')) return String(text || '');
  return String(text || '').split('\n').map((line) => {
    const t = line.trim();
    if (!/K[_c]|K_c/i.test(t)) return line;
    const broken = /\\dfrac\{\s*\^2\}|\\濃度|\\dfrac\{[^}]*\}\{[^}]*\\htmlData/.test(t)
      || (/^\$\$/.test(t) && /\\htmlData/.test(t) && /\\dfrac/.test(t));
    if (!broken) return line;
    const kM = t.match(/=\s*(2\s*\\times\s*10\s*\^?\{?\s*[\d]+\}?)/i);
    const kTail = kM ? `=${kM[1]}` : '';
    const num = /0\.2\s*-\s*x/i.test(t) ? '0.2-x' : '0.2';
    return `$K_c=\\dfrac{\\htmlData{note=平衡時 Cu^{2+}}{${num}}}{\\htmlData{note=Cu^+ 濃度平方}{(2x)^{2}}}${kTail}$`;
  }).join('\n');
}

/** 行內 $…\\begin{array}…$ 反應表 → 獨立 $$…$$，才能走 injectReactionTableHtml */
function promoteInlineReactionArrayToDisplay(text) {
  return String(text || '').split('\n').map((line) => {
    let s = line;
    if (!/\\begin\{array\}/.test(s) || !/\\rightleftharpoons|\\rightarrow/.test(s)) return s;
    s = s.replace(/\$([\s\S]*?\\begin\{array\}[\s\S]*?\\end\{array\}[\s\S]*?)\$/g, (_, inner) => `$$${inner}$$`);
    s = s.replace(/([^\n$\\]{1,80}[：:])\s*(\$\$)/, '$1\n\n$2');
    return s;
  }).join('\n');
}

/** 中文句末緊接 $$…$$ 時拆成獨立行，避免 repairUnclosedInlineMath 拆掉開頭 $$ */
function isolateDisplayMathOnOwnLine(text) {
  let s = String(text || '');
  s = s.replace(/([^\n$\\]{1,200}[：:])\s*(\$\$[\s\S]*?\$\$)/g, '$1\n\n$2');
  s = s.replace(/([^\n$\\]{1,80})\s+(\$\$[\s\S]*?\$\$)/g, (m, prefix, math) => {
    if (/[\$\\]$/.test(prefix)) return m;
    return `${prefix.trimEnd()}\n\n${math}`;
  });
  return s;
}

/** 只移除「落單」的 $$，保留同一行內成對的 $$…$$ */
function stripOrphanDoubleDollars(line) {
  const s = String(line || '');
  if (/^\s*\$\$[\s\S]+\$\$\s*$/.test(s.trim())) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('$$', i)) {
      const close = s.indexOf('$$', i + 2);
      if (close >= 0) {
        out += s.slice(i, close + 2);
        i = close + 2;
        continue;
      }
      i += 2;
      continue;
    }
    out += s[i++];
  }
  return out;
}

/** 行內未閉合 $、孤立 $$（選項評析常見） */
function repairUnclosedInlineMath(text) {
  return String(text || '').split('\n').map((line) => {
    if (/^\s*\$\$/.test(line.trim())) return line;
    let s = stripOrphanDoubleDollars(line);
    const singles = s.match(/(?<!\\)\$/g);
    if (!singles || singles.length % 2 === 0) return s;
    const idx = s.lastIndexOf('$');
    const tail = s.slice(idx + 1);
    if (/[\u4e00-\u9fff]/.test(tail)) {
      const cnAt = tail.search(/[\u4e00-\u9fff]/);
      const mathTail = cnAt > 0 ? tail.slice(0, cnAt).trim() : tail.trim();
      if (cnAt > 0 && mathTail && /\\[a-zA-Z]|[\^_{}\[\]=]/.test(mathTail)) {
        s = `${s.slice(0, idx)}$${mathTail}$${tail.slice(cnAt)}`;
      } else {
        const m = tail.match(/^([^\u4e00-\u9fff]*(?:\\[a-zA-Z]+(?:\{[^{}]*\})*(?:\{[^{}]*\})?|[\^_{}\[\]0-9A-Za-z.+\-=\\]+)*)/);
        if (m && m[1] && /[\^_{}\\]|\\[a-zA-Z]/.test(m[1])) {
          s = `${s.slice(0, idx)}$${m[1]}$${tail.slice(m[1].length)}`;
        } else {
          s = s.slice(0, idx) + tail;
        }
      }
    } else {
      s += '$';
    }
    return s;
  }).join('\n');
}

/**
 * 最後一道本地保護：無法通過 KaTeX 的片段改以可讀純文字呈現。
 * 不猜測化學或數學意義，避免錯誤 LaTeX 讓整段版面崩壞；品質檢查仍會
 * 將結構化輸出中的錯誤交回模型做一次精準修正。
 */
function quarantineInvalidLatexSegmentsLegacy(text) {
  if (typeof katex === 'undefined' || typeof katex.renderToString !== 'function') return String(text || '');
  const { trust, macros } = getKatexOpts();
  return String(text || '').replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g, (whole, displayMath, inlineMath) => {
    const latex = String(displayMath == null ? inlineMath : displayMath).trim();
    if (!latex) return whole;
    try {
      katex.renderToString(latex, {
        displayMode: displayMath != null,
        throwOnError: true,
        strict: 'ignore',
        trust,
        macros
      });
      return whole;
    } catch (err) {
      console.warn('[LaTeX] 已隔離無法渲染的片段', err.message || err);
      return `〔公式格式待修：${latex}〕`;
    }
  });
}

/** 裸寫化學式（SO3、H2O）與 Unicode 下標統一包進 $…$ */
const UNICODE_SUB_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

/** 覆寫舊版隔離器：先修復並實際驗證每段公式，最後才做可讀降級。 */
function quarantineInvalidLatexSegments(text) {
  if (typeof katex === 'undefined' || typeof katex.renderToString !== 'function') return String(text || '');
  const { trust, macros } = getKatexOpts();
  const validate = (latex, displayMode) => {
    katex.renderToString(latex, {
      displayMode: !!displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust,
      macros
    });
    return true;
  };
  if (typeof LatexSanitize !== 'undefined' && LatexSanitize.sanitizeText) {
    return LatexSanitize.sanitizeText(text, { validate });
  }
  return String(text || '').replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g, (whole, displayMath, inlineMath) => {
    const latex = String(displayMath == null ? inlineMath : displayMath).trim();
    if (!latex) return whole;
    try { validate(latex, displayMath != null); return whole; }
    catch (_) { return `〔${latex.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '')}〕`; }
  });
}

function chemDigitsToSubscripts(formula) {
  return String(formula || '').replace(/([A-Z][a-z]?)(\d+)/g, '$1_$2');
}

/** 將化學式片段包成 $CO_2$ 型（不用 \\text{}） */
function wrapChemFormula(formula) {
  let f = String(formula || '').replace(/\\_/g, '_').trim();
  if (!f) return '';
  if (!/_/.test(f) && /[A-Z][a-z]?\d/.test(f)) f = chemDigitsToSubscripts(f);
  return `$${f}$`;
}

/** 修正 AI 常見錯誤：CO\\_2、\\textN_2、H\\_2\\textO 等 */
function repairMalformedChemLatex(text) {
  let s = String(text || '');

  s = s.replace(/\$([^$]+)\$/g, (m, inner) => {
    let fixed = inner
      .replace(/\\text\{([A-Za-z0-9+\-]+)\}/g, (tm, el) => (/[\u4e00-\u9fff]/.test(el) ? tm : el))
      .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
      .replace(/\\text([A-Z][a-z]?(?:_\{?[0-9+\-]+\}?|\d+)*)/g, '$1')
      .replace(/([A-Z][a-z]?)\\_([0-9]+)/g, '$1_$2')
      .replace(/H_2\\textO|H\\_2\\textO/g, 'H_2O');
    return fixed === inner ? m : `$${fixed}$`;
  });

  s = s.replace(/H\\_2\\textO|H\\_2O(?![A-Za-z])/g, (m, off) => {
    if (isInsideDollarMath(s, off)) return m;
    return '$H_2O$';
  });

  s = s.replace(/(?<![A-Za-z$\\])([A-Z][a-z]?)\\_([0-9]+)(?![0-9A-Za-z_])/g, (m, el, num, off) => {
    if (isInsideDollarMath(s, off)) return m;
    return `$${el}_${num}$`;
  });

  s = s.replace(/(?<![A-Za-z$\\{])\\text([A-Z][a-z]?(?:_\{?[0-9+\-]+\}?|\d+)*)/g, (m, formula, off) => {
    if (isInsideDollarMath(s, off)) return m;
    return wrapChemFormula(formula);
  });

  return s;
}

function normalizeUnicodeChemSubscripts(text) {
  return String(text || '').replace(/([A-Z][a-z]?)([₀₁₂₃₄₅₆₇₈₉]+)/g, (m, el, subs, off) => {
    if (isInsideDollarMath(text, off)) return m;
    const digits = [...subs].map((c) => UNICODE_SUB_MAP[c] || c).join('');
    return wrapChemFormula(`${el}_${digits}`);
  });
}

function wrapBareChemicalFormulas(text) {
  let s = normalizeUnicodeChemSubscripts(text);
  const CHEM_RE = /(?<![$\w\\/])([A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)+(?:[A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)*)*)(?![A-Za-z])/g;
  const BINARY_CHEM_RE = /(?<![$\w\\/])([A-Z][a-z]?(?:[A-Z][a-z]?)+)(?![A-Za-z_])/g;
  const CHEM_SKIP = /^(ICE|Kp|Kc|Pa|atm|mol|pH|DNA|RNA|OK|AM|PM)$/i;
  const ionRe = /(?<![A-Za-z$\\])(\[[A-Za-z]+\^[\{]?[0-9+\-]+[\}]?\](?:_\{?[A-Za-z0-9\u4e00-\u9fff]+\}?|_[\u4e00-\u9fff])?|[A-Z][a-z]?\^\{?[0-9+\-]+\}?)(?![A-Za-z])/g;
  return s.split('\n').map((line) => {
    if (/^\s*\$\$/.test(line.trim())) return line;
    let out = line.replace(CHEM_RE, (m, formula, off) => {
      if (isInsideDollarMath(line, off)) return m;
      if (/^(Kp|Kc|ICE|Pa|atm|mol|K)$/i.test(formula)) return m;
      const inner = /_\{?\d/.test(formula) ? formula : chemDigitsToSubscripts(formula);
      return wrapChemFormula(inner);
    });
    out = out.replace(BINARY_CHEM_RE, (m, formula, off) => {
      if (isInsideDollarMath(out, off)) return m;
      if (CHEM_SKIP.test(formula)) return m;
      return wrapChemFormula(formula);
    });
    out = out.replace(ionRe, (m, ion, off) => {
      if (isInsideDollarMath(out, off)) return m;
      return `$${m}$`;
    });
    return out;
  }).join('\n');
}

/** 裸寫 \\text{…}、\\mathrm{…}（含上下標）包進 $…$ */
function repairBareTextMacros(text) {
  const eqSpanRe = /\\(?:text|mathrm)\{[^}]+\}(?:\s*[hH_][0-9]+|\s*_\{?[A-Za-z0-9]+\}?)?\s*[=≈]\s*\\(?:text|mathrm)\{[^}]+\}(?:\s*[hH_][0-9]+|\s*_\{?[A-Za-z0-9]+\}?)?/g;
  let s = String(text || '').replace(eqSpanRe, (m, off) => (isInsideDollarMath(text, off) ? m : `$${m}$`));
  return s.replace(
    /(?<!\$)\\(?:text|mathrm)\{([^{}]+)\}((?:_\{?[^{}$]+\}?|\^\{?[^{}$]+\}?)*)/g,
    (m, inner, tail, off) => {
      if (isInsideDollarMath(s, off)) return m;
      const t = String(inner || '').trim();
      if (/[\u4e00-\u9fff]/.test(t)) {
        const macro = m.includes('\\mathrm') ? 'mathrm' : 'text';
        return `$\\${macro}{${inner}}${tail || ''}$`;
      }
      const combined = `${t}${tail || ''}`.replace(/[{}]/g, '');
      if (/^[A-Z][a-z]?(_\{?\d+\}?|\d|[+\-])*/.test(combined)) {
        return wrapChemFormula(combined);
      }
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
    s = s.replace(/\$([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?)\$\s*(\\propto\s*\\(?:d)?frac\{[^{}]*\}\{[^{}]*\})/g, (m, left, right) => `$${left}${right}$`);
    s = s.replace(/\$([^$\n]+)\$\s*([A-Za-z]?[^$\n]*\\(?:sqrt|dfrac|frac)\{[^{}]*\}[^$\n]*)\$/g, (m, a, b) => `$${a.trim()}${b.trim()}$`);
    s = s.replace(/\$([^$\n]+)\$\s*([A-Za-z]?[^$\n]*\\(?:sqrt|dfrac|frac)\{[^{}]*\}[^$\n]*)(?=\s+[\u4e00-\u9fff]|$)/g, (m, a, b, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$${a.trim()}${b.trim()}$`;
    });
    s = s.replace(/(?<!\$)\\(?:d)?frac\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, (m, n, d, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$\\dfrac{${n}}{${d}}$`;
    });
    s = s.replace(/(?<!\$)([A-Za-z](?:_\{?[A-Za-z0-9]+\}?)?\s*\\propto\s*\\(?:d)?frac\{[^{}]*\}\{[^{}]*\})(?!\$)/g, (m, expr, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$${expr}$`;
    });
    s = s.replace(/(?<!\$)(\\Delta\s+[A-Za-z_]+(?:_\{?[A-Za-z0-9]+\}?)?\s*[=≈＝]\s*[^，。；\n$]{1,80})(?!\$)/g, (m, expr, off) => {
      if (isInsideDollarMath(s, off) || /\$/.test(expr)) return m;
      return `$${expr.trim()}$`;
    });
    s = s.replace(/(?<!\$)(\d(?:\\text\{[spdf]\}\^?\{?\d+\}?)+)(?!\$)/gi, (m, expr, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$${expr}$`;
    });
    s = s.replace(/(?<!\$)(\\(?:dfrac|frac)\{[^{}]+\}\{[^{}]+\}(?:\s*\\times\s*\\(?:dfrac|frac)\{[^{}]+\}\{[^{}]+\})+)(?!\$)/g, (m, expr, off) => {
      if (isInsideDollarMath(s, off)) return m;
      return `$${expr}$`;
    });
    s = s.replace(/(?<!\$)(\[[A-Za-z]+\^[\{]?[0-9+\-]+[\}]?\]_\{?[A-Za-z0-9]+\}?\s*=\s*[\d.]+\s*\\times\s*\\(?:dfrac|frac)\{[^{}]+\}\{[^{}]+\}\s*=\s*[\d.]+)(?!\$)/g, (m, expr, off) => {
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
    if (/^(?:\\[a-zA-Z]+|[\[\]A-Za-z0-9+\-()=\\^_.,\s]+)$/.test(t)
        && (/\\(?:dfrac|frac|times|rightleftharpoons|text|mathrm)/.test(t) || /[\^_{}\[\]]/.test(t))) {
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
const QUESTION_HEADING_NUMBER_RE = /第\s*([\d一二三四五六七八九十]+)\s*題/;

function questionHeadingNumber(line) {
  const m = String(line || '').match(QUESTION_HEADING_NUMBER_RE);
  if (!m) return NaN;
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  const zh = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return zh[m[1]] || NaN;
}

/** 只有使用者明確要求的多題，才可保留「第 N 題」作為綠色分題標題。 */
function isSolveQuestionHeadingAllowed(line) {
  if (!window.__solveMultiQuestion) return false;
  if (window.__solveAllowAnyQuestionHeading) return true;
  const n = questionHeadingNumber(line);
  return Array.isArray(window.__solveQuestionNumbers) && window.__solveQuestionNumbers.includes(n);
}
window.isSolveQuestionHeadingAllowed = isSolveQuestionHeadingAllowed;

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
  return String(text || '').split('\n').filter((line) => {
    const t = line.trim();
    return !QUESTION_HEADING_LINE_RE.test(t) || isSolveQuestionHeadingAllowed(t);
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
        if (inner && /\\[a-zA-Z]|[\^_{}\[\]=+\-]/.test(inner) && close !== '$' && close !== '$$') {
          merged.push(t === '$$' ? `$$${inner}$$` : `$${inner}$`);
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

/** 判斷單位是否屬於等號鏈最後結果；中間代入仍應移除單位。 */
function isTerminalCalcResultUnit(source, offset, length) {
  const before = String(source || '').slice(0, offset);
  const after = String(source || '').slice(offset + length);
  const boundary = Math.max(before.lastIndexOf('；'), before.lastIndexOf(';'), before.lastIndexOf('\\text{，}'));
  const clauseBefore = before.slice(boundary + 1);
  const nextBoundary = after.search(/(?:[；;]|\\text\{，\})/);
  const clauseAfter = nextBoundary >= 0 ? after.slice(0, nextBoundary) : after;
  if (!/[=＝≈]/.test(clauseBefore)) return false;
  return !/(?:[=＝≈+*/]|\\(?:times|cdot|d?frac|sqrt))/.test(clauseAfter);
}

/** 移除模型直接塞進計算過程的原始單位；保留等號鏈最後結果的單位。 */
function stripRawCalcUnitsInInlineMath(text) {
  // 避免誤傷 \log、Hg、Mg 等含 g 的指令、元素或變數名稱。
  const unit = String.raw`(?<![A-Za-z\\])(?:\\(?:text|mathrm)\{\s*)?(?:g|mol)(?:\s*\})?(?=$|[^A-Za-z])`;
  const separator = String.raw`(?:\s*(?:\/|\\(?:cdot|times)|\s+)\s*)`;
  const suffix = String.raw`(?:\s*\^\{?-?1\}?)?`;
  const unitExpression = String.raw`(?:\\,|\\;|\\!|\\\s*|~|\s)*(?:${unit})(?:${separator}${unit}${suffix})?`;
  return String(text || '').split('\n').map((line) => {
    if (!/\$/.test(line) || /^\s*\$\$/.test(line.trim())) return line;
    return line.replace(/\$(?!\$)([\s\S]+?)\$/g, (full, inner) => {
      if (/\\begin\{array\}|\\begin\{cases\}/.test(inner)) return full;
      let s = inner.replace(new RegExp(unitExpression, 'gi'), (matched, offset, source) => (
        isTerminalCalcResultUnit(source, offset, matched.length) ? matched : ''
      ));
      s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,;:])/g, '$1').trim();
      return `$${s}$`;
    });
  }).join('\n');
}

/** 全形等號改半形；裸寫比例／等號式包進 $…$（走 KaTeX 字體，與電荷同路徑） */
/** 移除中間計算單位；NOTE 包數字／因子，末結果與 NOTE 標籤保留單位。 */
function stripAllCalcUnitsAndEmptyNotes(text) {
  const unit = String.raw`(?:mL|mol|kg|mg|g|L|M|min|s|h|atm|kPa|Pa|K|%)`;
  const prefix = String.raw`(?:\\,|\\;|\\!|\\\s*|~|\s)*`;
  const wrapped = String.raw`(?:\\(?:text|mathrm)\{\s*${unit}\s*\}|${unit})`;
  const numericUnit = new RegExp(String.raw`(?<=[\d\}])${prefix}${wrapped}(?=$|[^A-Za-z])`, 'gi');
  const unitOnlyNote = new RegExp(String.raw`\\htmlData\{[^{}]*\}\{\s*${wrapped}\s*\}`, 'gi');
  return String(text || '').replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g, (whole, displayMath, inlineMath) => {
    const delimiter = displayMath != null ? '$$' : '$';
    const inner = String(displayMath == null ? inlineMath : displayMath);
    if (/\\begin\{array\}|\\begin\{cases\}/.test(inner)) return whole;
    let s = inner.replace(new RegExp(String.raw`([\d}])(?:\\,|,|\s)+(?=${wrapped}(?=$|[^A-Za-z]))`, 'gi'), '$1\\,');
    s = s.replace(numericUnit, (matched, offset, source) => (
      isTerminalCalcResultUnit(source, offset, matched.length) ? matched : ''
    ));
    s = s.replace(/(?<=[\d\}])(?:\\,|\\;|\\!|\\\s*|~|\s)*\^\{\\circ\}(?:\\(?:text|mathrm)\{C\}|C)/gi, '');
    s = s.replace(unitOnlyNote, '');
    s = s.replace(/\\htmlData\{[^{}]*\}\{\s*\}/g, '');
    s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,;:])/g, '$1').trim();
    return `${delimiter}${s}${delimiter}`;
  });
}

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

/** 修正算式內常見 LaTeX 錯誤與步驟黏連（不動 array；保留 htmlData） */
function repairInlineMathTypography(inner) {
  let s = String(inner || '');
  if (/\\begin\{array\}/.test(s)) return s;
  const cuSqExp = '(?:\\^\\{[0-9]+\\}|\\^[0-9]+(?!\\}))';
  s = s.replace(
    new RegExp(`\\\\dfrac\\{([^{}]+)\\}\\{(\\\\htmlData\\{note=[^}]+\\}\\{\\(2[xX]\\)${cuSqExp})\\s*[=＝]\\s*(2\\s*\\\\times\\s*10\\s*\\^?\\{?\\s*[0-9]+\\}?)`, 'g'),
    '\\dfrac{$1}{$2}} = $3'
  );
  s = s.replace(
    new RegExp(`\\\\dfrac\\{([^{}]+)\\}\\{(\\(2[xX]\\)${cuSqExp})\\s*[=＝]\\s*(2\\s*\\\\times\\s*10\\s*\\^?\\{?\\s*[0-9]+\\}?)`, 'g'),
    '\\dfrac{$1}{$2} = $3'
  );
  s = s.replace(
    /\\dfrac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{(\([^)]+\)\^?\{?[0-9]+\}?)\s*[=＝]\s*(2\s*\\times\s*10\s*\^?\{?\s*[0-9]+\}?)/g,
    '\\dfrac{$1}{$2} = $3'
  );
  s = s.replace(/\(\(2[xX]\)\^?\{?\s*2\s*\}?\)(\^?\{?\s*2\s*\}?)/g, '(2x)^{2}');
  s = s.replace(
    /\(\\htmlData(\{note=[^}]+\})\{(?:2[xX]|\(2[xX]\)\^?\{?\s*2\s*\}?)\}\)(\^?\{?\s*2\s*\}?)/gi,
    '\\htmlData$1{(2x)^{2}}'
  );
  s = s.replace(/\\setminus\s*times/g, '\\times');
  s = s.replace(/\\backslash\s*\\text\{circC\}/gi, '^{\\circ}\\mathrm{C}');
  s = s.replace(/\\text\{circC\}/gi, '^{\\circ}\\mathrm{C}');
  s = s.replace(/\\mathrm\{circC\}/gi, '^{\\circ}\\mathrm{C}');
  s = s.replace(/\\circC\b/gi, '^{\\circ}\\mathrm{C}');
  s = s.replace(/(\d+(?:\.\d+)?)\s*\^\{\\circ\}\s*C\b/g, '$1^{\\circ}\\mathrm{C}');
  s = s.replace(/(\d+(?:\.\d+)?)\s*\\circ\s*C\b/g, '$1^{\\circ}\\mathrm{C}');
  s = s.replace(/(?<!\^)\{\\circ\}(?!\{)/g, '^{\\circ}');
  s = s.replace(/(?<!\^)\^\{\\circ\}\\mathrm\{C\}/g, '^{\\circ}\\mathrm{C}');
  s = s.replace(/(?<!\^)\^\{\\circ\}\\text\{C\}/g, '^{\\circ}\\mathrm{C}');
  s = s.replace(/(?<!\{)10\^(-?\d+)(?![0-9\{\w])/g, '10^{$1}');
  s = s.replace(/\\htmlData(\{note=[^}]+\})\{2[xX]\}(\^?\{?\s*2\s*\}?)/g, '\\htmlData$1{(2x)^{2}}');
  s = s.replace(/\\htmlData(\{note=[^}]+\})\{\(2[xX]\)\^?\{?\s*2\s*\}?\}(\^?\{?\s*2\s*\}?)/g, '\\htmlData$1{(2x)^{2}}');
  s = s.replace(/\\htmlData(\{note=[^}]+\})\{2[xX]\^?\{?\s*2\s*\}?\}/g, '\\htmlData$1{(2x)^{2}}');
  if (/K[_c]|0\.2|[Cc]u|\^\+/.test(s)) {
    s = s.replace(/\\dfrac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{2[xX]\^?\{?\s*2\s*\}?\}/g, '\\dfrac{$1}{(2x)^{2}}');
    s = s.replace(
      /\\dfrac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{\\htmlData(\{note=[^}]+\})\{2[xX]\}\^?\{?\s*2\s*\}?\}/g,
      '\\dfrac{$1}{\\htmlData$2{(2x)^{2}}}'
    );
  }
  s = s.replace(/(\\times\s*10\^\{-?\d+\})\s+(?=[xX]\s*[=≈\\])/g, '$1\\text{，}\\quad ');
  s = s.replace(/(10\^\{-?\d+\})\s+(?=[xX]\s*[=≈\\])/g, '$1\\text{，}\\quad ');
  s = s.replace(/(\})\s+(?=[xX]\s*=\s*\\(?:sqrt|dfrac|frac|[0-9.]))/g, '$1\\text{，}\\quad ');
  s = s.replace(
    /(=\s*(?:\\htmlData\{note=[^}]+\}\{[^}]+\}|\d+(?:\.\d+)?(?:\\times\s*10\^\{-?\d+\})?))\s+(?=[xX]\d*\s*[=≈])/g,
    '$1\\text{，}\\quad '
  );
  return s;
}

function repairCalcMathTypography(text) {
  return String(text || '').split('\n').map((line) => {
    let s = line;
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => `$$${repairInlineMathTypography(inner)}$$`);
    s = s.replace(/\$(?!\$)([\s\S]+?)\$/g, (full, inner) => `$${repairInlineMathTypography(inner)}$`);
    return s;
  }).join('\n');
}

function preprocessBoardCompiledText(raw) {
  let text = String(raw || '').trim();
  text = salvageBrokenKcDisplayLine(text);
  text = promoteInlineReactionArrayToDisplay(text);
  text = isolateDisplayMathOnOwnLine(text);
  text = repairMalformedChemLatex(text);
  text = repairCalcMathTypography(text);
  if (typeof flattenReactionIceTables === 'function') text = flattenReactionIceTables(text);
  text = fixLatexBlocks(text);
  if (typeof collapseReactionTableBlocks === 'function') text = collapseReactionTableBlocks(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessEarly(text);
  text = repairBareTextMacros(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessLate(text);
  text = quarantineInvalidLatexSegments(text);
  return text;
}

/** legacy AI 自由文字：完整 regex 修復管線 */
function preprocessLegacyPlainText(raw) {
  let text = stripMatchComments(String(raw || '').trim());
  text = normalizeAiHeadings(text);
  text = dropCoreConceptLines(text);
  text = repairGarbledEntities(text);
  text = salvageBrokenKcDisplayLine(text);
  text = promoteInlineReactionArrayToDisplay(text);
  text = isolateDisplayMathOnOwnLine(text);
  text = repairMalformedChemLatex(text);
  text = repairCalcMathTypography(text);
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
  text = repairMalformedChemLatex(text);
  text = normalizeMathOperatorsInPlain(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessEarly(text);
  text = repairBareTextMacros(text);
  if (typeof mergeAdjacentInlineMath === 'function') text = mergeAdjacentInlineMath(text);
  text = repairCalcMathTypography(text);
  if (typeof mergeOrphanMathContinuationLines === 'function') text = mergeOrphanMathContinuationLines(text);
  if (typeof mergeOrphanUnitLines === 'function') text = mergeOrphanUnitLines(text);
  text = mergeOrphanPunctuationLines(text);
  text = repairOrphanDollarLines(text);
  text = isolateDisplayMathOnOwnLine(text);
  text = repairUnclosedInlineMath(text);
  text = repairBareTextMacros(text);
  text = stripRawCalcUnitsInInlineMath(text);
  text = stripAllCalcUnitsAndEmptyNotes(text);
  text = fixLatexBlocks(text);
  if (typeof MathNote !== 'undefined') text = MathNote.preprocessLate(text);
  text = repairOrphanDollarLines(text);
  text = quarantineInvalidLatexSegments(text);
  return text;
}

function preprocessPlainText(raw) {
  return preprocessLegacyPlainText(raw);
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
    const t = indexed[j].t;
    if (/^\$\$[\s\S]*\$\$$/.test(t) || (/\\(?:dfrac|begin\{array\})/.test(t) && /[=＝≈]/.test(t) && visiblePlainLen(t) < 24)) break;
    const len = visiblePlainLen(t);
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

/** 答案行：含 LaTeX 特徵則包進 $…$ 再走 KaTeX（與正文同字體） */
function wrapAnswerLineForKaTeX(line) {
  let s = String(line || '').trim();
  if (!s) return s;
  if (/^\$\$[\s\S]+\$\$$/.test(s)) return s;
  if (/^\$/.test(s) && s.indexOf('$', 1) > 0) return s;
  if (/\\[a-zA-Z]|[\^_{}]/.test(s) || /\d\s*\\times\s*10/i.test(s)) {
    return `$${s.replace(/(?<!\\)\$/g, '')}$`;
  }
  return s;
}

function formatAnswerInner(line) {
  const wrapped = wrapAnswerLineForKaTeX(line);
  if (/\$/.test(wrapped) || /\\[a-zA-Z]|[\^_{}]/.test(wrapped)) {
    return escapePlainBody(wrapped);
  }
  return esc(wrapped);
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
    return `<div class="answer-box answer-box--final">答：${formatAnswerInner(lines[0])}</div>`;
  }
  const items = lines.map(l => `<div class="answer-box-item">${formatAnswerInner(l)}</div>`).join('');
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
  let scope = { mode: 'default', numbers: [] };
  if (typeof parseRequestedSolveScope === 'function') {
    scope = parseRequestedSolveScope(raw);
  }
  const numbers = scope.mode === 'partial' ? scope.numbers.slice() : [];
  window.__solveQuestionNumbers = numbers;
  window.__solveAllowAnyQuestionHeading = scope.mode === 'all';
  window.__solveMultiQuestion = scope.mode === 'all' || numbers.length > 1;
  window.__solveHeadingMode = window.__solveMultiQuestion ? 'numbered' : 'neutral';
}

function assemblePlainHtml(preprocessed, answerText, opts) {
  opts = opts || {};
  let body = String(preprocessed || '');
  body = normalizeExamQuestionHeadings(body);
  if (window.__solveMultiQuestion && countQuestionSections(body) >= 2) {
    window.__solveHeadingMode = 'numbered';
  }
  body = stripStandaloneQuestionHeadingLines(body);
  if (typeof neutralizeQuestionHeadings === 'function') {
    body = neutralizeQuestionHeadings(body);
  }
  if (typeof injectReactionTableHtml === 'function') {
    body = injectReactionTableHtml(body);
  }
  const escaped = escapePlainBody(body);
  const layoutInput = typeof restoreReactionTablePlaceholders === 'function'
    ? restoreReactionTablePlaceholders(escaped)
    : escaped;
  const layoutFn = typeof layoutPlainSolveText === 'function'
    ? layoutPlainSolveText
    : fallbackPlainLayout;
  const qCount = countQuestionSections(body);
  const singleQuestion = opts.singleQuestion != null ? opts.singleQuestion : qCount <= 1;
  return `<div class="ai-plain">${layoutFn(layoutInput)}${buildAnswerHtml(answerText, { singleQuestion })}</div>`;
}

function render(rawText) {
  if (!rawText) return `<div class="ai-plain">${buildAnswerHtml('—')}</div>`;

  const { body, answerText } = splitBodyAndAnswer(String(rawText).trim());
  const preprocessed = preprocessLegacyPlainText(body);
  return assemblePlainHtml(preprocessed, answerText);
}

const BOARD_MARKER_START = '@@BOARD@@';
const BOARD_MARKER_END = '@@END@@';
const BOARD_DOC_VERSION = 1;
const BOARD_COMPILE_TYPES = new Set(['section', 'paragraph', 'math', 'mol', 'rxn-table', 'choice-group']);

function extractJsonObject(str) {
  const s = String(str || '').trim();
  if (!s.startsWith('{')) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(0, i + 1);
    }
  }
  return null;
}

function normalizeBoardBlock(block) {
  if (!block || typeof block !== 'object') return block;
  const b = Object.assign({}, block);
  const kind = String(b.kind || '');
  const type = String(b.type || '');
  if (!type && kind && BOARD_COMPILE_TYPES.has(kind)) b.type = kind;
  if (b.type === 'paragraph' && !Array.isArray(b.parts) && typeof b.text === 'string') {
    b.parts = [{ kind: 'text', text: b.text }];
  }
  if (b.type === 'choice-group') {
    const sourceItems = Array.isArray(b.items) ? b.items : (Array.isArray(b.choices) ? b.choices : []);
    b.items = sourceItems.map((item, index) => {
      const out = Object.assign({}, item);
      const rawLetter = String(out.letter || out.label || '').toUpperCase();
      out.letter = (rawLetter.match(/[A-E]/) || [String.fromCharCode(65 + index)])[0];
      if (Array.isArray(out.parts)) {
        out.parts = out.parts.map((part) => typeof part === 'string'
          ? { kind: 'text', text: part }
          : part);
      } else {
        const text = typeof out.text === 'string' ? out.text : out.reason;
        out.parts = typeof text === 'string' ? [{ kind: 'text', text }] : [];
      }
      return out;
    });
  }
  return b;
}

function normalizeBoardDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = Object.assign({}, doc);
  if (out.version == null) out.version = BOARD_DOC_VERSION;
  if (Array.isArray(out.blocks)) out.blocks = out.blocks.map(normalizeBoardBlock);
  return out;
}

/* 舊版模型曾在 JSON 字串內直接放 LaTeX 的單一反斜線（如 \dfrac、\times）。
   JSON 會將 \t 當成 tab，或因未知跳脫字元而解析失敗；先只修正字串內的反斜線。 */
function escapeLatexBackslashesInJson(jsonText) {
  const text = String(jsonText || '');
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = text[i + 1] || '';
    const unicodeEscape = next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6));
    if (next === '\\' || next === '"' || next === '/' || unicodeEscape) {
      out += ch + next;
      i++;
    } else {
      out += '\\\\';
    }
  }
  return out;
}

function parseBoardJson(jsonText) {
  const escaped = escapeLatexBackslashesInJson(jsonText);
  try {
    return JSON.parse(escaped);
  } catch (_) {
    try { return JSON.parse(jsonText); } catch (_) { return null; }
  }
}

function parseBoard(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const start = text.indexOf(BOARD_MARKER_START);
  if (start >= 0) {
    const payloadStart = start + BOARD_MARKER_START.length;
    const end = text.indexOf(BOARD_MARKER_END, payloadStart);
    let jsonStr;
    let remainder;
    if (end >= 0) {
      jsonStr = text.slice(payloadStart, end).trim();
      remainder = (text.slice(0, start) + text.slice(end + BOARD_MARKER_END.length)).trim();
    } else {
      const after = text.slice(payloadStart).trim();
      jsonStr = extractJsonObject(after);
      if (!jsonStr) return null;
      const tail = after.slice(jsonStr.length).trim();
      const head = text.slice(0, start).trim();
      remainder = head ? `${head}\n${tail}` : tail;
    }
    const doc = parseBoardJson(jsonStr);
    return doc ? { doc: normalizeBoardDoc(doc), remainder } : null;
  }

  if (text.startsWith('{') && text.endsWith('}')) {
    const doc = parseBoardJson(text);
    if (doc && Array.isArray(doc.blocks)) return { doc: normalizeBoardDoc(doc), remainder: '' };
  }
  return null;
}

function wrapBoardMathLatex(latex, display) {
  const t = String(latex || '').trim();
  if (!t) return '';
  const needsDisplay = display || /\\begin\{(array|cases|aligned)/.test(t);
  return needsDisplay ? `$$${t}$$` : `$${t}$`;
}

function compileParagraphParts(parts) {
  return (parts || []).map((p) => {
    const kind = String(p?.kind || '');
    if (kind === 'text') return String(p.text || '');
    if (kind === 'math' || kind === 'chem') {
      return wrapBoardMathLatex(p.latex, false);
    }
    return '';
  }).join('');
}

function formatRxnTableCell(cell) {
  const t = String(cell ?? '').trim();
  if (!t || t === '—' || t === '-' || t === '–') return '\\text{—}';
  if (/^\\/.test(t)) return t;
  if (/[\u4e00-\u9fff]/.test(t)) return `\\text{${t}}`;
  return t;
}

function formatRxnTableLabel(label) {
  const t = String(label || '').trim();
  if (!t) return '';
  if (/^\\text\{/.test(t)) return t;
  if (/[\u4e00-\u9fff]/.test(t)) return `\\text{${t}}`;
  return t;
}

function compileChoiceItemStep(step) {
  if (step == null) return '';
  if (typeof step === 'string') return step.trim();
  if (Array.isArray(step)) return compileParagraphParts(step);
  if (step.parts) return compileParagraphParts(step.parts);
  return '';
}

function compileChoiceItemSteps(item) {
  const steps = [];
  if (Array.isArray(item?.steps) && item.steps.length) {
    for (const step of item.steps) {
      const s = compileChoiceItemStep(step);
      if (s) steps.push(s);
    }
  } else if (item?.parts) {
    const s = compileParagraphParts(item.parts);
    if (s.trim()) steps.push(s.trim());
  }
  return steps;
}

function compileChoiceGroup(block) {
  const lines = [];
  for (const item of block?.items || []) {
    const letter = String(item?.letter || '').trim().toUpperCase();
    if (!/^[A-E]$/.test(letter)) continue;
    const steps = compileChoiceItemSteps(item);
    if (!steps.length) continue;
    lines.push(`(${letter}) ${steps[0]}`);
    for (let i = 1; i < steps.length; i++) lines.push(steps[i]);
  }
  return lines.join('\n');
}

function compileRxnTable(block) {
  const header = block?.header || block?.reaction || [];
  const rows = block?.rows || [];
  const outRows = [];
  if (header.length) {
    outRows.push(header.map((c) => formatRxnTableCell(c) || ' ').join(' & '));
  }
  for (const row of rows) {
    if (row?.hlineBefore) outRows.push('\\hline');
    const label = formatRxnTableLabel(row?.label || '');
    const cells = (row?.cells || []).map(formatRxnTableCell);
    const parts = label ? [label, ...cells] : cells;
    if (parts.length) outRows.push(parts.join(' & '));
  }
  if (outRows.length < 2) return '';
  let maxCols = 1;
  for (const r of outRows) {
    if (r === '\\hline') continue;
    maxCols = Math.max(maxCols, r.split('&').length);
  }
  let spec = String(block?.align || '').replace(/\|/g, '');
  if (spec.length < maxCols) spec = 'l' + 'c'.repeat(Math.max(1, maxCols - 1));
  else if (spec.length > maxCols) spec = spec.slice(0, maxCols);
  return `$$\\begin{array}{${spec}}\n${outRows.join(' \\\\\n ')}\n\\end{array}$$`;
}

function compileBlockToLine(block) {
  const b = block || {};
  const type = String(b.type || '');
  if (type === 'section') {
    const title = String(b.title || '').trim();
    return title ? `【${title.replace(/^【|】$/g, '')}】` : '';
  }
  if (type === 'paragraph') {
    return compileParagraphParts(b.parts).trim();
  }
  if (type === 'math') {
    const latex = String(b.latex || '').trim();
    if (!latex) return '';
    return wrapBoardMathLatex(latex, !!b.display);
  }
  if (type === 'mol') {
    const query = String(b.query || b.id || '').trim();
    if (!query) return '';
    const label = String(b.label || '').trim();
    return label ? `@@MOL:${query}|${label}@@` : `@@MOL:${query}@@`;
  }
  if (type === 'rxn-table') {
    return compileRxnTable(b);
  }
  if (type === 'choice-group') {
    return compileChoiceGroup(b);
  }
  return '';
}

function compileBoardBody(doc) {
  const lines = [];
  for (const block of doc?.blocks || []) {
    const type = String(block?.type || '');
    if (!BOARD_COMPILE_TYPES.has(type)) {
      console.warn('[BoardDoc] 略過 block type:', type);
      continue;
    }
    const line = compileBlockToLine(block);
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

function compileBoardAnswer(answer) {
  if (answer == null) return '—';
  if (typeof answer === 'string') return cleanAnswerDisplay(answer) || '—';
  const parts = answer.parts || [];
  let textTail = '';
  const latexParts = [];
  for (const p of parts) {
    const kind = String(p?.kind || '');
    if (kind === 'text') textTail += String(p.text || '');
    else if (kind === 'math' || kind === 'chem') {
      const latex = String(p.latex || '').trim();
      if (latex) latexParts.push(latex);
    }
  }
  const unit = String(answer.unit || '').trim();
  let line = textTail.trim();
  if (latexParts.length) {
    const core = latexParts.join('');
    const body = unit ? `${core}\\,\\mathrm{${unit}}` : core;
    line = line ? `${line} $${body}$` : `$${body}$`;
  } else if (unit) {
    line = line ? `${line} ${unit}` : unit;
  }
  return cleanAnswerDisplay(line) || '—';
}

function collectBoardLatexFields(doc) {
  const items = [];
  (doc?.blocks || []).forEach((block, i) => {
    const type = String(block?.type || '');
    if (type === 'math' && block.latex) {
      items.push({ path: `blocks[${i}].latex`, latex: String(block.latex), display: !!block.display });
    }
    if (type === 'paragraph' && Array.isArray(block.parts)) {
      block.parts.forEach((p, j) => {
        if ((p.kind === 'math' || p.kind === 'chem') && p.latex) {
          items.push({ path: `blocks[${i}].parts[${j}].latex`, latex: String(p.latex), display: false });
        }
      });
    }
    if (type === 'choice-group' && Array.isArray(block.items)) {
      block.items.forEach((item, j) => {
        const walkParts = (parts, prefix) => {
          (parts || []).forEach((p, k) => {
            if ((p.kind === 'math' || p.kind === 'chem') && p.latex) {
              items.push({ path: `${prefix}[${k}].latex`, latex: String(p.latex), display: false });
            }
          });
        };
        if (Array.isArray(item.steps)) {
          item.steps.forEach((step, k) => {
            if (step?.parts) walkParts(step.parts, `blocks[${i}].items[${j}].steps[${k}].parts`);
            else if (Array.isArray(step)) walkParts(step, `blocks[${i}].items[${j}].steps[${k}]`);
          });
        } else if (item.parts) {
          walkParts(item.parts, `blocks[${i}].items[${j}].parts`);
        }
      });
    }
  });
  (doc?.answer?.parts || []).forEach((p, j) => {
    if ((p.kind === 'math' || p.kind === 'chem') && p.latex) {
      items.push({ path: `answer.parts[${j}].latex`, latex: String(p.latex), display: false });
    }
  });
  return items;
}

function validateBoardDoc(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return { ok: false, errors: ['BoardDoc 非物件'] };
  }
  if (Number(doc.version) !== BOARD_DOC_VERSION) {
    errors.push(`version 須為 ${BOARD_DOC_VERSION}`);
  }
  if (!Array.isArray(doc.blocks)) {
    errors.push('blocks 須為陣列');
  } else {
    doc.blocks.forEach((block, i) => {
      const type = String(block?.type || '');
      if (!type) errors.push(`blocks[${i}] 缺少 type`);
      else if (!BOARD_COMPILE_TYPES.has(type)) {
        errors.push(`blocks[${i}] 未知 type: ${type}`);
      } else if (type === 'choice-group') {
        if (!Array.isArray(block.items) || !block.items.length) {
          errors.push(`blocks[${i}] choice-group 須有 items`);
        } else {
          block.items.forEach((item, j) => {
            const letter = String(item?.letter || '').trim().toUpperCase();
            if (!/^[A-E]$/.test(letter)) {
              errors.push(`blocks[${i}].items[${j}] letter 須為 A～E`);
            }
            if (!compileChoiceItemSteps(item).length) {
              errors.push(`blocks[${i}].items[${j}] 須有 parts 或 steps`);
            }
          });
        }
      }
    });
  }
  if (typeof katex !== 'undefined') {
    const { trust, macros } = getKatexOpts();
    for (const item of collectBoardLatexFields(doc)) {
      try {
        katex.renderToString(item.latex, {
          displayMode: !!item.display,
          throwOnError: true,
          strict: 'ignore',
          trust,
          macros
        });
      } catch (err) {
        errors.push(`${item.path}: ${err.message || err}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function renderBoard(doc) {
  if (!doc) return `<div class="ai-plain">${buildAnswerHtml('—')}</div>`;
  let body = compileBoardBody(doc);
  body = preprocessBoardCompiledText(body);
  const answerText = compileBoardAnswer(doc.answer);
  return assemblePlainHtml(body, answerText, { singleQuestion: true });
}

function tryRenderBoardDoc(raw) {
  const parsed = parseBoard(raw);
  if (!parsed?.doc) return null;
  let doc = parsed.doc;
  if (doc.answer == null && parsed.remainder && typeof splitBodyAndAnswer === 'function') {
    const tail = splitBodyAndAnswer(parsed.remainder);
    if (tail.answerText && tail.answerText !== '—') {
      doc = Object.assign({}, doc, { answer: tail.answerText });
    }
  }
  const validation = validateBoardDoc(doc);
  const compiled = compileBoardBody(doc);
  if (!compiled.trim() && !validation.ok) return null;
  return { html: renderBoard(doc), validation, doc };
}

function boardDocToCheckText(raw) {
  const parsed = parseBoard(raw);
  if (!parsed?.doc) return null;
  let doc = parsed.doc;
  let text = compileBoardBody(doc);
  let answerText = '';
  if (doc.answer != null) {
    answerText = compileBoardAnswer(doc.answer);
  } else if (parsed.remainder && /@@ANSWER@@/.test(parsed.remainder)) {
    const idx = parsed.remainder.lastIndexOf(ANSWER_MARKER);
    answerText = parsed.remainder.slice(idx + ANSWER_MARKER.length).trim();
  }
  if (answerText && answerText !== '—') {
    text += `\n@@ANSWER@@${answerText}`;
  }
  return text;
}

window.preprocessBoardCompiledText = preprocessBoardCompiledText;
window.preprocessLegacyPlainText = preprocessLegacyPlainText;
window.parseBoard = parseBoard;
window.normalizeBoardDoc = normalizeBoardDoc;
window.validateBoardDoc = validateBoardDoc;
window.renderBoard = renderBoard;
window.tryRenderBoardDoc = tryRenderBoardDoc;
window.compileBoardBody = compileBoardBody;
window.compileBoardAnswer = compileBoardAnswer;
window.boardDocToCheckText = boardDocToCheckText;

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
      if (/\\(?:dfrac|frac)\{/.test(t)) return true;
      if (/[A-Za-z]\^\{?[0-9+\-]+\}?/.test(t)) return true;
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
    let tex = (el.textContent || '').trim().replace(/^\$+|\$+$/g, '');
    tex = repairInlineMathTypography(tex);
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

const LEAKED_LATEX_SNIPPET_RE = /\\(?:text|mathrm)\{[^{}]+\}(?:_\{?[^{}$]+\}?|\^\{?[^{}$]+\}?)*(?:\s*[hH_0-9]+\s*[=≈]\s*\\(?:text|mathrm)\{[^{}]+\}(?:\s*[hH_0-9]+)?)?|\\(?:dfrac|frac)\{[^{}]+\}\{[^{}]+\}(?:\s*\\times\s*\\(?:dfrac|frac)\{[^{}]+\}\{[^{}]+\})*|\[[A-Za-z]+\^[\{]?[0-9+\-]+[\}]?\](?:_\{?[A-Za-z0-9\u4e00-\u9fff]+\}?|_[\u4e00-\u9fff])?|[A-Z][a-z]?\^\{?[0-9+\-]+\}?|\d(?:\\text\{[spdf]\}\^?\{?\d+\}?)+/gi;

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
        const holder = tryRenderLatex(repairInlineMathTypography(m[0]), false);
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
  const getPartBoxBottom = (part) => {
    if (!part) return 0;
    const r = part.getBoundingClientRect();
    let bottom = r.bottom;
    part.querySelectorAll('.math-note--frac-part, .math-note[data-note], [data-note].math-note').forEach((el) => {
      const br = el.getBoundingClientRect();
      if (br.height > 0) bottom = Math.max(bottom, br.bottom);
    });
    return bottom;
  };
  const getPartBoxTop = (part) => {
    if (!part) return 0;
    const r = part.getBoundingClientRect();
    let top = r.top;
    part.querySelectorAll('.math-note--frac-part, .math-note[data-note], [data-note].math-note').forEach((el) => {
      const br = el.getBoundingClientRect();
      if (br.height > 0) top = Math.min(top, br.top);
    });
    return top;
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
        const gap = line.top - getPartBoxBottom(innerLayout.denPart);
        const shift = (gap < target ? -(target - gap) : 0) - NUM_EXTRA_UP_PX;
        if (shift) setPartTranslateY(innerLayout.denPart, shift);
      }
      if (zone === 'denominator' && innerLayout.numPart) {
        const gap = getPartBoxTop(innerLayout.numPart) - line.bottom;
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

const BOARD_KEEP_TEXT = /^(起始|變化|結果|移至左|移至右|完全反應|完全移至|完全向左|完全向右|再向左|再向右|後來體積|原來體積|初|平|平衡|右|左|初始)$/;

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
    macros,
    preProcess: (math) => repairInlineMathTypography(String(math || '').replace(/^\$+|\$+$/g, ''))
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
