/* Structured reaction parsing, validation, balancing and safe display. */
(function (global) {
  'use strict';

  const tools = global.KnowledgeTools || {};
  const SUB = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9' };
  const SUP = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-' };
  const EPS = 1e-10;
  const esc = tools.esc || (value => String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[ch]));

  function normalize(value) {
    return String(value || '').trim()
      .replace(/\\ce\{([^{}]*)\}/g, '$1').replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, '$1')
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUB[ch]).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, ch => SUP[ch])
      .replace(/\s+/g, '');
  }
  function addAtoms(target, source, amount) {
    Object.entries(source).forEach(([element, count]) => { target[element] = (target[element] || 0) + count * amount; });
  }
  function splitCharge(value) {
    const raw = normalize(value).replace(/(?:\((?:aq|s|l|g)\)|\[(?:aq|s|l|g)\])$/i, '');
    if (!raw) throw new Error('缺少化學式。');
    if (raw === 'e-' || raw === 'e^-') return { formula: 'e', charge: -1, electron: true };
    let hit = raw.match(/^(.*)\^\{?(\d*)([+-])\}?$/);
    if (hit) return { formula: hit[1], charge: (hit[3] === '+' ? 1 : -1) * Number(hit[2] || 1) };
    // Accept the common Fe2+ shorthand without confusing NH4+ with NH^4+.
    hit = raw.match(/^([A-Z][a-z]?)(\d+)([+-])$/);
    if (hit) return { formula: hit[1], charge: (hit[3] === '+' ? 1 : -1) * Number(hit[2]) };
    hit = raw.match(/^(.*?)([+-])$/);
    if (hit) return { formula: hit[1], charge: hit[2] === '+' ? 1 : -1 };
    return { formula: raw, charge: 0 };
  }
  function parseFormula(value) {
    const formula = normalize(value);
    if (!formula) throw new Error('缺少化學式。');
    const parsePart = part => {
      let at = 0;
      const readNumber = () => {
        const digits = part.slice(at).match(/^\d+/)?.[0] || '';
        at += digits.length; return Number(digits || 1);
      };
      const readGroup = closing => {
        const atoms = {}; let hasItem = false;
        while (at < part.length) {
          if (closing && part[at] === closing) { at++; return atoms; }
          if (part[at] === '(' || part[at] === '[') {
            const close = part[at++] === '(' ? ')' : ']';
            addAtoms(atoms, readGroup(close), readNumber()); hasItem = true; continue;
          }
          const element = part.slice(at).match(/^[A-Z][a-z]?/)?.[0];
          if (!element) throw new Error(`「${part.slice(at)}」不是有效的化學式片段。`);
          at += element.length; atoms[element] = (atoms[element] || 0) + readNumber(); hasItem = true;
        }
        if (closing) throw new Error('括號沒有正確關閉。');
        if (!hasItem) throw new Error('缺少元素符號。');
        return atoms;
      };
      const atoms = readGroup('');
      if (at !== part.length) throw new Error(`無法讀取「${part.slice(at)}」。`);
      return atoms;
    };
    const total = {};
    formula.split(/[·.]/).filter(Boolean).forEach(part => {
      const prefix = part.match(/^(\d+)(?=[A-Z(\[])/)?.[1] || '';
      addAtoms(total, parsePart(part.slice(prefix.length)), Number(prefix || 1));
    });
    return total;
  }
  function parseTerm(value) {
    const raw = String(value || '').trim();
    const hit = raw.match(/^(\d+)?\s*(.*?)\s*$/);
    if (!hit || !hit[2]) throw new Error('反應式中有空白物種。');
    const coefficient = Number(hit[1] || 1);
    if (!Number.isInteger(coefficient) || coefficient <= 0) throw new Error('係數必須是正整數。');
    const charge = splitCharge(hit[2]);
    if (charge.electron) return { coefficient, formula: 'e', atoms: {}, charge: -1, electron: true };
    if (!charge.formula) throw new Error(`「${raw}」只有電荷，缺少元素符號；請檢查是否遺失 H 等元素。`);
    return { coefficient, formula: charge.formula, atoms: parseFormula(charge.formula), charge: charge.charge, electron: false };
  }
  function parseSide(value) {
    const text = String(value || '').trim();
    if (!text) throw new Error('反應物或生成物不可留白。');
    const parts = text.split(/\s+\+\s+/).map(item => item.trim()).filter(Boolean);
    if (parts.length === 1 && /\+/.test(text) && !/[+-]$/.test(text)) throw new Error('請以空格分隔物種，例如 H2 + O2。');
    return parts.map(parseTerm);
  }
  function parseReaction(value) {
    const text = String(value || '').replace(/\\(?:rightleftharpoons|rightarrow|to)/g, '→').replace(/⇌/g, '→');
    const sides = text.split(/(?:→|->|(?<![<>])=(?![=>]))/);
    if (sides.length !== 2) throw new Error('請輸入含 → 或 -> 的單一反應式。');
    return { reactants: parseSide(sides[0]), products: parseSide(sides[1]) };
  }
  function totalAtoms(terms) { const total = {}; terms.forEach(term => addAtoms(total, term.atoms, term.coefficient)); return total; }
  function totalCharge(terms) { return terms.reduce((sum, term) => sum + term.coefficient * term.charge, 0); }
  function elementNames(parsed) { return [...new Set([...Object.keys(totalAtoms(parsed.reactants)), ...Object.keys(totalAtoms(parsed.products))])].sort(); }
  function checkReaction(value) {
    let parsed;
    try { parsed = typeof value === 'string' ? parseReaction(value) : value; }
    catch (error) { return { ok: false, error: error.message || '無法讀取反應式。' }; }
    const left = totalAtoms(parsed.reactants), right = totalAtoms(parsed.products);
    const difference = elementNames(parsed).filter(element => left[element] !== right[element]).map(element => `${element}: ${left[element] || 0} / ${right[element] || 0}`);
    const leftCharge = totalCharge(parsed.reactants), rightCharge = totalCharge(parsed.products);
    const chargeDifference = leftCharge === rightCharge ? '' : `總電荷: ${leftCharge} / ${rightCharge}`;
    return { ok: !difference.length && !chargeDifference, left, right, leftCharge, rightCharge, difference, chargeDifference, parsed };
  }

  function rref(matrix) {
    const rows = matrix.map(row => row.slice()); let pivotRow = 0; const pivots = [];
    for (let col = 0; col < rows[0].length && pivotRow < rows.length; col++) {
      let found = pivotRow;
      for (let row = pivotRow + 1; row < rows.length; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[found][col])) found = row;
      if (Math.abs(rows[found][col]) < EPS) continue;
      [rows[pivotRow], rows[found]] = [rows[found], rows[pivotRow]];
      const pivot = rows[pivotRow][col]; rows[pivotRow] = rows[pivotRow].map(item => item / pivot);
      for (let row = 0; row < rows.length; row++) {
        if (row === pivotRow) continue;
        const factor = rows[row][col]; if (Math.abs(factor) < EPS) continue;
        rows[row] = rows[row].map((item, index) => item - factor * rows[pivotRow][index]);
      }
      pivots.push(col); pivotRow++;
    }
    return { rows, pivots };
  }
  function rational(value) {
    const sign = value < 0 ? -1 : 1; let x = Math.abs(value); let h0 = 0, h1 = 1, k0 = 1, k1 = 0;
    for (let step = 0; step < 16; step++) {
      const a = Math.floor(x), h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > 1000000) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      const fraction = x - a; if (fraction < EPS) break; x = 1 / fraction;
    }
    return [sign * h1, k1 || 1];
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
  function balanceParsed(parsed, options = {}) {
    const terms = [...parsed.reactants, ...parsed.products].map(term => ({ ...term, coefficient: 1 }));
    const productStart = parsed.reactants.length, omit = options.omit || new Set();
    const rows = elementNames(parsed).filter(element => !omit.has(element));
    if (options.charge !== false) rows.push('__charge__');
    if (!rows.length) throw new Error('沒有可用於配平的元素。');
    const matrix = rows.map(row => terms.map((term, index) => (row === '__charge__' ? term.charge : (term.atoms[row] || 0)) * (index < productStart ? 1 : -1)));
    const reduced = rref(matrix), free = terms.map((_, index) => index).filter(index => !reduced.pivots.includes(index));
    if (!free.length) throw new Error('此反應式沒有可用的非零配平解。');
    const solution = terms.map(() => 0); free.forEach(index => { solution[index] = 1; });
    reduced.pivots.forEach((pivot, row) => { solution[pivot] = free.reduce((sum, index) => sum - reduced.rows[row][index], 0); });
    if (solution.every(value => value < -EPS)) solution.forEach((value, index) => { solution[index] = -value; });
    if (solution.some(value => value < EPS)) throw new Error('此反應式有多種配平方式；請補上物種或改用半反應模式。');
    const fractions = solution.map(rational), denominator = fractions.reduce((all, [, bottom]) => lcm(all, bottom), 1);
    const integers = fractions.map(([top, bottom]) => Math.round(top * denominator / bottom));
    const divisor = integers.reduce(gcd); const coefficients = integers.map(value => value / divisor);
    return { reactants: terms.slice(0, productStart).map((term, index) => ({ ...term, coefficient: coefficients[index] })), products: terms.slice(productStart).map((term, index) => ({ ...term, coefficient: coefficients[index + productStart] })) };
  }
  function chargeText(charge) { return charge ? `^${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '-'}` : ''; }
  function formatTerm(term) { return `${term.coefficient === 1 ? '' : term.coefficient}${term.formula}${chargeText(term.charge)}`; }
  function formatReaction(parsed) { return `${parsed.reactants.map(formatTerm).join(' + ')} → ${parsed.products.map(formatTerm).join(' + ')}`; }
  function balanceReaction(value) {
    try { const parsed = balanceParsed(parseReaction(value)); return { ok: true, parsed, reaction: formatReaction(parsed), validation: checkReaction(parsed) }; }
    catch (error) { return { ok: false, error: error.message || '無法自動配平。' }; }
  }

  function cloneSide(side) { return side.map(term => ({ ...term, atoms: { ...term.atoms } })); }
  function addTerm(side, formula, charge, amount) {
    const found = side.find(term => term.formula === formula && term.charge === charge);
    if (found) found.coefficient += amount;
    else side.push({ coefficient: amount, formula, atoms: formula === 'e' ? {} : parseFormula(formula), charge, electron: formula === 'e' });
  }
  function removeTerm(side, formula, charge, amount) {
    const found = side.find(term => term.formula === formula && term.charge === charge);
    if (!found || found.coefficient < amount) throw new Error(`無法移除 ${formula}${chargeText(charge)}。`);
    found.coefficient -= amount; if (!found.coefficient) side.splice(side.indexOf(found), 1);
  }
  function cancelWater(left, right) {
    const a = left.find(term => term.formula === 'H2O' && !term.charge)?.coefficient || 0;
    const b = right.find(term => term.formula === 'H2O' && !term.charge)?.coefficient || 0;
    const amount = Math.min(a, b); if (amount) { removeTerm(left, 'H2O', 0, amount); removeTerm(right, 'H2O', 0, amount); }
  }
  function balanceRedoxHalfReaction(value, medium) {
    try {
      const original = parseReaction(value);
      if ([...original.reactants, ...original.products].some(term => term.formula === 'H2O' || term.formula === 'OH' || term.electron || (term.formula === 'H' && term.charge === 1))) throw new Error('半反應模式請先輸入未補 H2O、H+、OH-、e- 的骨架反應式。');
      const core = balanceParsed(original, { charge: false, omit: new Set(['H', 'O']) });
      const left = cloneSide(core.reactants), right = cloneSide(core.products), steps = ['先配平除 H、O 以外的元素。'];
      let oxygen = (totalAtoms(left).O || 0) - (totalAtoms(right).O || 0);
      if (oxygen > 0) { addTerm(right, 'H2O', 0, oxygen); steps.push(`右側補 ${oxygen} H2O 以平衡氧。`); }
      if (oxygen < 0) { addTerm(left, 'H2O', 0, -oxygen); steps.push(`左側補 ${-oxygen} H2O 以平衡氧。`); }
      const hydrogen = (totalAtoms(left).H || 0) - (totalAtoms(right).H || 0);
      if (hydrogen > 0) { addTerm(right, 'H', 1, hydrogen); steps.push(`右側補 ${hydrogen} H+ 以平衡氫。`); }
      if (hydrogen < 0) { addTerm(left, 'H', 1, -hydrogen); steps.push(`左側補 ${-hydrogen} H+ 以平衡氫。`); }
      const charge = totalCharge(left) - totalCharge(right);
      if (charge > 0) { addTerm(left, 'e', -1, charge); steps.push(`左側補 ${charge} e- 以平衡電荷。`); }
      if (charge < 0) { addTerm(right, 'e', -1, -charge); steps.push(`右側補 ${-charge} e- 以平衡電荷。`); }
      if (medium === 'basic') {
        const hLeft = left.find(term => term.formula === 'H' && term.charge === 1)?.coefficient || 0;
        const hRight = right.find(term => term.formula === 'H' && term.charge === 1)?.coefficient || 0;
        const amount = hLeft + hRight;
        if (amount) {
          addTerm(left, 'OH', -1, amount); addTerm(right, 'OH', -1, amount);
          if (hLeft) { removeTerm(left, 'H', 1, hLeft); removeTerm(left, 'OH', -1, hLeft); addTerm(left, 'H2O', 0, hLeft); }
          if (hRight) { removeTerm(right, 'H', 1, hRight); removeTerm(right, 'OH', -1, hRight); addTerm(right, 'H2O', 0, hRight); }
          cancelWater(left, right); steps.push('兩側加入 OH-，將 H+ 轉成 H2O，再約去兩側共有的水。');
        }
      }
      const parsed = { reactants: left, products: right };
      return { ok: true, parsed, reaction: formatReaction(parsed), validation: checkReaction(parsed), steps };
    } catch (error) { return { ok: false, error: error.message || '無法完成半反應配平。' }; }
  }
  function termHtml(term) {
    const formula = esc(term.formula).replace(/(\d+)/g, '<sub>$1</sub>');
    const coefficient = term.coefficient === 1 ? '' : `<span class="chem-coefficient">${term.coefficient}</span>`;
    const charge = term.charge ? `<sup>${esc(`${Math.abs(term.charge) === 1 ? '' : Math.abs(term.charge)}${term.charge > 0 ? '+' : '-'}`)}</sup>` : '';
    return `<span class="chem-term">${coefficient}${formula}${charge}</span>`;
  }
  function reactionHtml(value) {
    const parsed = typeof value === 'string' ? parseReaction(value) : value;
    return `${parsed.reactants.map(termHtml).join('<span class="chem-op"> + </span>')}<span class="chem-op"> → </span>${parsed.products.map(termHtml).join('<span class="chem-op"> + </span>')}`;
  }

  Object.assign(tools, { parseReaction, checkReaction, balanceReaction, balanceRedoxHalfReaction, formatReaction, reactionHtml });
  global.KnowledgeTools = tools;
})(window);
