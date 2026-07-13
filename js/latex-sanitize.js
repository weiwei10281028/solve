/**
 * js/latex-sanitize.js — 生成式解題輸出進入 KaTeX 前的最後一道修復。
 * 只修格式，不臆測題目數值或化學意義。
 */
(function (global) {
  'use strict';

  const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋' };
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };

  function isEscaped(s, index) {
    let n = 0;
    for (let i = index - 1; i >= 0 && s[i] === '\\'; i--) n++;
    return n % 2 === 1;
  }

  function readGroup(s, open) {
    if (s[open] !== '{') return null;
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === '{' && !isEscaped(s, i)) depth++;
      else if (s[i] === '}' && !isEscaped(s, i) && --depth === 0) {
        return { start: open, end: i, body: s.slice(open + 1, i) };
      }
    }
    return null;
  }

  function balanceBraces(raw) {
    let out = '';
    let depth = 0;
    for (let i = 0; i < String(raw || '').length; i++) {
      const ch = raw[i];
      if (ch === '{' && !isEscaped(raw, i)) depth++;
      if (ch === '}' && !isEscaped(raw, i)) {
        if (depth <= 0) continue;
        depth--;
      }
      out += ch;
    }
    return out + '}'.repeat(depth);
  }

  function lastTopLevelGroup(body) {
    let depth = 0;
    let last = null;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '{' && !isEscaped(body, i)) {
        if (depth === 0) {
          const group = readGroup(body, i);
          if (group) last = group;
        }
        depth++;
      } else if (body[i] === '}' && !isEscaped(body, i)) {
        depth = Math.max(0, depth - 1);
      }
    }
    return last;
  }

  /** 將 \dfrac{a {b = c}} 這類常見少一組大括號恢復為 \dfrac{a}{b}=c。 */
  function repairSingleArgumentFractions(raw) {
    let s = String(raw || '');
    let cursor = 0;
    while (cursor < s.length) {
      const at = s.indexOf('\\dfrac', cursor);
      if (at < 0) break;
      let p = at + 6;
      while (/\s/.test(s[p] || '')) p++;
      const numerator = readGroup(s, p);
      if (!numerator) { cursor = p; continue; }
      let q = numerator.end + 1;
      while (/\s/.test(s[q] || '')) q++;
      if (s[q] === '{') { cursor = q + 1; continue; }

      const nested = lastTopLevelGroup(numerator.body);
      if (!nested) { cursor = numerator.end + 1; continue; }
      const head = numerator.body.slice(0, nested.start).trim();
      let denominator = nested.body.trim();
      if (!head || !denominator) { cursor = numerator.end + 1; continue; }
      let tail = '';
      const eq = denominator.indexOf('=');
      if (eq >= 0) {
        tail = denominator.slice(eq).trim();
        denominator = denominator.slice(0, eq).trim();
      }
      const fixed = `\\dfrac{${head}}{${denominator}}${tail}`;
      s = s.slice(0, at) + fixed + s.slice(numerator.end + 1);
      cursor = at + fixed.length;
    }
    return s;
  }

  function stripBrokenNoteWrappers(raw) {
    return String(raw || '')
      .replace(/\\htmlData\s*\{[^{}]*\}\s*/g, '')
      .replace(/\\htmlData\s*/g, '');
  }

  function repairMath(raw, validate) {
    const original = String(raw || '').trim();
    if (!original) return { ok: false, latex: '' };
    const candidates = [];
    const add = (v) => { if (v && !candidates.includes(v)) candidates.push(v); };
    add(original);
    add(balanceBraces(original));
    add(repairSingleArgumentFractions(balanceBraces(original)));
    add(repairSingleArgumentFractions(balanceBraces(stripBrokenNoteWrappers(original))));
    for (const latex of candidates) {
      try {
        if (!validate || validate(latex)) return { ok: true, latex };
      } catch (_) { /* try the next conservative repair */ }
    }
    return { ok: false, latex: candidates[candidates.length - 1] || original };
  }

  function unicodeRun(value, map) {
    return String(value || '').split('').map((ch) => map[ch] || ch).join('');
  }

  /** 完全無法驗證時不露出原始 \dfrac／\htmlData，也不顯示「公式格式待修」。 */
  function readableMath(raw) {
    let s = stripBrokenNoteWrappers(String(raw || ''));
    s = s.replace(/\\(?:d)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
    s = s.replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\approx/g, '≈');
    s = s.replace(/\\rightleftharpoons/g, '⇌').replace(/\\rightarrow/g, '→').replace(/\\log/g, 'log');
    s = s.replace(/_\{([^{}]+)\}|_([0-9+\-]+)/g, (_, a, b) => unicodeRun(a || b, SUB));
    s = s.replace(/\^\{([^{}]+)\}|\^([0-9+\-]+)/g, (_, a, b) => unicodeRun(a || b, SUP));
    s = s.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').replace(/\s{2,}/g, ' ').trim();
    return s || '公式';
  }

  function findClosingDollar(text, start, delimiter) {
    for (let i = start; i < text.length; i++) {
      if (text.startsWith(delimiter, i) && !isEscaped(text, i)) return i;
      if (delimiter === '$' && text[i] === '\n') return -1;
    }
    return -1;
  }

  function sanitizeText(raw, options) {
    const text = String(raw || '');
    const validate = options?.validate;
    let out = '';
    let cursor = 0;
    while (cursor < text.length) {
      const start = text.indexOf('$', cursor);
      if (start < 0) return out + text.slice(cursor);
      if (isEscaped(text, start)) {
        out += text.slice(cursor, start + 1);
        cursor = start + 1;
        continue;
      }
      const delimiter = text.startsWith('$$', start) ? '$$' : '$';
      out += text.slice(cursor, start);
      const bodyStart = start + delimiter.length;
      const close = findClosingDollar(text, bodyStart, delimiter);
      const end = close >= 0 ? close : (delimiter === '$' ? (text.indexOf('\n', bodyStart) >= 0 ? text.indexOf('\n', bodyStart) : text.length) : text.length);
      const fixed = repairMath(text.slice(bodyStart, end), (latex) => validate ? validate(latex, delimiter === '$$') : true);
      if (fixed.ok) out += `${delimiter}${fixed.latex}${delimiter}`;
      else out += `〔${readableMath(fixed.latex)}〕`;
      cursor = close >= 0 ? close + delimiter.length : end;
    }
    return out;
  }

  global.LatexSanitize = { sanitizeText, repairMath, readableMath };
})(typeof window !== 'undefined' ? window : globalThis);
