/* 詳解排版閘門：只修可確定的 LaTeX 格式問題，不改變化學推理。 */
(function (global) {
  'use strict';

  function validate(latex, displayMode) {
    if (typeof global.katex === 'undefined' || !global.katex.renderToString) return true;
    global.katex.renderToString(latex, { displayMode: !!displayMode, throwOnError: true, strict: 'ignore', trust: false });
    return true;
  }

  function normalizeDelimiters(text) {
    return String(text || '').replace(/\r\n?/g, '\n')
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => `$$${String(tex).trim()}$$`)
      .replace(/\\\(([^\n]*?)\\\)/g, (_, tex) => `$${String(tex).trim()}$`)
      .replace(/\$\$\s*\n?([\s\S]*?)\n?\s*\$\$/g, (_, tex) => `$$${String(tex).trim()}$$`);
  }

  function mathRanges(text) {
    const ranges = [];
    const re = /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
    let match;
    while ((match = re.exec(text))) {
      ranges.push({ start: match.index, end: re.lastIndex, latex: (match[1] == null ? match[2] : match[1]).trim(), display: match[1] != null });
    }
    return ranges;
  }

  function outsideMath(text, ranges) {
    let cursor = 0;
    return ranges.map(range => {
      const part = text.slice(cursor, range.start);
      cursor = range.end;
      return part;
    }).join('') + text.slice(cursor);
  }

  function check(text) {
    const ranges = mathRanges(text);
    const errors = [];
    const warnings = [];
    ranges.forEach(range => {
      if (!range.latex) errors.push('發現空白公式分隔符號');
      else {
        try { validate(range.latex, range.display); }
        catch (err) { errors.push(`公式無法渲染：${String(err.message || err).slice(0, 80)}`); }
      }
    });
    const plain = outsideMath(text, ranges);
    const leaked = plain.match(/\\(?:d?frac|sqrt|times|cdot|left|right|mathrm|text|ce|cech|rightarrow|rightleftharpoons|Delta|alpha|beta|gamma|log)\b/g);
    if (leaked?.length) errors.push(`發現 ${leaked.length} 個未包進 $...$ 的 LaTeX 指令`);
    const unmatched = (plain.match(/(?<!\\)\$/g) || []).length;
    if (unmatched) errors.push('發現未配對的 $ 符號');
    if (/〔[^〕]*〕/.test(text)) warnings.push('部分公式已降級為可讀文字，請在匯出前確認原意');
    return { ok: !errors.length, errors, warnings, mathCount: ranges.length };
  }

  function format(raw) {
    const original = String(raw || '');
    let text = normalizeDelimiters(original).replace(/[ \t]+\n/g, '\n').trim();
    if (global.LatexSanitize?.sanitizeText) {
      text = global.LatexSanitize.sanitizeText(text, { validate });
    }
    const report = check(text);
    return { text, report, changed: text !== original.trim() };
  }

  function toPlainPreview(text) {
    return String(text || '').replace(/\n{3,}/g, '\n\n');
  }

  global.SolutionFormat = { format, check, normalizeDelimiters, toPlainPreview };
})(window);
