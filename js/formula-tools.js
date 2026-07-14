/* 瀏覽器端公式輸入與保守驗算：不讀取 API Key、不把公式傳到第三方。 */
(function (global) {
  'use strict';

  function field() { return document.getElementById('formulaInput'); }
  function status(message, warning) {
    const el = document.getElementById('formulaToolStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-warning', !!warning);
  }

  async function initMathLive() {
    const input = field();
    if (!input) return;
    try {
      if (!customElements.get('math-field')) {
        await import('https://cdn.jsdelivr.net/npm/mathlive@0.109.0/+esm');
      }
      input.setAttribute('math-virtual-keyboard-policy', 'auto');
      status('可用數學鍵盤輸入公式；「插入題目」會保留為 LaTeX。');
    } catch (err) {
      console.warn('[FormulaTools] MathLive 載入失敗', err);
      status('公式鍵盤暫時無法載入；仍可直接在題目欄輸入 LaTeX。', true);
    }
  }

  function latex() {
    const input = field();
    if (!input) return '';
    if (typeof input.getValue === 'function') return String(input.getValue('latex') || '');
    return String(input.value || '');
  }

  function insertIntoQuestion() {
    const value = latex().trim();
    const target = document.getElementById('textQuestionInput');
    if (!value || !target) return status('請先輸入一個公式。', true);
    const wrapped = `$${value}$`;
    const start = target.selectionStart == null ? target.value.length : target.selectionStart;
    const end = target.selectionEnd == null ? target.value.length : target.selectionEnd;
    target.value = target.value.slice(0, start) + wrapped + target.value.slice(end);
    target.focus();
    target.setSelectionRange(start + wrapped.length, start + wrapped.length);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    status('公式已插入題目欄；送出時會一併交給 Gemini。');
  }

  function readGroup(text, start) {
    if (text[start] !== '{') return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}' && --depth === 0) return { value: text.slice(start + 1, i), end: i + 1 };
    }
    return null;
  }

  function unwrapHtmlData(text) {
    let out = '';
    let cursor = 0;
    const source = String(text || '');
    while (cursor < source.length) {
      const pos = source.indexOf('\\htmlData', cursor);
      if (pos < 0) return out + source.slice(cursor);
      out += source.slice(cursor, pos);
      const attr = readGroup(source, pos + 9);
      const body = attr && readGroup(source, attr.end);
      if (!attr || !body) return out + source.slice(pos);
      out += body.value;
      cursor = body.end;
    }
    return out;
  }

  function latexToMathJs(source) {
    let text = unwrapHtmlData(source).replace(/\\(?:d?frac)/g, '\\frac');
    let cursor = 0;
    while ((cursor = text.indexOf('\\frac', cursor)) >= 0) {
      const numerator = readGroup(text, cursor + 5);
      const denominator = numerator && readGroup(text, numerator.end);
      if (!numerator || !denominator) break;
      const value = `(${latexToMathJs(numerator.value)})/(${latexToMathJs(denominator.value)})`;
      text = text.slice(0, cursor) + value + text.slice(denominator.end);
      cursor += value.length;
    }
    return text
      .replace(/\\left|\\right|\\,/g, '')
      .replace(/\\times|\\cdot/g, '*')
      .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\\(sin|cos|tan|log|ln)/g, '$1')
      .replace(/\^\{([^{}]*)\}/g, '^($1)')
      .replace(/\{/g, '(')
      .replace(/\}/g, ')')
      .replace(/×/g, '*')
      .trim();
  }

  function computeEnginePreview(source) {
    const Ctor = global.ComputeEngine && (global.ComputeEngine.ComputeEngine || global.ComputeEngine);
    if (typeof Ctor !== 'function') return '';
    try {
      const expr = new Ctor().parse(source);
      if (!expr || expr.isValid === false) return '';
      const simplified = typeof expr.simplify === 'function' ? expr.simplify() : expr;
      return String(simplified.latex || simplified.toLatex?.() || '');
    } catch (_) { return ''; }
  }

  function numericEquality(source) {
    if (!global.math || !/=/.test(source)) return null;
    const parts = source.split('=');
    if (parts.length !== 2) return null;
    const left = latexToMathJs(parts[0]);
    const right = latexToMathJs(parts[1]);
    if (!left || !right || !/^[\d\s+*/().,^a-zA-Z%-]+$/.test(left + right)) return null;
    try {
      const a = global.math.evaluate(left);
      const b = global.math.evaluate(right);
      return { ok: !!global.math.equal(a, b), left: global.math.format(a, { precision: 12 }), right: global.math.format(b, { precision: 12 }) };
    } catch (_) { return null; }
  }

  function verifyInput() {
    const value = latex().trim();
    if (!value) return status('請先輸入一個公式。', true);
    const equality = numericEquality(value);
    if (equality) {
      status(equality.ok
        ? `本機驗算一致：左邊＝${equality.left}，右邊＝${equality.right}。`
        : `本機驗算不一致：左邊＝${equality.left}，右邊＝${equality.right}。`, !equality.ok);
      return equality;
    }
    const simplified = computeEnginePreview(value);
    if (simplified) {
      status(`公式語法可讀取；化簡參考：${simplified}`);
      return { ok: true, symbolic: true };
    }
    status('這個公式含未知數、複雜 LaTeX 或不支援的單位；已保留給 AI 進一步判讀。', true);
    return null;
  }

  function auditReply(reply) {
    const formulas = String(reply || '').match(/\$([^$\n]+)\$/g) || [];
    const checked = [];
    const failed = [];
    formulas.forEach((item) => {
      const source = item.slice(1, -1);
      const result = numericEquality(source);
      if (!result) return;
      checked.push(source);
      if (!result.ok) failed.push(source);
    });
    return { checked: checked.length, failed: failed.length, formulas: failed.slice(0, 2) };
  }

  global.FormulaTools = { auditReply, verifyInput, insertIntoQuestion, latexToMathJs };
  global.insertFormulaIntoQuestion = insertIntoQuestion;
  global.verifyFormulaInput = verifyInput;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMathLive, { once: true });
  else initMathLive();
})(window);
