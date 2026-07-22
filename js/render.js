/**
 * js/render.js — plain-line 渲染、簡答欄、KaTeX 後處理
 * BUILD: 20260721-sqrt-fix (撤銷有害 $$ 升級；修 allingdotseq／根號)
 */
window.__RENDER_BUILD = '20260721-mhchem-ion';
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
  let normalized = String(latex || '').replace(/\\\\ce(?=\{)/g, '\\ce');
  // A model occasionally produces `n_{\text{\text{乙}} ...}` and splits it
  // across a line.  That leaves the subscript unclosed, so KaTeX returns the
  // raw `$...$` text.  Repair only this nested-text-in-script shape; ordinary
  // multi-line equations and text layout are left unchanged.
  if (/[_^]\{\s*\\text\s*\{\s*\\text\s*\{/.test(normalized)) {
    normalized = normalized
      .replace(/\s*\n\s*/g, ' ')
      .replace(/([_^])\{\s*\\text\s*\{\s*\\text\s*\{([^{}]+)\}\s*\}/g, '$1{\\text{$2}}');
  }
  return normalized;
}

/** 將化學式片段包成 $CO_2$ 型（不用 \\text{}） */
function wrapChemFormula(formula) {
  let f = String(formula || '').replace(/\\_/g, '_').trim();
  if (!f) return '';
  f = f
    .replace(/[⁻−]/g, '-')
    .replace(/[⁺]/g, '+')
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
  const keepUnitMathrm = (inner) => /^(?:mmol|mol|mL|mg|kg|atm|kPa|Pa|min|h|A|C|M|L|g|s|K|°C|g\\,mol\^\{-1\})$/i.test(String(inner || '').trim());

  s = s.replace(/\$([^$]+)\$/g, (m, inner) => {
    let fixed = inner
      .replace(/\\text\{([A-Za-z0-9+\-]+)\}/g, (tm, el) => (/[\u4e00-\u9fff]/.test(el) ? tm : el))
      .replace(/\\mathrm\{([^{}]+)\}/g, (tm, el) => (keepUnitMathrm(el) ? tm : el))
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

const UNICODE_SUB_MAP = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
};

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
    if (isKnownChemicalToken(String(formula).replace(sub, (ch) => UNICODE_SUB_MAP[ch] || ch)) === false) return m;
    return toLatex(formula, charge);
  });
  // Cl⁻／Fe³⁺：單元素＋上標電荷（電荷可無數字）
  out = out.replace(/(?<![$\w\\])([A-Z][a-z]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻])(?![A-Za-z0-9_])/g, (m, formula, charge, off) => {
    if (isInsideDollarMath(out, off)) return m;
    if (isKnownChemicalToken(formula) === false) return m;
    return toLatex(formula, charge);
  });
  return out;
}

/** 與 solution-core.js 共用同一份元素表判定，避免 render.js 另一套較弱的黑名單誤判（例如把
 * 「CHOICE」「NOTE」等純大寫英文字誤判成化學式）。SolutionCore 不可用時（如獨立測試）才退回黑名單。 */
function isKnownChemicalToken(token) {
  const core = typeof window !== 'undefined' ? window.SolutionCore : (typeof SolutionCore !== 'undefined' ? SolutionCore : null);
  return core && typeof core.isChemicalToken === 'function' ? core.isChemicalToken(token) : null;
}

/** AI 偶爾寫底線化學式（H_3PO_4）；先併回 H3PO4，再交化學式 matcher。 */
function flattenBareChemUnderscores(value) {
  return mapOutsideMathSegments(String(value || ''), (plain) => plain.replace(
    /((?:[A-Z][a-z]?_?\d*){2,})/g,
    (whole) => {
      if (!whole.includes('_')) return whole;
      const flattened = whole.replace(/_(?=\d)/g, '');
      return isKnownChemicalToken(flattened) === false ? whole : flattened;
    }
  ));
}

const UNIT_TOKEN_RE = String.raw`g\s*\/\s*mol|mmol|mol|mg|mL|kg|(?:mm|cm|dm|km|m)(?:\s*\^\s*\{?\s*-?\d+\s*\}?)?|DU|g|L|M|atm|kPa|Pa|K|°C`;

function unitToLatex(unit) {
  const key = String(unit || '').replace(/\s+/g, '');
  if (key === 'g/mol') return '\\mathrm{g\\,mol^{-1}}';
  if (key === '°C') return '^{\\circ}\\mathrm{C}';
  const powered = key.match(/^([A-Za-z]+)\^\{?(-?\d+)\}?$/);
  if (powered) return `\\mathrm{${powered[1]}}^{${powered[2]}}`;
  return `\\mathrm{${key}}`;
}

/** 純文字科學記號（5.4 × 10^-5 或接單位）→ 單一 KaTeX inline，避免拆成雙島。 */
function wrapScientificNotation(text) {
  return mapOutsideMathSegments(String(text || ''), (plain) => plain.replace(
    new RegExp(
      String.raw`(?<![A-Za-z_\\])(\d+(?:\.\d+)?)\s*[×x＊*]\s*10\s*(?:\^\s*\{?\s*(-?\d+)\s*\}?)(?:\s*(${UNIT_TOKEN_RE}))?(?![A-Za-z])`,
      'gi'
    ),
    (_, coefficient, exponent, unit) => {
      const body = `${coefficient}\\times10^{${exponent}}`;
      return unit ? `$${body}\\,${unitToLatex(unit)}$` : `$${body}$`;
    }
  ));
}

/** 保護 \\ce／分式等指令群後再轉換裸化學式。 */
function protectLatexGroups(source, commandRe, transform) {
  const stash = [];
  const protect = (value) => {
    const key = `\uE600${'x'.repeat(stash.length + 1)}\uE601`;
    stash.push(value);
    return key;
  };
  const group = String.raw`\{(?:[^{}]|\{[^{}]*\})*\}`;
  let body = String(source || '').replace(new RegExp(String.raw`\\(?:${commandRe})${group}(?:${group})?`, 'g'), protect);
  body = transform(body);
  stash.forEach((value, index) => {
    body = body.replace(`\uE600${'x'.repeat(index + 1)}\uE601`, value);
  });
  return body;
}

const CHEM_CHARGE_SUFFIX = String.raw`(?:\^?\{?\d*[+-]\}?)?`;
// 結束處若仍是 ^／電荷，不可提早收束（否則 HSO3^- → $\ce{HSO3}$^-）
const AFTER_BARE_CHEM = String.raw`(?![A-Za-z0-9^+\-])`;
const INLINE_CHEM_TOKEN_RE = new RegExp(
  String.raw`(^|[^A-Za-z\\])([A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)?(?:[A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)?)+${CHEM_CHARGE_SUFFIX})${AFTER_BARE_CHEM}`,
  'g'
);
const INLINE_CHEM_ION_RE = /(\[[A-Za-z0-9]+\^?\{?[0-9]*[+\-]+\}?\])/g;

function chemTokenToCeLatex(token) {
  const raw = String(token || '').trim();
  const bracketed = /^\[(.+)\]$/.test(raw);
  const bare = raw.replace(/^\[|\]$/g, '');
  if (isKnownChemicalToken(bare) === false) return raw;
  const inner = bare.replace(/_\{?(\d+)\}?/g, (_, d) => d);
  const ce = `\\ce{${chemDigitsToSubscripts(inner)}}`;
  return bracketed ? `[${ce}]` : ce;
}

/** 追問的自由文字也套用 SolutionCore 唯一規範：n、W、V 的下標就是對象。 */
function normalizeQuantitySymbolsInMath(inner) {
  return String(inner || '').replace(/\b([nWV]|m)\s*[（(]\s*([^()（）]+)\s*[）)]/g, (whole, symbol, rawToken) => {
    const quantity = symbol === 'm' ? 'W' : symbol;
    const token = String(rawToken || '').trim();
    if (!token) return quantity;
    if (/[\u4e00-\u9fff]/.test(token)) return `${quantity}_{\\text{${token}}}`;
    if (isKnownChemicalToken(token) !== false) return `${quantity}_{${chemTokenToCeLatex(token)}}`;
    return `${quantity}_{\\text{${token}}}`;
  });
}

function normalizeConcentrationSymbols(inner) {
  const core = typeof window !== 'undefined' ? window.SolutionCore : (typeof SolutionCore !== 'undefined' ? SolutionCore : null);
  if (core && typeof core.normalizeConcentrationNotation === 'function') {
    return core.normalizeConcentrationNotation(inner);
  }
  return String(inner || '')
    .replace(/\b[cC]\s*[（(]\s*([^()（）]+)\s*[）)]/g, (_, token) => `[${String(token || '').trim()}]`)
    .replace(/\b[cC]_\{([^{}]+)\}/g, (_, token) => `[${String(token || '').trim()}]`);
}

/** 一般敘述的 C(物種)／c(物種) 只由本機改顯示為 [物種]，不要求 AI 重寫。 */
function wrapConcentrationNotationInProse(text) {
  return mapOutsideMathSegments(text, (plain) => String(plain || '').replace(
    /\b[cC]\s*[（(]\s*([^()（）]+)\s*[）)]|\b[cC]_\{([^{}]+)\}/g,
    (whole) => `$${normalizeConcentrationSymbols(whole)}$`
  ));
}

/**
 * 一般敘述不在數學模式時，將 W（樣品）等包成最小的 inline math。
 * 正式詳解會直接呼叫 SolutionCore 的唯一規範；獨立顯示器測試時才以
 * 相同的顯示後備處理維持可讀性，這裡不另行定義任何 AI 提示詞。
 */
function wrapQuantityNotationInProse(text) {
  const core = typeof window !== 'undefined' ? window.SolutionCore : (typeof SolutionCore !== 'undefined' ? SolutionCore : null);
  return mapOutsideMathSegments(text, (plain) => String(plain || '').replace(
    /\b([nWV]|m)\s*[（(]\s*([^()（）]+)\s*[）)]/g,
    (whole) => {
      const latex = core && typeof core.normalizeQuantityNotation === 'function'
        ? core.normalizeQuantityNotation(whole)
        : normalizeQuantitySymbolsInMath(whole);
      return `$${latex}$`;
    }
  ));
}

/** $…$ 內裸寫 CH3COOH、CH3COOH > H2S 等轉成 mhchem，避免 KaTeX 把數字當變數。 */
function convertPlainChemInLatex(inner) {
  let s = normalizeConcentrationSymbols(normalizeQuantitySymbolsInMath(inner));
  const core = typeof window !== 'undefined' ? window.SolutionCore : (typeof SolutionCore !== 'undefined' ? SolutionCore : null);
  // 追問雖可用行內數學，除法仍遵守正式詳解的直式分式規則。
  if (/[\/÷]/.test(s) && core && typeof core.calculation === 'function') s = core.calculation(s);
  if (/\\begin\{array\}/.test(s)) return s;
  return protectLatexGroups(s, 'ce|d?frac|tfrac|sqrt|log|ln|text|mathrm', (plain) => {
    let out = plain.replace(INLINE_CHEM_TOKEN_RE, (whole, prefix, formula) => {
      if (isKnownChemicalToken(formula) === false) return whole;
      return prefix + chemTokenToCeLatex(formula);
    });
    out = out.replace(INLINE_CHEM_ION_RE, (whole) => chemTokenToCeLatex(whole));
    return out;
  });
}

function normalizeChemInsideMathDelimiters(text) {
  return String(text || '').replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (whole, displayBody, inlineBody) => {
    if (displayBody != null) return `$$${convertPlainChemInLatex(displayBody)}$$`;
    return `$${convertPlainChemInLatex(inlineBody)}$`;
  });
}

function wrapBareChemicalFormulas(text) {
  let s = normalizeUnicodeChemSubscripts(text);
  // 含電荷：HSO3^-／IO3-／CO3^2- 整段進 mhchem。
  // 結尾 lookahead 必須排除 ^／電荷符號，否則可選電荷會被丟掉（變成 $\ce{HSO3}$^-）。
  const CHEM_RE = new RegExp(
    String.raw`(?<![$\w\\/\[])([A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)?(?:[A-Z][a-z]?(?:(?:_\{?\d+\}?)|\d+)?)+${CHEM_CHARGE_SUFFIX})${AFTER_BARE_CHEM}`,
    'g'
  );
  const BINARY_CHEM_RE = new RegExp(
    String.raw`(?<![$\w\\/\[])([A-Z][a-z]?(?:[A-Z][a-z]?)+)${AFTER_BARE_CHEM}`,
    'g'
  );
  const CHEM_SKIP = /^(ICE|Kp|Kc|Pa|atm|mol|pH|DNA|RNA|OK|AM|PM)$/i;
  const ionRe = new RegExp(
    String.raw`(?<![A-Za-z$\\])(\[[A-Za-z0-9]+(?:\^?\{?\d*[+-]\}?)?\](?:_\{?[A-Za-z0-9\u4e00-\u9fff]+\}?|_[\u4e00-\u9fff])?|[A-Z][a-z]?(?:\d+)?(?:\^\{?\d*[+-]\}?|[+-]))(?![A-Za-z])`,
    'g'
  );
  return s.split('\n').map((line) => {
    if (/^\s*\$\$/.test(line.trim())) return line;
    // 先處理 [HSO3^-]，避免變成 [$\ce{HSO3^-}$]
    let out = line.replace(ionRe, (m, ion, off) => {
      if (isInsideDollarMath(line, off)) return m;
      const raw = String(ion);
      if (raw.startsWith('[') && raw.includes(']')) {
        const close = raw.indexOf(']');
        const bare = raw.slice(1, close);
        const trail = raw.slice(close + 1);
        if (isKnownChemicalToken(bare) === false) return m;
        const token = bare.replace(/[⁻−]/g, '-').replace(/[⁺]/g, '+');
        return `$[\\ce{${token}}]$${trail}`;
      }
      if (isKnownChemicalToken(raw) === false) return m;
      return wrapChemFormula(raw);
    });
    out = out.replace(CHEM_RE, (m, formula, off) => {
      if (isInsideDollarMath(out, off)) return m;
      if (/^(Kp|Kc|ICE|Pa|atm|mol|K)$/i.test(formula)) return m;
      if (isKnownChemicalToken(formula) === false) return m;
      const inner = /_\{?\d/.test(formula) ? formula : chemDigitsToSubscripts(formula);
      return wrapChemFormula(inner);
    });
    out = out.replace(BINARY_CHEM_RE, (m, formula, off) => {
      if (isInsideDollarMath(out, off)) return m;
      if (CHEM_SKIP.test(formula)) return m;
      if (isKnownChemicalToken(formula) === false) return m;
      return wrapChemFormula(formula);
    });
    // 保險：合併偶發拆開的 $\ce{HSO3}$^- → $\ce{HSO3^-}$
    out = out.replace(
      /\$\\ce\{([^{}$]+)\}\$(\^?\{?\d*[+-]\}?|[+-])(?![A-Za-z0-9])/g,
      (_, body, charge) => `$\\ce{${body}${charge}}$`
    );
    // 保險：[$\ce{HSO3^-}$] → $[\ce{HSO3^-}]$
    out = out.replace(/\[\$\\ce\{([^{}$]+)\}\$\]/g, '$[\\ce{$1}]$');
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

/**
 * 僅包「數字＋單位」與常見符號；禁止孤立單位包 $（會造成 0.10, M 雙島假象）。
 * 說明句裸數字不包 $。
 */
function stripQuantityCommaNoise(text) {
  return String(text || '')
    .replace(/(\d+(?:\.\d+)?)[\s\u00a0\u3000]*[,，、][\s\u00a0\u3000\r\n]*(mmol|mol|mL|mg|kg|atm|kPa|Pa|min|h|A|C|M|L|g|s)\b/g, '$1 $2')
    // 數字 + 逗號 + 已包好的單位島
    .replace(
      new RegExp(String.raw`(\d+(?:\.\d+)?)[\s\u00a0\u3000]*[,，、][\s\u00a0\u3000]*\$(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?\$`, 'gi'),
      (_, n, u) => `$${n}\\,${unitToLatex(u)}$`
    );
}

/** 合併被拆開的「數字島＋逗號＋單位島」→ 單一 $num\,\mathrm{unit}$。 */
function mergeSplitQuantityIslands(text) {
  let s = String(text || '');
  for (let pass = 0; pass < 4; pass += 1) {
    const next = s
      .replace(
        new RegExp(String.raw`\$(\d+(?:\.\d+)?)\$\s*[,，、]?\s*\$(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?\$`, 'gi'),
        (_, n, u) => `$${n}\\,${unitToLatex(u)}$`
      )
      .replace(
        new RegExp(String.raw`\$(\d+(?:\.\d+)?)\$\s*[,，、]?\s*(${UNIT_TOKEN_RE})\b`, 'gi'),
        (_, n, u) => `$${n}\\,${unitToLatex(u)}$`
      )
      .replace(
        new RegExp(String.raw`(\d+(?:\.\d+)?)\s*[,，、]\s*\$(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?\$`, 'gi'),
        (_, n, u) => `$${n}\\,${unitToLatex(u)}$`
      )
      .replace(
        new RegExp(String.raw`\$(\d+(?:\.\d+)?)\\,\s*\$\s*(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?\$`, 'gi'),
        (_, n, u) => `$${n}\\,${unitToLatex(u)}$`
      )
      // marked 殘留：$20.0,\mathrm{mL}$
      .replace(
        new RegExp(String.raw`\$(\d+(?:\.\d+)?)\s*,\s*(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?\$`, 'gi'),
        (_, n, u) => `$${n}\\,${unitToLatex(u)}$`
      );
    if (next === s) break;
    s = next;
  }
  return s;
}

function wrapInlineRateExpressions(text) {
  return mapOutsideMathSegments(text, (plain) => {
    let s = String(plain || '');
    s = s.replace(
      /\(\s*(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)\s*\)\s*\^\s*\{?\s*(\d+)\s*\}?\s*[×x＊*]\s*\(\s*(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)\s*\)\s*=\s*(\d+)\s*[\/／]\s*(\d+)/g,
      (_, a, b, exp, c, d, e, f) => `$\\left(\\dfrac{${a}}{${b}}\\right)^{${exp}} \\times \\dfrac{${c}}{${d}} = \\dfrac{${e}}{${f}}$`
    );
    s = s.replace(
      /\(\s*(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)\s*\)\s*\^\s*\{?\s*(\d+)\s*\}?/g,
      (_, a, b, exp) => `$\\left(\\dfrac{${a}}{${b}}\\right)^{${exp}}$`
    );
    s = s.replace(
      /[×x＊*]\s*\(\s*(\d+(?:\.\d+)?)\s*[\/／]\s*(\d+(?:\.\d+)?)\s*\)/g,
      (_, a, b) => ` $\\times \\dfrac{${a}}{${b}}$`
    );
    s = s.replace(
      /(?<![\d$])(\d+)\s*[×x＊*]\s*(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)(?!\d)/g,
      (_, a, b, c, d) => `$${a} \\times ${b} + ${c} = ${d}$`
    );
    return s;
  });
}

function wrapSemanticMathTokens(text) {
  return mapOutsideMathSegments(text, (plain) => {
    let s = stripQuantityCommaNoise(String(plain || ''))
      .replace(/↔|<->/g, '⇌')
      .replace(/\\leftrightarrow|\\rightleftharpoons/g, '⇌');
    // 說明句乘號 * → ×（僅數字／10 之間）
    s = s.replace(/(?<![A-Za-z\\])(\d+(?:\.\d+)?)\s*\*\s*(?=\d|10\b)/g, '$1 × ');
    s = s.replace(
      new RegExp(String.raw`(?<![A-Za-z$\\])(\d+(?:\.\d+)?)\s*(${UNIT_TOKEN_RE})(?![A-Za-z])`, 'g'),
      (_, value, unit) => `$${value}\\,${unitToLatex(unit)}$`
    );
    s = mergeSplitQuantityIslands(s);
    s = mapOutsideMathSegments(s, (outside) => outside.replace(
      /(?<![A-Za-z$\\])(pH|Kc|Kp)(?![A-Za-z])/g,
      (_, token) => `$${token === 'Kc' ? 'K_c' : token === 'Kp' ? 'K_p' : token}$`
    ));
    // 明確寫出的科學符號下標（N_A、K_sp 等）進數學模式；一般英文字不猜測。
    s = mapOutsideMathSegments(s, (outside) => outside.replace(
      /(?<![A-Za-z$\\])([A-Za-z])_([A-Za-z0-9]+)(?![A-Za-z0-9_])/g,
      (_, base, subscript) => `$${base}_${subscript}$`
    ));
    return mapOutsideMathSegments(s, (outside) => outside.replace(
      /(?<![A-Za-z$\\])([Wn])(?=\s*(?:[=≈]|為|是|表示|值|[_^]))/g,
      '$$$1$$'
    ));
  });
}

const CHEM_ROLE_LABELS = {
  rem: '剩餘', remaining: '剩餘', leftover: '剩餘',
  prod: '生成', product: '生成',
  conc: '濃度',
  init: '起始', initial: '起始',
  eq: '平衡', equil: '平衡',
  tot: '總', total: '總'
};

/** $…$ 內 \\ce{…}_{rem}／化學式_{prod} → 化學式後接中文標籤，避免下標擠進式子。 */
function normalizeChemRoleSubscriptsInMath(text) {
  const roleAlt = Object.keys(CHEM_ROLE_LABELS).join('|');
  const labelOf = (role) => CHEM_ROLE_LABELS[String(role || '').toLowerCase()] || '';
  return String(text || '').replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (whole, displayBody, inlineBody) => {
    const isDisplay = displayBody != null;
    let inner = isDisplay ? displayBody : inlineBody;
    inner = inner.replace(
      new RegExp(String.raw`(\\ce\{[^{}]+\})(\^(?:\{[^}]+\}|[0-9]*[+\-−⁻]))?_\{?(${roleAlt})\}?`, 'gi'),
      (m, species, charge, role) => {
        const label = labelOf(role);
        return label ? `${species}${charge || ''}\\text{（${label}）}` : m;
      }
    );
    inner = inner.replace(
      new RegExp(String.raw`(\d+(?:\.\d+)?)[,，]\s*(${UNIT_TOKEN_RE})\b`, 'gi'),
      (_, value, unit) => `${value}\\,${unitToLatex(unit)}`
    );
    // math 內殘留 * 乘號
    inner = inner.replace(/(?<![A-Za-z\\])(\d+(?:\.\d+)?)\s*\*\s*(?=\d|10\b)/g, '$1\\times ');
    // 勿把短 ⇌ 再拉回過長 \\rightleftharpoons（chemistry 已用 ⇌）
    inner = inner.replace(/\\leftrightarrow/g, '⇌');
    return isDisplay ? `$$${inner}$$` : `$${inner}$`;
  });
}

/** 詳解與追問內容共用的科學 token 正規化入口。 */
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

/** compile() 產出的 @@CHOICE[...]@@／【heading】 結構標記本身不是化學或算式內容；
 * 先保護標記本身（標記後的內容仍會正常正規化），避免例如 @@CHOICE[F]@@ 的
 * 「CHOICE」被化學式偵測誤判成連續元素符號而插入 $。 */
const STRUCTURAL_MARKER_RE = /^(?:@@CHOICE\[[^\]\r\n]{1,16}\]@@|【[^【】\r\n]{1,24}】)/gm;

function guardStructuralMarkers(text) {
  const stash = [];
  const guarded = String(text || '').replace(STRUCTURAL_MARKER_RE, (marker) => {
    const key = `\uE500${'\uE502'.repeat(stash.length + 1)}\uE501`;
    stash.push(marker);
    return key;
  });
  return {
    guarded,
    restore: (s) => {
      let out = s;
      stash.forEach((marker, index) => {
        out = out.split(`\uE500${'\uE502'.repeat(index + 1)}\uE501`).join(marker);
      });
      return out;
    }
  };
}

/** 顯示前科學 token 安全網：結構保護 → 明確 token → $ 內化學式。不做裸數字全面包 $。 */
function normalizeScientificTokens(text) {
  const { guarded, restore } = guardStructuralMarkers(text);
  let s = flattenBareChemUnderscores(guarded);
  // 還原 JSON 吃掉的 \times → imes
  if (typeof SolutionCore !== 'undefined' && SolutionCore.restoreEatenLatexCommands) {
    s = SolutionCore.restoreEatenLatexCommands(s);
  } else {
    s = s.replace(/\u0009imes/gi, '\\times')
      .replace(/([A-Za-z0-9}\]])imes(?=\s*(?:\d|10\b|\\))/gi, '$1\\times')
      .replace(/×/g, '\\times ');
  }
  // 進 $ 前先清數字與單位間逗號（半形／全形／換行）
  s = mapOutsideMathSegments(s, (plain) => stripQuantityCommaNoise(plain));
  // 一般敘述、選項與追問共用 n(物質)／W(物質)／V(對象) 的下標規則。
  s = wrapQuantityNotationInProse(s);
  // 濃度 C(物種)／c(物種) 只做本機顯示修正；C 作為碳元素不受影響。
  s = wrapConcentrationNotationInProse(s);
  // 說明句若漏出 LaTeX 指令，改成可見符號，避免畫面出現 \times／allingdotseq
  s = mapOutsideMathSegments(s, (plain) => String(plain || '')
    .replace(/\ballingdotseq\b/g, '≈')
    .replace(/\\fallingdotseq\b/g, '≈')
    .replace(/\\times\b/g, '×')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\div\b/g, '÷')
    .replace(/\\textdegree\s*(?:\{\s*\})?\s*([CFK])?\b/gi, (_, unit) => `°${unit || ''}`)
    .replace(/\\Delta\b/g, 'Δ'));
  // 結果區等漏包的 \times10^{n} → 包進數學模式
  s = mapOutsideMathSegments(s, (plain) => plain.replace(
    /(?<!\$)(\d+(?:\.\d+)?)\s*(?:×|\\times)\s*10\s*\^\s*\{?([-+]?\d+)\}?/g,
    (_, coef, exp) => `$${coef}\\times10^{${exp}}$`
  ));
  s = wrapScientificNotation(s);
  s = repairMalformedChemLatex(s);
  s = normalizeBareCeTokens(s);
  s = wrapBareMhchemTokens(s);
  s = wrapBareChemicalFormulas(s);
  s = wrapInlineRateExpressions(s);
  s = wrapSemanticMathTokens(s);
  s = mergeSplitQuantityIslands(s);
  s = normalizeChemInsideMathDelimiters(s);
  s = normalizeChemRoleSubscriptsInMath(s);
  return restore(s);
}

window.normalizeScientificTokens = normalizeScientificTokens;

/** KaTeX 前通用修復：°C、指數；顯示向化學／單位改寫只在 normalizeScientificTokens。 */
function repairInlineMathTypography(inner) {
  let s = convertPlainChemInLatex(String(inner || ''));
  if (/\\begin\{array\}/.test(s)) return s;
  s = s.replace(/\\textdegree\s*(?:\{\s*\})?\s*C\b/gi, '^{\\circ}\\mathrm{C}');
  s = s.replace(/\\textdegree\s*(?:\{\s*\})?\s*K\b/gi, '^{\\circ}\\mathrm{K}');
  s = s.replace(/\\textdegree\s*(?:\{\s*\})?\b/gi, '^{\\circ}');
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
  s = s.replace(/(?<![A-Za-z\\])(\d+(?:\.\d+)?)\s*\*\s*(?=\d|10\b)/g, '$1\\times ');
  // marked 曾把 \, 吃成逗號；或 AI 殘留「數字,單位」→ 薄空白＋直立單位
  s = s.replace(
    new RegExp(String.raw`(\d+(?:\.\d+)?)(?:\\times10\^\{[-+]?\d+\})?\s*[,，]\s*(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?`, 'gi'),
    (_, num, unit) => `${num}\\,${unitToLatex(unit)}`
  );
  s = s.replace(
    new RegExp(String.raw`(\d+(?:\.\d+)?)(?:\\times10\^\{[-+]?\d+\})?\s+(?:\\mathrm\{)?(${UNIT_TOKEN_RE})(?:\})?(?![A-Za-z])`, 'gi'),
    (_, num, unit) => `${num}\\,${unitToLatex(unit)}`
  );
  // 根號與假分式（含巢狀 \dfrac{…}{=}）
  s = s.replace(/√\s*\(\s*([^()]+)\s*\)/g, '\\sqrt{$1}');
  s = s.replace(/\\sqrt\s*\{\(\s*([^()]+)\s*\)\}/g, '\\sqrt{$1}');
  s = s.replace(/\\sqrt\s*\(\s*([^()]+)\s*\)/g, '\\sqrt{$1}');
  s = s.replace(/(?<![A-Za-z\\])sqrt\s*\(\s*([^()]+)\s*\)/gi, '\\sqrt{$1}');
  s = s.replace(/\ballingdotseq\b/g, '\\approx ');
  s = s.replace(/\\fallingdotseq\b/g, '\\approx ');
  {
    let out = '';
    for (let i = 0; i < s.length;) {
      const isDfrac = s.startsWith('\\dfrac{', i);
      const isFrac = s.startsWith('\\frac{', i);
      if (!isDfrac && !isFrac) { out += s[i]; i += 1; continue; }
      const cmd = isDfrac ? '\\dfrac' : '\\frac';
      const readGroup = (start) => {
        if (s[start] !== '{') return null;
        let depth = 0;
        for (let j = start; j < s.length; j += 1) {
          if (s[j] === '{') depth += 1;
          else if (s[j] === '}') {
            depth -= 1;
            if (depth === 0) return { body: s.slice(start + 1, j), end: j + 1 };
          }
        }
        return null;
      };
      const num = readGroup(i + cmd.length);
      const den = num ? readGroup(num.end) : null;
      if (!num || !den) { out += s[i]; i += 1; continue; }
      const denom = den.body.replace(/\s+/g, '');
      if (denom === '=' || denom === '＝') {
        out += `\\sqrt{${num.body}}`;
        i = den.end;
        if (!/^\s*[=＝≈]/.test(s.slice(i)) && !/^\s*\\approx/.test(s.slice(i))) out += '=';
        continue;
      }
      if (denom === '\\approx' || denom === '≈') {
        out += `\\sqrt{${num.body}}`;
        i = den.end;
        if (!/^\s*[=＝≈]/.test(s.slice(i)) && !/^\s*\\approx/.test(s.slice(i))) out += '\\approx ';
        continue;
      }
      out += `${cmd}{${num.body}}{${den.body}}`;
      i = den.end;
    }
    s = out;
  }
  s = s.replace(/\\leftrightarrow|\\rightleftharpoons/g, '⇌');
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

function formatAnswerChoicesDisplay(text) {
  const groups = extractChoiceGroups(cleanAnswerDisplay(text));
  if (!groups.length) return '';
  return groups.map((group) => {
    const labels = group.letters.map((letter) => `(${letter})`).join('、');
    return group.index ? `第${group.index}題：${labels}` : labels;
  }).join('；');
}

function buildAnswerHtml(answerText, opts) {
  opts = opts || {};
  let raw = cleanAnswerDisplay(answerText) || '—';
  let lines = String(raw).split('\n').map(l => l.trim()).filter(l => l && l !== '—');
  if (opts.singleQuestion) {
    lines = lines.map(l => l.replace(/^第\s*[\d一二三四五六七八九十]+\s*題\s*[：:]\s*/, ''));
  }
  if (!lines.length) {
    return '<div class="answer-box answer-box--final"><span class="answer-box-inline">答：<span class="answer-box-value">—</span></span></div>';
  }
  const parts = lines.map((line) => {
    const qm = line.match(/^(第\s*[\d一二三四五六七八九十]+\s*題)\s*[：:]\s*(.*)$/);
    if (qm) {
      const choiceFmt = formatAnswerChoicesDisplay(qm[2]);
      return choiceFmt ? `${qm[1]}：${choiceFmt}` : `${qm[1]}：${formatAnswerInner(qm[2])}`;
    }
    const choiceFmt = formatAnswerChoicesDisplay(line);
    if (choiceFmt) return choiceFmt;
    return formatAnswerInner(line);
  });
  const display = parts.join('；');
  return `<div class="answer-box answer-box--final"><span class="answer-box-inline">答：<span class="answer-box-value">${display}</span></span></div>`;
}



function compiledSolutionToMarkdown(rawText) {
  const { body, answerText } = splitBodyAndAnswer(String(rawText || '').trim());
  const lines = body.split(/\r?\n/).map((source) => String(source || '').trim()).filter(Boolean);
  const blocks = [];
  let currentSection = '';
  const parseChoiceLine = (line) => {
    const marker = String(line || '').match(/^@@CHOICE\[([^\]\r\n]{1,16})\]@@\s*(.*)$/);
    if (marker) return { label: marker[1], body: marker[2] };
    const explicit = String(line || '').match(/^\s*(?:\(([^()\s]{1,16})\)|（([^（）\s]{1,16})）|\[([^\[\]\s]{1,16})\])\s*(.*)$/);
    return explicit ? { label: explicit[1] || explicit[2] || explicit[3], body: explicit[4] } : null;
  };
  const parseStepLine = (line) => {
    const step = String(line || '').match(/^\s*(\d+)\s*[\.．、:：]\s*(.*)$/);
    return step ? { index: step[1], body: step[2] } : null;
  };
  const parseDerivationLine = (line) => {
    const marker = String(line || '').match(/^@@DERIVATION@@\s*(.*)$/);
    return marker ? { body: marker[1] } : null;
  };
  const headingRe = /^【(.+)】$|^(題意|依據與推導|依據|推導|結果|選項判斷|選項分析|已知條件|解題步驟|結論)$/;
  const finish = (parts) => parts.join(' ')
    .replace(/\s+([，。；：！？、])/g, '$1')
    .replace(/([，。；：！？、])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .trim();
  const isStandaloneFormulaLine = (line) => {
    const text = String(line || '').trim();
    if (!text) return false;
    if (/^\$\$/.test(text) || /^\$\\begin\{/.test(text)) return true;
    if (/^\$\\ce\{/.test(text)) return true;
    const withoutTextCmd = text.replace(/\\(?:text|mathrm)\{[^}]*\}/g, '');
    if (/^\$/.test(text) && /[=≈→]|\\rightarrow|\\times|\\dfrac|->/.test(text) && !/[\u4e00-\u9fff]/.test(withoutTextCmd)) return true;
    if (/^\$[^$]+\$$/.test(text) && !/[\u4e00-\u9fff]/.test(withoutTextCmd)) return true;
    return false;
  };
  const derivationPiece = (line) => {
    const text = String(line || '').trim();
    if (!text) return '';
    const formula = isStandaloneFormulaLine(text)
      || /^\$[^$]+\$[。；]?$/.test(text);
    return `<div class="${formula ? 'markdown-derivation-formula' : 'markdown-derivation-text'}">${esc(text)}</div>`;
  };
  const derivationGroup = (lead, children) => {
    const pieces = [lead, ...(children || [])].map(derivationPiece).filter(Boolean).join('');
    return `<section class="markdown-derivation-group"><span class="markdown-derivation-bullet">•</span><div class="markdown-derivation-body">${pieces}</div></section>`;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(headingRe);
    if (heading) {
      const title = String(heading[1] || heading[2] || '').replace(/[<>&]/g, '');
      currentSection = title;
      blocks.push(`<h2 class="solve-section-title"><span class="solve-section-title-text">${title}</span></h2>`);
      continue;
    }

    const derivation = parseDerivationLine(line);
    if (derivation) {
      const children = [];
      while (
        i + 1 < lines.length
        && !parseDerivationLine(lines[i + 1])
        && !parseChoiceLine(lines[i + 1])
        && !headingRe.test(lines[i + 1])
      ) {
        children.push(lines[++i]);
      }
      blocks.push(derivationGroup(derivation.body, children));
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

    if (currentSection === '結果') {
      const step = parseStepLine(line);
      if (step) {
        const parts = [step.body];
        while (
          i + 1 < lines.length
          && !parseStepLine(lines[i + 1])
          && !parseChoiceLine(lines[i + 1])
          && !headingRe.test(lines[i + 1])
        ) {
          parts.push(lines[++i]);
        }
        blocks.push(`- <strong class="markdown-step-label">${step.index}、</strong><span class="markdown-step-body">${finish(parts)}</span>`);
        continue;
      }
    }

    if (isStandaloneFormulaLine(line)) {
      const display = line.match(/^\$(\\begin\{(?:array|cases|aligned|matrix|pmatrix|bmatrix)\}[\s\S]+)\$$/);
      blocks.push(display ? `$$\n${display[1]}\n$$` : line);
      continue;
    }

    const parts = [line];
    while (
      i + 1 < lines.length
      && !/[。．！？；;]$/.test(finish(parts))
      && !parseChoiceLine(lines[i + 1])
      && !(currentSection === '結果' && parseStepLine(lines[i + 1]))
      && !headingRe.test(lines[i + 1])
      && !isStandaloneFormulaLine(lines[i + 1])
    ) {
      parts.push(lines[++i]);
    }
    const paragraph = finish(parts);
    const display = paragraph.match(/^\$(\\begin\{(?:array|cases|aligned|matrix|pmatrix|bmatrix)\}[\s\S]+)\$$/);
    blocks.push(display ? `$$\n${display[1]}\n$$` : paragraph);
  }
  const markdown = blocks.join('\n\n')
    .replace(/<\/span>\n\n(?=- <strong class="markdown-choice-label">)/g, '</span>\n')
    .replace(/<\/span>\n\n(?=- <strong class="markdown-step-label">)/g, '</span>\n');
  return { markdown, answerText };
}

/**
 * marked 會把 Markdown 跳脫（含 \\, \\; \\!）還原成標點，毁掉 KaTeX 的薄空白。
 * 進 marked 前先抽出 $…$／$$…$$，解析後再還原。
 */
function withProtectedMath(markdown, run) {
  const stash = [];
  const protectedText = String(markdown || '').replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g, (segment) => {
    const key = `\uE710${'\uE711'.repeat(stash.length + 1)}\uE712`;
    stash.push(segment);
    return key;
  });
  let out = run(protectedText);
  stash.forEach((segment, index) => {
    out = out.split(`\uE710${'\uE711'.repeat(index + 1)}\uE712`).join(segment);
  });
  return out;
}

function renderMarkdownSolution(rawText) {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    throw new Error('Markdown renderer 未載入');
  }
  const { markdown, answerText } = compiledSolutionToMarkdown(rawText);
  const html = withProtectedMath(markdown, (safeMd) => marked.parse(safeMd, { gfm: true, breaks: false }));
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
  let needX = content.scrollWidth > avail + 1;
  if (!needX) {
    content.querySelectorAll('.katex, .math-block').forEach((node) => {
      if (node.scrollWidth > avail + 1) needX = true;
    });
  }
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
  clone.querySelectorAll('.katex, .math-block').forEach((node) => node.remove());
  const prose = String(clone.textContent || '')
    .replace(/[\s，。；：！？、,.!?;:＝=＋+－\-×÷*/()（）\[\]【】]/g, '');
  const cjkCount = (prose.match(/[\u3400-\u9fff]/g) || []).length;
  // 純算式，或只剩單位／符號碎片（g、mol、M 等）時仍視為公式行，應橫滑而非換行。
  if (cjkCount <= 4 && prose.length <= 12) return true;
  if (cjkCount === 0 && prose.length <= 24) return true;
  return false;
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
  const rows = root.querySelectorAll('.chem-markdown p, .chem-markdown .markdown-choice-body, .chem-markdown .markdown-derivation-formula');
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
  return {
    trust: () => false,
    macros: { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' }
  };
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
    if (node.parentElement?.closest('.katex')) continue;
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
    if (/\\htmlData\b/.test(tex)) return;
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

const LEAKED_LATEX_SNIPPET_RE = /\\(?:text|mathrm)\{[^{}]+\}(?:_\{?[^{}$]+\}?|\^\{?[^{}$]+\}?)*(?:\s*[hH_0-9]+\s*[=≈]\s*\\(?:text|mathrm)\{[^{}]+\}(?:\s*[hH_0-9]+)?)?|\\(?:dfrac|frac)\{(?:[^{}]|\{[^{}]*\})+\}\{(?:[^{}]|\{[^{}]*\})+\}(?:\s*\\times\s*\\(?:dfrac|frac)\{(?:[^{}]|\{[^{}]*\})+\}\{(?:[^{}]|\{[^{}]*\})+\})*|\\(?:Delta|textdegree)\b(?:\s*[A-Za-z])?|\[[A-Za-z]+\^[\{]?[0-9+\-]+[\}]?\](?:_\{?[A-Za-z0-9\u4e00-\u9fff]+\}?|_[\u4e00-\u9fff])?|[A-Z][a-z]?\^\{?[0-9+\-]+\}?|\d(?:\\text\{[spdf]\}\^?\{?\d+\}?)+/gi;

function recoverLeakedLatexInDom(root) {
  if (!root) return;
  root.querySelectorAll('.chem-markdown p, .markdown-choice-body, .markdown-derivation-text, .markdown-derivation-formula').forEach((inner) => {
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
  const NUM_EXTRA_UP_PX = 2;
  const INNER_VH_EM = 0.18;
  const OUTER_VH_EM = 0.10;
  const GAP_PX = 5;

  const isTopLevelMfrac = (mfrac) => !mfrac.parentElement?.closest('.mfrac');
  const isEqualsRel = (el) => ['=', '＝', '≈'].includes((el.textContent || '').trim());
  const centerY = (el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const getPartBoxBottom = (part) => part ? part.getBoundingClientRect().bottom : 0;
  const getPartBoxTop = (part) => part ? part.getBoundingClientRect().top : 0;

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
    root.querySelectorAll('.mfrac-has-nested, .mfrac-inner-in-num, .mfrac-inner-in-den, .mfrac-inner-native').forEach((mfrac) => {
      mfrac.classList.remove('mfrac-has-nested', 'mfrac-inner-in-num', 'mfrac-inner-in-den', 'mfrac-inner-native');
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
    });
  };

  const layoutOneOuter = (outer) => {
    if (!isTopLevelMfrac(outer)) return;
    const outerLayout = parseVlistT2(outer);
    if (!outerLayout) return;

    const inners = [...outer.querySelectorAll('.mfrac')].filter((m) => m !== outer);
    inners.forEach((inner) => {
      const zone = getInnerZone(outer, inner);
      if (!zone) return;
      inner.classList.add(zone === 'numerator' ? 'mfrac-inner-in-num' : 'mfrac-inner-in-den');

      const innerLayout = parseVlistT2(inner);
      if (!innerLayout) return;

      if (zone === 'numerator') {
        inner.classList.add('mfrac-inner-native');
      } else {
        nudgeTopEm(innerLayout.numPart, INNER_SPREAD_EM);
      }
      expandVlistHeight(innerLayout.vlist, INNER_VH_EM);
    });

    inners.forEach((inner) => {
      const zone = getInnerZone(outer, inner);
      const innerLayout = parseVlistT2(inner);
      if (!zone || !innerLayout || !outerLayout.fracLine) return;
      if (zone === 'numerator') return;
      const line = outerLayout.fracLine.getBoundingClientRect();
      const target = GAP_PX;

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

/** KaTeX 前：化學元素的 \mathrm{Cl}、\text{M} → 斜體；單位 mL／mol／M 與中文標籤保留 */
function normalizeChemLatexInMarkdown(root) {
  const scopes = collectMarkdownScopes(root);
  const UNIT_KEEP = /^(?:mmol|mol|mL|mg|kg|atm|kPa|Pa|min|h|A|C|M|L|g|s|K|°C|g\,mol\^\{-1\})$/i;
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
      s = s.replace(/\\mathrm\{([^{}]+)\}/g, (m, inner) => {
        const t = String(inner || '').trim();
        if (UNIT_KEEP.test(t.replace(/\s+/g, ''))) return m;
        if (/^g\\,mol\^\{-1\}$/.test(t)) return m;
        return t;
      });
      s = s.replace(/\\text\{([^{}]+)\}/g, (m, inner) => {
        const t = String(inner || '').trim();
        if (BOARD_KEEP_TEXT.test(t) || /[\u4e00-\u9fff]/.test(t)) return m;
        if (UNIT_KEEP.test(t)) return `\\mathrm{${t}}`;
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

/* Repair Markdown <code> that still contains ce / bare chem after marked. */
function repairCodeChemSpans(root) {
  if (!root || typeof normalizeScientificTokens !== 'function') return;
  root.querySelectorAll('.chem-markdown code').forEach((code) => {
    const raw = String(code.textContent || '').trim();
    if (!raw || !/(?:\\?ce[\{A-Za-z]|(?<![A-Za-z])ce[\{A-Za-z])/.test(raw)) return;
    const parent = code.parentElement;
    if (!parent) return;
    const normalized = normalizeScientificTokens(raw);
    if (normalized === raw) return;
    parent.replaceChild(document.createTextNode(normalized), code);
  });
}

function postProcessMarkdownBoard(root) {
  if (!root) return;
  hideKatexErrors(root);
  markAndSpaceNestedFractions(root);
  normalizeCjkLatinSpacing(root);
  // After KaTeX layout: decide whether a whole calculation row needs one
  // horizontal scroll owner instead of several fragment-level scrollbars.
  setupHorizontalLineScroll(root);
}

function doKaTeX(element) {
  if (!element || typeof renderMathInElement !== 'function') return;
  const { trust, macros } = getKatexOpts();
  const katexOpts = {
    throwOnError: false,
    strict: 'ignore',
    trust,
    macros,
    preProcess: (math) => normalizeMhchemForKatex(String(math || '').replace(/^\$+|\$+$/g, ''))
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
