/* 單一詳解核心：Gemini 只交付內容區塊，顯示語法由本機編譯。 */
(function (global) {
  'use strict';

  const BLOCK_TYPES = ['heading', 'paragraph', 'chemical_equation', 'calculation', 'reaction_table', 'choice'];
  const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
  const CHEM_CANDIDATE = /(^|[^A-Za-z\\])((?:[A-Z][a-z]?\d*){1,6}(?:\((?:[A-Z][a-z]?\d*)+\)\d*)?(?:\^?\{?\d*[+-]\}?)?)(?=$|[^A-Za-z])/g;
  const SCHEMA = {
    type: 'object',
    required: ['blocks', 'answer'],
    properties: {
      blocks: {
        type: 'array', minItems: 1, maxItems: 48,
        items: {
          type: 'object', required: ['type', 'text'],
          properties: {
            type: { type: 'string', enum: BLOCK_TYPES },
            text: { type: 'string' }
          }
        }
      },
      answer: { type: 'string' }
    }
  };

  const SYSTEM = `你是台灣高中化學解題老師，只負責正確推理與詳解內容，使用繁體中文與台灣用語。
只依題目作答；資料不足要明說，不猜測。化學式、電荷、係數、單位、有效數字與選項判斷必須正確。
回傳符合指定 schema 的 JSON，不輸出 Markdown、HTML、NOTE、htmlData、$、\\ce、排版指令或檢查報告。
blocks 依閱讀順序排列：
- heading：只有使用者啟用的進階格式要求步驟小標時才用，text 放短標題；一般模式不要自行加模板標題。
- paragraph：中文說明放 text。
- chemical_equation：text 只放配平反應式，如 MnO4^- + 5Fe^2+ + 8H+ -> Mn^2+ + 5Fe^3+ + 4H2O，不加 \\ce。
- calculation：text 只放一條完整等號鏈，可使用基礎 LaTeX，但不得加 $；說明另用 paragraph。
- reaction_table：只有進階規則明確要求反應變化表時才用，text 固定寫成「物種：A｜B｜C；起始：…｜…｜…；變化：…｜…｜…；結果：…｜…｜…」。一般模式禁止使用。
- choice：text 固定寫成「A｜完整理由｜敘述正確」；題目有幾個選項就輸出幾個，不限 A～E。
共同計算先放在選項前，不在每個選項重複。answer 只放最終答案，例如 A,B,C 或 0.084 M。
固定外形：{"blocks":[{"type":"paragraph","text":"..."},{"type":"choice","label":"A","text":"...","verdict":"敘述正確"}],"answer":"A"}。`;

  function buildSystem(extra, advanced) {
    const rules = String(extra || '').trim();
    const controls = String(advanced || '').trim();
    return [SYSTEM,
      rules ? `【本題化學規則】\n${rules}\n規則中的 NOTE 與顯示語法由本機處理；只採用化學內容。` : '',
      controls ? `【已啟用進階功能】\n${controls}\n必須反映於 blocks 結構與推理內容；仍不得輸出 NOTE、HTML 或 $。` : ''
    ].filter(Boolean).join('\n\n');
  }

  function parse(raw) {
    if (raw && typeof raw === 'object') return raw;
    let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const first = text.indexOf('{'); const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    const unescapedLatex = /(?<!\\)\\(?:frac|dfrac|times|text|mathrm|ce|approx|rightarrow|cdot|div|sqrt|left|right|log|ln|Delta|alpha|beta|gamma)\b/.test(text);
    if (!unescapedLatex) {
      try { return JSON.parse(text); } catch (_) { /* Gemini Lite 偶爾漏掉 LaTeX 反斜線跳脫。 */ }
    }
    let repaired = ''; let inString = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"' && (i === 0 || text[i - 1] !== '\\')) inString = !inString;
      if (inString && char === '\\') {
        const next = text[i + 1] || '';
        const jsonEscape = /["\\/bfnrt]/.test(next) && !(/[bfnrt]/.test(next) && /[A-Za-z]/.test(text[i + 2] || ''));
        const unicodeEscape = next === 'u' && /^[0-9a-f]{4}$/i.test(text.slice(i + 2, i + 6));
        if (!jsonEscape && !unicodeEscape) repaired += '\\';
      }
      repaired += char;
    }
    try { return JSON.parse(repaired); } catch (_) { return null; }
  }

  function clean(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }

  function fullwidth(value) {
    return clean(value)
      .replace(/\.{3,}/g, '……')
      .replace(/[，,]\s*[；;]/g, '；').replace(/[；;]\s*[，,]/g, '；')
      .replace(/,/g, '，').replace(/;/g, '；').replace(/:/g, '：')
      .replace(/\?/g, '？').replace(/!/g, '！')
      .replace(/\.(?!\d)/g, '。')
      .replace(/\(([^()]*)\)/g, '（$1）')
      .replace(/([，。；：？！])\1+/g, '$1')
      .replace(/\s+([，。；：？！])/g, '$1');
  }

  function isChemicalToken(value) {
    const token = String(value || '').replace(/\^?\{?\d*[+-]\}?$/, '');
    const symbols = token.match(/[A-Z][a-z]?/g) || [];
    if (!symbols.length || /^(?:M|L|K|A|B|C|D|E)$/.test(value)) return false;
    return symbols.every((symbol) => ELEMENTS.has(symbol));
  }

  function normalizeChemToken(value) {
    let token = String(value || '').replace(/[⁺]/g, '+').replace(/[⁻−]/g, '-');
    const ion = token.match(/^([A-Z][a-z]?)(\d+)([+-])$/);
    if (ion) token = `${ion[1]}^${ion[2]}${ion[3]}`;
    return token;
  }

  function formatText(value, state) {
    const stash = [];
    const noteState = state || { mCount: 0, volumeCount: 0 };
    const keep = (value) => {
      const key = `\uE200${'x'.repeat(stash.length + 1)}\uE201`;
      stash.push(value);
      return key;
    };
    let text = clean(value).replace(/\$([^$]+)\$/g, (whole, body) => {
      if (!/[=≈]|(?:mol|mL|L|M|mg|kg|atm|kPa|Pa)\b/i.test(body)) return whole;
      return keep(math(calculation(body, noteState)));
    }).replace(CHEM_CANDIDATE, (whole, prefix, token) => {
      if (!isChemicalToken(token)) return whole;
      return prefix + keep(`$\\ce{${normalizeChemToken(token)}}$`);
    }).replace(/\d+(?:\.\d+)?\s*(?:g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h)\b/gi, (quantity) => {
      return keep(math(calculation(quantity, noteState)));
    }).replace(/\d+(?:\.\d+)?/g, (number) => {
      return keep(math(number));
    });
    text = fullwidth(text);
    stash.forEach((item, index) => { text = text.replace(`\uE200${'x'.repeat(index + 1)}\uE201`, item); });
    return text;
  }

  function splitNarrative(value) {
    const sentences = clean(value).match(/[^。！？；;]+[。！？；;]?/g) || [];
    const lines = [];
    sentences.forEach((sentence) => {
      if (/\$[^$]+\$/.test(sentence)) { lines.push(sentence.trim()); return; }
      const equals = (sentence.match(/[=＝]/g) || []).length;
      if (equals < 2) { lines.push(sentence.trim()); return; }
      const parts = sentence.match(/[^,，]+[,，]?/g) || [];
      let prose = '';
      parts.forEach((part) => {
        if (!/[=＝]/.test(part)) { prose += part; return; }
        if (prose.trim()) {
          lines.push(prose.trim().replace(/[，,]\s*$/, '。'));
          prose = '';
        }
        lines.push(part.trim().replace(/[，,]\s*$/, '。'));
      });
      if (prose.trim()) lines.push(prose.trim());
    });
    return lines;
  }

  function formatNarrativeLine(value, state) {
    const source = clean(value);
    if (/->|→/.test(source)) {
      const terminal = (source.match(/[，。；：？！]+$/) || [''])[0];
      const body = terminal ? source.slice(0, -terminal.length) : source;
      const colon = Math.max(body.lastIndexOf('：'), body.lastIndexOf(':'));
      const prefix = colon >= 0 ? body.slice(0, colon + 1) : '';
      return `${formatText(prefix, state)}${chemistry(body.slice(colon + 1))}${fullwidth(terminal)}`;
    }
    if (/\$[^$]+\$/.test(source)) return formatText(source, state);
    if (!/[=＝]/.test(source)) return formatText(source, state);
    const candidates = [
      source.search(/\[[^\]]+\]\s*[=＝]/),
      source.search(/\b(?:pH|[rvkmnxyCt])(?:_?\d+)?\s*(?:_[^=＝\s]+)?\s*(?:[=＝\/×＊*÷])/i),
      source.search(/\d+(?:\.\d+)?(?:\s*[A-Za-z]+(?:\s*\^?\s*-?\d+)?)?\s*(?:[\/×＊*÷]|\^\s*\d+\s*[=＝])/)
    ].filter((index) => index >= 0);
    if (!candidates.length) return formatText(source, state);
    const start = Math.min(...candidates);
    let end = source.length;
    const terminal = (source.match(/[，。；：？！]+$/) || [''])[0];
    if (terminal) end -= terminal.length;
    const tail = source.slice(start);
    const proseTail = tail.search(/[,，;；](?=[^,，;；]*[\u4e00-\u9fff])/);
    if (proseTail >= 0) end = Math.min(end, start + proseTail);
    const punctuation = source.slice(end);
    return `${formatText(source.slice(0, start), state)}${math(calculation(source.slice(start, end), state))}${formatText(punctuation, state)}`;
  }

  function formatNarrative(value, state) {
    return splitNarrative(value).map((line) => formatNarrativeLine(line, state)).filter(Boolean);
  }

  function normalizeDocument(value) {
    const source = Array.isArray(value) && value.length === 1 ? value[0] : value;
    if (!source || typeof source !== 'object') return null;
    if (Array.isArray(source.blocks)) return source;
    const blocks = [];
    ['paragraph', 'chemical_equation', 'calculation'].forEach((type) => {
      const items = Array.isArray(source[type]) ? source[type] : [source[type]];
      items.filter(Boolean).forEach((item) => blocks.push({ type, ...(typeof item === 'string' ? { text: item } : item) }));
    });
    const choices = Array.isArray(source.choice) ? source.choice : (source.choice ? [source.choice] : []);
    choices.forEach((item) => blocks.push({ type: 'choice', ...(item || {}) }));
    return blocks.length ? { blocks, answer: source.answer || '' } : null;
  }

  function math(value) {
    const body = clean(value).replace(/^\$+|\$+$/g, '').trim();
    return body ? `$${body}$` : '';
  }

  function chemistry(value) {
    let body = clean(value).replace(/^\\ce\s*\{?|\}$/g, '').trim()
      .replace(/⇌|↔/g, '<=>').replace(/→/g, '->');
    body = body.replace(CHEM_CANDIDATE, (whole, prefix, token) => prefix + (isChemicalToken(token) ? normalizeChemToken(token) : token));
    return body ? `$\\ce{${body}}$` : '';
  }

  function splitCalculation(value) {
    const parts = []; let start = 0; let depth = 0; const source = clean(value);
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth = Math.max(0, depth - 1);
      else if (!depth && /[,，;；]/.test(source[i])) { parts.push(source.slice(start, i)); start = i + 1; }
    }
    parts.push(source.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  function speciesName(source) {
    const value = String(source || '').replace(/[^A-Za-z0-9+-]/g, '');
    if (/MnO4/i.test(value)) return '過錳酸根';
    if (/Fe2/i.test(value)) return '亞鐵離子';
    if (/Fe3/i.test(value)) return '鐵（III）離子';
    return '';
  }

  function annotateQuantities(source, state = {}) {
    if (!Number.isFinite(state.mCount)) state.mCount = 0;
    if (!Number.isFinite(state.volumeCount)) state.volumeCount = 0;
    const quantity = /(\d+(?:\.\d+)?(?:\s*\\times\s*10\s*\^\s*(?:\{[-+]?\d+\}|[-+]?\d+))?)\s*(g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h)/gi;
    return source.replace(quantity, (whole, number, unit, offset) => {
      const before = source.slice(0, offset);
      const u = /^g\s*mol/i.test(unit) ? 'g mol⁻¹' : (unit === 'mol' ? 'mol' : unit);
      let note = `數值，單位 ${u}`;
      if (u === 'M') {
        state.mCount += 1;
        note = state.mCount === 1 ? '滴定液濃度，單位 M' : '亞鐵離子濃度，單位 M';
      } else if (/^(?:mL|L)$/i.test(u)) {
        note = `溶液體積（${u}）`;
      } else if (u === 'mol') {
        const vars = [...before.matchAll(/n_\{([^}]+)\}/g)];
        const species = speciesName(vars.length ? vars[vars.length - 1][1] : '');
        note = `${species || ''}莫耳數，單位 mol`;
      } else if (u === 'g mol⁻¹') note = '莫耳質量，單位 g mol⁻¹';
      else if (/g$/i.test(u)) note = `質量，單位 ${u}`;
      return `\\htmlData{note=${note}}{${number.replace(/\s+/g, '')}}`;
    });
  }

  function annotateBareNumbers(source) {
    const protectedParts = [];
    const protect = (value) => {
      const key = `\uE300${'x'.repeat(protectedParts.length + 1)}\uE301`;
      protectedParts.push(value);
      return key;
    };
    let body = source
      .replace(/\\htmlData\{[^{}]*\}\{(?:[^{}]|\{[^{}]*\})*\}/g, protect)
      .replace(/\\ce\{[^{}]*\}/g, protect);
    const number = /\d+(?:\.\d+)?(?:\s*\\times\s*10\s*\^\s*\{[-+]?\d+\})?/g;
    body = body.replace(number, (value, offset) => {
      const before = body.slice(0, offset);
      const after = body.slice(offset + value.length);
      if (/[_^]\{?[-+]?\s*$/.test(before)) return value;
      const lastValue = !/\d/.test(after);
      let note = '題目給定數值';
      if (lastValue && /[=＝]/.test(before)) note = '計算結果';
      else if (/^\d+$/.test(value.trim())) note = '反應係數或換算因子';
      return `\\htmlData{note=${note}}{${value.replace(/\s+/g, '')}}`;
    });
    protectedParts.forEach((value, index) => {
      body = body.replace(`\uE300${'x'.repeat(index + 1)}\uE301`, value);
    });
    return body;
  }

  function calculation(value, state) {
    let body = clean(value).replace(/^\$+|\$+$/g, '')
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/[×＊*]/g, '\\times ')
      .replace(/÷/g, '\\div ')
      .replace(/≈/g, '\\approx ')
      .replace(/→/g, '\\rightarrow ')
      .replace(/\\frac\b/g, '\\dfrac')
      .replace(/\\,/g, ' ')
      .replace(/\\(?:mathrm|text)\{\s*([^{}]+)\s*\}/g, '$1')
      .replace(/\^\s*(-?\d+)(?![}\d])/g, '^{$1}')
      .replace(/\(\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\)/g, '\\dfrac{$1}{$2}')
      .replace(/\(\s*([^()]+)\s*\)\s*\/\s*(\d+(?:\.\d+)?(?:\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h))?)/gi, '\\dfrac{$1}{$2}')
      .replace(/(\d+(?:\.\d+)?(?:\s*g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h))?)\s*\/\s*(\d+(?:\.\d+)?(?:\s*g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h))?)/gi, '\\dfrac{$1}{$2}')
      .replace(/\b([tv])_(\d+)\b/g, '$1_{$2}')
      .replace(/\b([tv])(\d+)\b/g, '$1_{$2}')
      .replace(/\b([tv](?:_\{\d+\})?)\s*\/\s*([tv](?:_\{\d+\})?)/g, '\\dfrac{$1}{$2}');
    body = annotateQuantities(body, state);
    body = body.replace(/\\ce\{([^{}]+)\}/g, (whole, token) => `\\ce{${normalizeChemToken(token)}}`);
    body = body.replace(/n\s*\(\s*([^()]+)\s*\)/g, (whole, token) => isChemicalToken(token) ? `n_{\\ce{${normalizeChemToken(token)}}}` : whole);
    body = body.replace(/n_\{([^{}]+)\}/g, (whole, token) => isChemicalToken(token) ? `n_{\\ce{${normalizeChemToken(token)}}}` : whole);
    body = body.replace(/\[([^\]]+)\]/g, (whole, token) => !/\\ce\{/.test(token) && isChemicalToken(token) ? `[\\ce{${normalizeChemToken(token)}}]` : whole);
    body = body.replace(/=\s*(\d+)\s*\\times(?=\s*n_)/g, '=\\htmlData{note=反應係數比}{$1}\\times');
    body = annotateBareNumbers(body);
    return body.replace(/[=＝]\s*$/, '').trim();
  }

  function answerText(value) {
    const answer = clean(value).toUpperCase();
    return /^[A-Z](?:\s*[,，、]\s*[A-Z])+$/.test(answer)
      ? answer.split(/\s*[,，、]\s*/).join('、')
      : fullwidth(value);
  }

  function expandEmbeddedChoices(blocks) {
    const out = [];
    blocks.forEach((block) => {
      if (block?.type !== 'choice') { out.push(block); return; }
      const parts = clean(block.text).split(/\s+\(([A-Z])\)\s+/);
      out.push({ ...block, text: parts[0] });
      for (let i = 1; i < parts.length; i += 2) {
        out.push({ type: 'choice', label: parts[i], text: parts[i + 1] || '', verdict: '' });
      }
    });
    return out;
  }

  function reactionTable(block, fallbackEquation = '') {
    const encoded = clean(block.text);
    const fields = encoded.split(/[；;]\s*/).map((part) => {
      const match = part.match(/^\s*([^：:]+)\s*[：:]\s*(.+)$/);
      return match ? { label: clean(match[1]), values: clean(match[2]).split(/[｜|]/).map(clean) } : null;
    }).filter(Boolean);
    const sourceSpecies = (Array.isArray(block.species) ? block.species : (fields.find((field) => /^(物種|species)$/i.test(field.label)) || {}).values || [])
      .map(clean).filter(Boolean).slice(0, 8);
    const sourceRows = (Array.isArray(block.rows) ? block.rows : fields.filter((field) => !/^(物種|species)$/i.test(field.label)))
      .filter((row) => row && Array.isArray(row.values)).slice(0, 8);
    if (!sourceSpecies.length || !sourceRows.length) return '';
    const [left = '', right = ''] = clean(fallbackEquation).split(/\s*(?:->|→)\s*/);
    const terms = (side, role) => side.split(/\s+\+\s+/).map((part) => {
      const match = clean(part).replace(/\s*\((?:aq|s|l|g)\)$/i, '').match(/^(\d+(?:\.\d+)?)?\s*(.+)$/);
      return match ? { coefficient: Number(match[1] || 1), species: clean(match[2]), role } : null;
    }).filter(Boolean);
    const reactants = terms(left, 'left');
    const products = terms(right, 'right').filter((term) => !/^H2O$/i.test(term.species));
    const changeRow = sourceRows.find((row) => /^變化/.test(fullwidth(row.label)));
    const changedIndex = changeRow ? changeRow.values.findIndex((value) => /^\s*[-−]\s*\d+(?:\.\d+)?\s*$/.test(clean(value))) : -1;
    const baseChange = changedIndex >= 0 ? Math.abs(Number(clean(changeRow.values[changedIndex]).replace('−', '-'))) : NaN;
    const baseTerm = reactants.find((term) => term.species === sourceSpecies[changedIndex]) || reactants[0];
    const additions = Number.isFinite(baseChange) && baseTerm
      ? products.filter((term) => !sourceSpecies.includes(term.species)).map((term) => ({
        species: term.species,
        amount: String(Number((baseChange * term.coefficient / baseTerm.coefficient).toPrecision(12)))
      })) : [];
    const species = [...sourceSpecies, ...additions.map((item) => item.species)].slice(0, 8);
    const rows = sourceRows.map((row) => ({
      ...row,
      values: [...row.values, ...additions.map((item) => {
        const label = fullwidth(row.label);
        if (/^起始/.test(label)) return '0';
        if (/^變化/.test(label)) return `+${item.amount}`;
        if (/^(結果|平衡)/.test(label)) return item.amount;
        return '—';
      })]
    }));
    const cell = (value) => `\\qquad ${value} \\qquad`;
    const equationTerms = [...reactants, ...products].filter((term) => species.includes(term.species));
    const ordered = equationTerms.length ? equationTerms : species.map((species) => ({ species, coefficient: 1, role: 'left' }));
    const formula = (term) => `${term.coefficient === 1 ? '' : term.coefficient}${chemistry(term.species).replace(/^\$|\$$/g, '')}`;
    const head = ['\\text{}'];
    ordered.forEach((term, index) => {
      if (index) head.push(ordered[index - 1].role === term.role ? '\\text{＋}' : '\\rightarrow');
      head.push(cell(formula(term)));
    });
    const noteState = { mCount: 0, volumeCount: 0 };
    const body = rows.map((row) => {
      let label = fullwidth(row.label).replace(/[{}\\]/g, '');
      if (/^(起始|變化)/.test(label)) label = label.replace(/\s*[（(]\s*mol\s*[）)]/i, '');
      const values = ordered.flatMap((term, index) => {
        const value = clean(row.values[species.indexOf(term.species)] || '—');
        const item = cell(/^[—-]+$/.test(value) ? '\\text{—}' : calculation(value, noteState));
        return index ? ['\\text{}', item] : [item];
      });
      return [`\\text{${label || '—'}}`, ...values].join(' & ');
    });
    const resultIndex = rows.findIndex((row) => /^(結果|平衡)/.test(fullwidth(row.label)));
    const splitAt = resultIndex > 0 ? resultIndex : Math.max(1, body.length - 1);
    return `$\\begin{array}{l${'c'.repeat(Math.max(1, ordered.length * 2 - 1))}}${head.join(' & ')} \\\\[0.8em] ${body.slice(0, splitAt).join(' \\\\[0.8em] ')} \\\\[0.9em] \\hline \\\\[0.8em] ${body.slice(splitAt).join(' \\\\[0.8em] ')}\\end{array}$`;
  }

  function compile(doc) {
    if (!doc || !Array.isArray(doc.blocks)) return '';
    const lines = [];
    let latestEquation = '';
    const blocks = expandEmbeddedChoices(doc.blocks);
    blocks.forEach((block, index) => {
      if (!BLOCK_TYPES.includes(block?.type)) return;
      const expression = clean(block.expression);
      if (block.type === 'heading') {
        const heading = fullwidth(block.text).replace(/^[【\[]|[】\]]$/g, '').replace(/[。；]+$/, '');
        if (heading) lines.push(`【${heading}】`);
      } else if (block.type === 'paragraph') {
        const hasReactionTable = blocks.slice(index + 1).some((item) => item?.type === 'reaction_table');
        if (latestEquation && hasReactionTable && /^反應式如下[：:]?$/.test(clean(block.text))) return;
        const noteState = { mCount: 0, volumeCount: 0 };
        lines.push(...formatNarrative(block.text, noteState));
      } else if (block.type === 'chemical_equation') {
        const hasReactionTable = blocks.slice(index + 1).some((item) => item?.type === 'reaction_table');
        const text = clean(block.expression) && !(hasReactionTable && /^反應式如下[：:]?$/.test(clean(block.text))) ? formatText(block.text) : '';
        if (text) lines.push(text);
        latestEquation = expression || clean(block.text);
        if (latestEquation && !hasReactionTable) lines.push(chemistry(latestEquation));
      } else if (block.type === 'calculation') {
        const text = clean(block.expression) ? formatText(block.text) : '';
        if (text) lines.push(text);
        const noteState = { mCount: 0, volumeCount: 0 };
        splitCalculation(expression || clean(block.text)).forEach((part) => lines.push(math(calculation(part, noteState))));
      } else if (block.type === 'reaction_table') {
        const table = reactionTable(block, latestEquation);
        if (table) lines.push(table);
        else {
          const text = formatText(block.text);
          if (text) lines.push(text);
        }
      } else {
        const noteState = { mCount: 0, volumeCount: 0 };
        const choiceParts = clean(block.text).split(/[｜|]/).map(clean);
        const label = clean(block.label || choiceParts.shift()).replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const verdict = fullwidth(block.verdict || choiceParts.pop()).replace(/[，。；：]+$/, '');
        const parts = formatNarrative(choiceParts.join('｜') || block.text, noteState);
        if (!label) return;
        if (expression) parts.push(math(calculation(expression, noteState)));
        if (!parts.length) parts.push('');
        const last = parts.length - 1;
        const body = parts[last].replace(/[，。；：]+$/, '');
        parts[last] = verdict ? `${body}${body.endsWith(verdict) ? '。' : `，${verdict}。`}` : parts[last];
        lines.push(`(${label}) ${parts[0]}`, ...parts.slice(1));
      }
    });
    const answer = answerText(doc.answer);
    if (answer) lines.push(`@@ANSWER@@${answer}`);
    return lines.join('\n');
  }

  function prepare(raw) {
    const document = normalizeDocument(parse(raw));
    const text = compile(document);
    return text
      ? { ok: true, text, document, fallback: false }
      : { ok: false, text: String(raw || '').trim(), document: null, fallback: true };
  }

  global.SolutionCore = Object.freeze({ SCHEMA, SYSTEM, buildSystem, parse, normalizeDocument, fullwidth, formatText, calculation, compile, prepare });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SolutionCore;
})(typeof window !== 'undefined' ? window : globalThis);
