/**
 * js/render.js — plain-line 渲染、簡答欄、KaTeX 後處理
 * BUILD: 20250705p4b (修正 \\circC → °C)
 */
window.__RENDER_BUILD = '20260719-single-pipeline';
window.__RENDER_PIPELINE_DEFAULT = 'markdown';

const BOARD_LAYOUT_ENABLED = false;
const ANSWER_MARKER = '@@ANSWER@@';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isInsideDollarMath(str, index) {
  const before = String(str || '').slice(0, Math.max(0, index));
  let n = 0;
  for (const ch of before) if (ch === '$') n++;
  return n % 2 === 1;
}


function chemDigitsToSubscripts(formula) {
  return String(formula || '').replace(/([A-Z][a-z]?)(\d+)/g, '$1_$2');
}

function chemistryLatex(body) {
  const chemistry = String(body || '').trim();
  // 化學式統一交給 KaTeX mhchem；禁止降級成普通文字或手工上下標。
  return `\\ce{${chemistry}}`;
}

function normalizeMhchemForKatex(latex) {
  // Keep a final guard at the renderer boundary for structured replies that
  // do not pass through LatexSanitize.  Only a double-escaped mhchem command
  // is changed; ordinary LaTeX escapes and layout remain untouched.
  const normalized = String(latex || '').replace(/\\\\ce(?=\{)/g, '\\ce');
  return normalized;
}

/** 將化學式片段包成 $CO_2$ 型（不用 \\text{}） */
function wrapChemFormula(formula) {
  let f = String(formula || '').replace(/\\_/g, '_').trim();
  if (!f) return '';
  f = f
    .replace(/_\{?(\d+)\}?/g, '$1')
    .replace(/\^\{?([0-9]*[+\-])\}?/g, '^$1');
  return `$${chemistryLatex(f)}$`;
}

function isChemLatexToken(value) {
  const t = String(value || '').trim();
  return /^(?:[A-Z][a-z]?(?:_\{?\d+\}?|\d+)?)+(?:\^\{?[0-9]*[+\-]\}?)?$/.test(t);
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
    if (isChemLatexToken(fixed)) return wrapChemFormula(fixed);
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
  const source = String(text || '');
  const sub = /[₀₁₂₃₄₅₆₇₈₉]/g;
  const supMap = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
  const toLatex = (formula, charge) => {
    const base = String(formula).replace(sub, (ch) => UNICODE_SUB_MAP[ch] || ch);
    const chem = chemDigitsToSubscripts(base);
    const suffix = charge ? `^{${[...charge].map((ch) => supMap[ch] || ch).join('')}}` : '';
    return wrapChemFormula(chem + suffix);
  };
  // Process the complete formula at once: $SO_3$ is one token, never a bare
  // S followed by a separately rendered O_3.
  let out = source.replace(/(?<![$\w\\])((?:[A-Z][a-z]?[₀₁₂₃₄₅₆₇₈₉0-9]*){2,})([⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻])?(?![A-Za-z0-9_])/g, (m, formula, charge, off) => {
    if (isInsideDollarMath(source, off)) return m;
    return toLatex(formula, charge);
  });
  out = out.replace(/(?<![$\w\\])([A-Z][a-z]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+[⁺⁻])(?![A-Za-z0-9_])/g, (m, formula, charge, off) => {
    if (isInsideDollarMath(out, off)) return m;
    return toLatex(formula, charge);
  });
  return out;
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
      return wrapChemFormula(ion);
    });
    return out;
  }).join('\n');
}

/** 裸寫 \\text{…}、\\mathrm{…}（含上下標）包進 $…$ */
function mapOutsideMathSegments(text, mapper) {
  return String(text || '').split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g).map((part) => {
    if (/^\$\$[\s\S]*\$\$$/.test(part) || /^\$[^$\n]*\$$/.test(part)) return part;
    return mapper(part);
  }).join('');
}

/* Convert common AI plain-text math dialects into independent inline tokens. */
function wrapPlainNumericRuns(text) {
  let output = mapOutsideMathSegments(text, (plain) => plain.replace(
    /(?<![A-Za-z_\\\d.])(\d+(?:\.\d+)?(?:\s*(?:[+\-×*/÷=≈])\s*\d+(?:\.\d+)?)+)(?![A-Za-z_\\\d.])/g,
    (match, expression) => `$${expression.replace(/×/g, '\\times ').replace(/÷/g, '\\div ')}$`
  ));
  output = mapOutsideMathSegments(output, (plain) => plain.replace(
    /(?<![A-Za-z_\\\d.])(\d+(?:\.\d+)?)(?![A-Za-z_\\\d.^])/g,
    (match, number) => `$${number}$`
  ));
  return output;
}

/**
 * Keep only scientific tokens in KaTeX.  Ordinary English prose stays as
 * browser text and may wrap naturally; quantities, variables, units and
 * chemistry abbreviations share the same KaTeX/NOTE-capable path.
 */
function wrapSemanticMathTokens(text) {
  return mapOutsideMathSegments(text, (plain) => {
    let s = plain;
    const unitLatex = (unit) => {
      const key = String(unit || '').replace(/\s+/g, '');
      if (key === 'g/mol') return '\\mathrm{g\\,mol^{-1}}';
      if (key === '°C') return '^{\\circ}\\mathrm{C}';
      return `\\mathrm{${key}}`;
    };
    // A quantity is one token, so the number and unit share a baseline even
    // when no explanatory NOTE is attached.
    s = s.replace(/(?<![A-Za-z$\\])(\d+(?:\.\d+)?)\s*(g\s*\/\s*mol|mol|mg|mL|kg|g|L|M|atm|kPa|Pa|K|°C)(?![A-Za-z])/g,
      (_, value, unit) => `$${value}\\,${unitLatex(unit)}$`);
    s = mapOutsideMathSegments(s, (outside) => outside.replace(
      /(?<![A-Za-z$\\])(g\s*\/\s*mol|mol|mg|mL|kg|g|L|M|atm|kPa|Pa|K|°C)(?![A-Za-z])/g,
      (_, unit) => `$${unitLatex(unit)}$`
    ));
    s = mapOutsideMathSegments(s, (outside) => outside.replace(
      /(?<![A-Za-z$\\])(pH|Kc|Kp)(?![A-Za-z])/g,
      (_, token) => `$${token === 'Kc' ? 'K_c' : token === 'Kp' ? 'K_p' : token}$`
    ));
    return mapOutsideMathSegments(s, (outside) => outside.replace(
      /(?<![A-Za-z$\\])([Wn])(?=\s*(?:[=≈]|為|是|表示|值|[_^]))/g,
      '$$$1$$'
    ));
  });
}

/** NOTE popover 與追問內容共用的科學 token 正規化入口。 */
function wrapBareMhchemTokens(text) {
  // `\ce{...}` is valid only inside KaTeX delimiters. Models occasionally
  // emit it bare or inside Markdown code ticks. Normalize the command before
  // the formula matcher can turn its inner H2S/SF4 into nested math text.
  return mapOutsideMathSegments(text, (plain) => {
    const unquoted = String(plain || '')
      .replace(/`+\s*(?:\\?ce\{([^{}\n]+)\}|\\ce([A-Z][A-Za-z0-9^_+\-]*))\s*`+/g,
        (_, braced, shortForm) => '\\ce{' + (braced || shortForm || '') + '}');
    return unquoted.replace(/\\ce(?:\{([^{}\n]+)\}|([A-Z][A-Za-z0-9^_+\-]*))/g, (whole, braced, shortForm) => {
      const body = String(braced || shortForm || '').trim();
      return body ? `$${chemistryLatex(body)}$` : whole;
    });
  });
}

/* Repair the common model shorthand ceFe_xO_y before KaTeX sees it. */
function normalizeBareCeTokens(text) {
  let fixed = String(text || '')
    .replace(/`([^`\n]*(?:\\?ce(?=\{|[A-Z]))[^`\n]*)`/g, '$1')
    .replace(/`+\s*\\?ce\{([^{}\n]+)\}\s*`+/g, '\\ce{$1}')
    .replace(/`+\s*ce([A-Z][A-Za-z0-9_{}^+\-()]*)\s*`+/g, '\\ce{$1}')
    .replace(/\$([^$\n]+)\$/g, (whole, inner) => {
    const match = inner.match(/(^|[^A-Za-z])ce(?=[A-Z])/);
    if (!match) return whole;
    const ceAt = match.index + match[1].length;
    const body = inner.slice(ceAt + 2).trim();
    if (!body) return whole;
    return '$' + inner.slice(0, ceAt) + '\\ce{' + body + '}$';
  });
  return mapOutsideMathSegments(fixed, (plain) => plain
    .replace(/(?<![A-Za-z])\\?ce\{([^{}\n]+)\}/g, (_, body) => '$\\ce{' + body + '}$')
    .replace(/(?<![A-Za-z])ce([A-Z][A-Za-z0-9_{}^+\-()]*)/g,
      (_, body) => '$\\ce{' + body + '}$'));
}

function normalizeScientificTokens(text) {
  let s = repairMalformedChemLatex(text);
  s = normalizeBareCeTokens(s);
  s = wrapBareMhchemTokens(s);
  s = wrapBareChemicalFormulas(s);
  s = wrapSemanticMathTokens(s);
  return wrapPlainNumericRuns(s);
}

window.normalizeScientificTokens = normalizeScientificTokens;

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
  const groups = extractChoiceGroups(text);
  return groups.map(group => group.letters.map(letter => `(${letter})`).join('')).join('');
}

function extractChoiceGroups(text) {
  const raw = cleanAnswerDisplay(text).toUpperCase().trim();
  if (!raw) return [];
  const parseLabels = (payload) => {
    const source = String(payload || '').trim();
    const explicit = [...source.matchAll(/[（(\[]([^()（）\[\]，,、；;\s]{1,16})[）)\]]/g)].map(match => match[1]);
    if (explicit.length) {
      const residue = source.replace(/[（(\[][^()（）\[\]，,、；;\s]{1,16}[）)\]]/g, '').replace(/[，,、；;\s]/g, '');
      return residue ? [] : [...new Set(explicit)].sort();
    }
    const compact = source.replace(/\s+/g, '');
    if (/^[A-Z]+$/.test(compact)) return [...new Set(compact.split(''))].sort();
    const separated = compact.split(/[，,、；;]/).filter(Boolean);
    if (separated.length > 1 && separated.every(label => /^[\p{L}\p{N}①-⑳]{1,16}$/u.test(label))) {
      return [...new Set(separated)].sort();
    }
    return [];
  };
  const groups = [];
  const multi = [...raw.matchAll(/(?:第\s*)?(\d+)\s*(?:題)?\s*[.．:：]\s*([^；;\n]+)/g)];
  if (multi.length) {
    for (const match of multi) {
      const letters = parseLabels(match[2]);
      if (!letters.length) return [];
      groups.push({ index: match[1], letters });
    }
    return groups;
  }
  const letters = parseLabels(raw);
  return letters.length ? [{ index: '', letters }] : [];
}

function normalizeAnswerUnit(unit) {
  return String(unit || '').toLowerCase().replace(/[·.\s]/g, '').replace(/μ/g, 'u');
}

window.answersMatch = function(reply, reference) {
  const actual = window.extractAnswerFromReply(reply);
  const expected = window.parseReferenceAnswerInput(reference);
  const expectedChoices = extractChoiceGroups(expected.raw);
  const actualChoices = extractChoiceGroups(actual.raw);
  if (expectedChoices.length) {
    if (expectedChoices.length !== actualChoices.length) return false;
    return expectedChoices.every((group, index) => group.index === actualChoices[index].index
      && group.letters.join('') === actualChoices[index].letters.join(''));
  }
  if (expected.numeric) {
    if (!actual.numeric) return false;
    const scale = Math.max(1, Math.abs(expected.numeric.value), Math.abs(actual.numeric.value));
    if (Math.abs(expected.numeric.value - actual.numeric.value) > scale * 1e-8) return false;
    return !expected.numeric.unit || normalizeAnswerUnit(expected.numeric.unit) === normalizeAnswerUnit(actual.numeric.unit);
  }
  const normalize = value => cleanAnswerDisplay(value).toUpperCase().replace(/[\s，,、；;]/g, '');
  return !!expected.raw && normalize(expected.raw) === normalize(actual.raw);
}

function briefAnswerPayload(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const compact = t.replace(/\s+/g, '');
  if (/^(?:\([^()\s]{1,16}\))+$/.test(compact)) return t.replace(/\s+/g, '');
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
    return '<div class="answer-box answer-box--final"><span class="answer-box-label">答案</span><span class="answer-box-value">—</span></div>';
  }
  if (lines.length === 1) {
    return `<div class="answer-box answer-box--final"><span class="answer-box-label">答案</span><span class="answer-box-value">${formatAnswerInner(lines[0])}</span></div>`;
  }
  const items = lines.map(l => `<div class="answer-box-item">${formatAnswerInner(l)}</div>`).join('');
  return `<div class="answer-box answer-box--final answer-box--multi"><span class="answer-box-label">答案</span><div class="answer-box-items">${items}</div></div>`;
}



function compiledSolutionToMarkdown(rawText) {
  const { body, answerText } = splitBodyAndAnswer(String(rawText || '').trim());
  const lines = body.split(/\r?\n/).map((source) => String(source || '').trim()).filter(Boolean);
  const blocks = [];
  const parseChoiceLine = (line) => {
    const marker = String(line || '').match(/^@@CHOICE\[([^\]\r\n]{1,16})\]@@\s*(.*)$/);
    if (marker) return { label: marker[1], body: marker[2] };
    const explicit = String(line || '').match(/^\s*(?:\(([^()\s]{1,16})\)|（([^（）\s]{1,16})）|\[([^\[\]\s]{1,16})\])\s*(.*)$/);
    return explicit ? { label: explicit[1] || explicit[2] || explicit[3], body: explicit[4] } : null;
  };
  const headingRe = /^【(.+)】$|^(選項判斷|選項分析|已知條件|解題步驟|結論)$/;
  const finish = (parts) => parts.join(' ')
    .replace(/\s+([，。；：！？、])/g, '$1')
    .replace(/([，。；：！？、])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(headingRe);
    if (heading) {
      blocks.push(`## ${heading[1] || heading[2]}`);
      continue;
    }

    const choice = parseChoiceLine(line);
    if (choice) {
      const parts = [choice.body];
      while (i + 1 < lines.length && !parseChoiceLine(lines[i + 1]) && !headingRe.test(lines[i + 1])) {
        parts.push(lines[++i]);
      }
      const label = String(choice.label).replace(/[<>]/g, '');
      blocks.push(`- <strong class="markdown-choice-label">（${label}）</strong><span class="markdown-choice-body">${finish(parts)}</span>`);
      continue;
    }

    const parts = [line];
    while (
      i + 1 < lines.length
      && !/[。．！？；;]$/.test(finish(parts))
      && !parseChoiceLine(lines[i + 1])
      && !headingRe.test(lines[i + 1])
    ) {
      parts.push(lines[++i]);
    }
    const paragraph = finish(parts);
    const display = paragraph.match(/^\$(\\begin\{(?:array|cases|aligned|matrix|pmatrix|bmatrix)\}[\s\S]+)\$$/);
    blocks.push(display ? `$$\n${display[1]}\n$$` : paragraph);
  }
  const markdown = blocks.join('\n\n').replace(/<\/span>\n\n(?=- <strong class="markdown-choice-label">)/g, '</span>\n');
  return { markdown, answerText };
}

function renderMarkdownSolution(rawText) {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    throw new Error('Markdown renderer 未載入');
  }
  const { markdown, answerText } = compiledSolutionToMarkdown(rawText);
  const html = marked.parse(markdown, { gfm: true, breaks: false });
  const safeHtml = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math'],
    FORBID_ATTR: ['style']
  });
  return `<article class="markdown-body chem-markdown">${safeHtml}${buildAnswerHtml(answerText, { singleQuestion: true })}</article>`;
}

window.renderMarkdownSolution = renderMarkdownSolution;



function measureLineOverflow(inner, content) {
  if (!inner || !content) return false;
  const avail = inner.clientWidth
    || inner.getBoundingClientRect().width
    || inner.parentElement?.clientWidth
    || 0;
  if (avail <= 0) return false;
  const previousWhiteSpace = content.style.whiteSpace;
  content.style.whiteSpace = 'nowrap';
  content.classList.add('plain-line-xcontent--measure');
  const needX = content.scrollWidth > avail + 1;
  content.classList.remove('plain-line-xcontent--measure');
  content.style.whiteSpace = previousWhiteSpace;
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

function isFormulaDominantLine(content) {
  if (!content?.querySelector('.katex, .math-block, .math-unit-tail')) return false;
  const clone = content.cloneNode(true);
  clone.querySelectorAll('.katex, .math-block, .math-note-popover').forEach((node) => node.remove());
  const prose = String(clone.textContent || '')
    .replace(/[\s，。；：！？、,.!?;:＝=＋+－\-×÷*/()（）\[\]【】]/g, '');
  const cjkCount = (prose.match(/[\u3400-\u9fff]/g) || []).length;
  return cjkCount <= 4 && prose.length <= 12;
}

function clearLineHorizontalScroll(inner, wrap, content) {
  wrap?.classList.remove('plain-line-xwrap--scroll', 'plain-line-xwrap--nowrap');
  inner?.classList.remove('plain-line-inner--xscroll');
  wrap?.removeAttribute('role');
  wrap?.removeAttribute('tabindex');
  wrap?.removeAttribute('aria-label');
  if (wrap) wrap.scrollLeft = 0;
  if (content) content.style.whiteSpace = 'normal';
  if (inner) inner.style.whiteSpace = 'normal';
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
    clearLineHorizontalScroll(inner, wrap, content);
    return;
  }
  if (!isFormulaDominantLine(content)) {
    clearLineHorizontalScroll(inner, wrap, content);
    return;
  }
  const needX = measureLineOverflow(inner, content);
  wrap.classList.toggle('plain-line-xwrap--scroll', needX);
  // 含算式的整句只要超寬，就由同一行承接，避免等號、答案與句點分離。
  wrap.classList.toggle('plain-line-xwrap--nowrap', needX);
  inner.classList.toggle('plain-line-inner--xscroll', needX);
  if (needX) {
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', '可左右滑動查看完整公式');
  } else {
    wrap.removeAttribute('role');
    wrap.removeAttribute('tabindex');
    wrap.removeAttribute('aria-label');
  }
  content.style.whiteSpace = needX ? '' : 'normal';
  inner.classList.remove('plain-line--hscroll', 'plain-line--hscroll-math');
  inner.style.whiteSpace = 'normal';
}

const lineScrollObservers = new WeakMap();
const lineScrollRoots = new Set();
let lineScrollResizeBound = false;

function setupHorizontalLineScroll(root) {
  if (!root) return;
  lineScrollRoots.add(root);
  if (!lineScrollResizeBound) {
    lineScrollResizeBound = true;
    window.addEventListener('resize', () => setTimeout(() => {
      lineScrollRoots.forEach((item) => {
        if (item.isConnected) setupHorizontalLineScroll(item);
        else lineScrollRoots.delete(item);
      });
    }, 0), { passive: true });
  }
  const rows = root.querySelectorAll('.chem-markdown p, .chem-markdown .markdown-choice-body');
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
    requestAnimationFrame(run);
    if (document.fonts?.ready) document.fonts.ready.then(run).catch(() => {});

    if (typeof ResizeObserver !== 'undefined') {
      const prev = lineScrollObservers.get(inner);
      if (prev) prev.disconnect();
      const ro = new ResizeObserver(run);
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
    katex.render(normalizeMhchemForKatex(tex), holder, {
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

function recoverBareMhchemInDom(root) {
  if (!root || typeof renderMathInElement !== 'function') return;
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('.katex, .math-note-popover')) continue;
    if ((node.nodeValue || '').includes('\\ce')) nodes.push(node);
  }
  if (!nodes.length) return;

  const { trust, macros } = getKatexOpts();
  nodes.forEach((textNode) => {
    const source = textNode.nodeValue || '';
    const normalized = wrapBareMhchemTokens(source);
    if (normalized === source || !textNode.parentNode) return;
    const holder = document.createElement('span');
    holder.textContent = normalized;
    renderMathInElement(holder, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false,
      strict: 'ignore',
      trust,
      macros,
      preProcess: (math) => normalizeMhchemForKatex(repairInlineMathTypography(String(math || '')))
    });
    const fragment = document.createDocumentFragment();
    while (holder.firstChild) fragment.appendChild(holder.firstChild);
    textNode.replaceWith(fragment);
  });
}

function hideKatexErrors(root) {
  if (!root) return;
  root.querySelectorAll('.katex-error').forEach(el => {
    let tex = (el.textContent || '').trim().replace(/^\$+|\$+$/g, '');
    tex = repairInlineMathTypography(tex);
    if (/\\htmlData\{/.test(tex)) return;
    const envM = tex.match(new RegExp('\\\\begin\\{(?:array|aligned|matrix|pmatrix|bmatrix|cases)\\}[\\s\\S]*?\\\\end\\{(?:array|aligned|matrix|pmatrix|bmatrix|cases)\\}'));
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
  root.querySelectorAll('.chem-markdown p, .markdown-choice-body').forEach((inner) => {
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
  root.querySelectorAll('.chem-markdown p, .markdown-choice-body').forEach((inner) => {
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
      numPart: parts[lineIdx + 1] || null,
      linePart,
      fracLine: linePart.querySelector('.frac-line'),
      denPart: parts[lineIdx - 1] || null,
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
    root.querySelectorAll('.mfrac-has-nested, .mfrac-has-note, .mfrac-inner-in-num, .mfrac-inner-in-den, .mfrac-inner-native').forEach((mfrac) => {
      mfrac.classList.remove('mfrac-has-nested', 'mfrac-has-note', 'mfrac-inner-in-num', 'mfrac-inner-in-den', 'mfrac-inner-native');
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
        inner.classList.add('mfrac-inner-native');
      } else {
        nudgeTopEm(innerLayout.numPart, spread);
      }
      expandVlistHeight(innerLayout.vlist, vh);
    });

    inners.forEach((inner) => {
      const zone = getInnerZone(outer, inner);
      const innerLayout = parseVlistT2(inner);
      if (!zone || !innerLayout || !outerLayout.fracLine) return;
      if (zone === 'numerator') return;
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

const BOARD_KEEP_TEXT = /^(起始|變化|結果|移至左|移至右|完全反應|完全移至|完全向左|完全向右|再向左|再向右|後來體積|原來體積|初|平|平衡|右|左|初始)$/;

function collectMarkdownScopes(root) {
  const scope = new Set();
  if (!root) return [];
  const tryAdd = (el) => {
    if (el?.classList?.contains('chem-markdown') && el.closest('.board, .board-reply, .followup-reply')) {
      scope.add(el);
    }
  };
  tryAdd(root);
  root.querySelectorAll?.('.chem-markdown').forEach(tryAdd);
  return [...scope];
}

/** KaTeX 前：\mathrm{Cl}、\text{M} → 數學斜體字母；\text{起始} 等中文標籤保留 */
function normalizeChemLatexInMarkdown(root) {
  const scopes = collectMarkdownScopes(root);
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

/** 中文與英數片段之間補齊一致空白，避免忽遠忽近 */
function normalizeCjkLatinSpacing(root) {
  if (!root || typeof document === 'undefined') return;
  const scopes = collectMarkdownScopes(root);
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

function postProcessMarkdownBoard(root) {
  if (!root) return;
  hideKatexErrors(root);
  recoverBareMhchemInDom(root);
  recoverLeakedLatexInDom(root);
  recoverLeakedStashCases(root);
  if (typeof MathNote !== 'undefined') MathNote.postProcessBoard(root);
  markAndSpaceNestedFractions(root);
  normalizeCjkLatinSpacing(root);
  // This must run after KaTeX and NOTE post-processing: only the completed
  // inline structure can tell whether a whole calculation row needs one
  // horizontal scroll owner instead of several fragment-level scrollbars.
  setupHorizontalLineScroll(root);
}

function doKaTeX(element) {
  if (!element || typeof renderMathInElement !== 'function') return;
  normalizeChemLatexInMarkdown(element);
  const { trust, macros } = getKatexOpts();
  const katexOpts = {
    throwOnError: false,
    strict: 'ignore',
    trust,
    macros,
    preProcess: (math) => normalizeMhchemForKatex(
      repairInlineMathTypography(String(math || '').replace(/^\$+|\$+$/g, ''))
    )
  };
  renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    ...katexOpts
  });
  postProcessMarkdownBoard(element);
}
