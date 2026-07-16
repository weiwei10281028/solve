/* 單一詳解核心：Gemini 只交付內容區塊，顯示語法由本機編譯。 */
(function (global) {
  'use strict';

  const BLOCK_TYPES = ['heading', 'paragraph', 'chemical_equation', 'calculation', 'reaction_table', 'choice'];
  const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
  const CHEM_CANDIDATE = /(^|[^A-Za-z\\])((?:[A-Z][a-z]?\d*){1,6}(?:\((?:[A-Z][a-z]?\d*)+\)\d*)?(?:\^?\{?\d*[+-]\}?)?)(?=$|[^A-Za-z])/g;
  const STRUCTURE_NARRATIVE = /混成|鍵角|孤對電子|π\s*鍵|共振|路易斯|價電子|VSEPR|分子形狀|平面三角|直線型|四面體|三角錐/;
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
多質子酸題先由解離度求未解離酸 C(1-α) 與其餘物種總和 Cα，再配合物種比逐級代入 Ka；Ka_i=[H+][去質子化物種]/[前一級酸物種]，pKa_i=pH-log([去質子化物種]/[前一級酸物種])。不得在 Ka 尚未求得前自行引入 10 的 pKa 次方。
若題目指定稀釋後 pH 保持不變，須用固定的 [H+] 與 Ka 重新檢查物種比，不可直接套用一般「稀釋使解離度增加」。
遇到路易斯結構、VSEPR、混成軌域、鍵角、共振、孤對電子或 π 鍵比較時，先核對價電子總數與共振後的鍵級；比較值不同時不可寫成「＝」。
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

  function abstractAcidLatex(value) {
    const token = String(value || '').replace(/\s+/g, '').replace(/[⁺]/g, '+').replace(/[⁻−]/g, '-');
    const match = token.match(/^(H\d*A|HA|A)(?:\^?\{?(\d*)([+-])\}?)?$/);
    if (!match || (match[1] === 'A' && !match[3])) return '';
    const base = match[1].replace(/^H(\d+)A$/, 'H_{$1}A');
    const charge = match[3] ? `^{${match[2] || ''}${match[3]}}` : '';
    return `\\mathrm{${base}}${charge}`;
  }

  function normalizeEquilibriumSymbols(value) {
    return String(value || '')
      .replace(/\bpK\s*_?\s*(?:\{\s*)?(\d+)\s*\}?/g, 'pK_{a$1}')
      .replace(/\b(p?K)\s*_?\s*(?:\{\s*)?(sp|[abcwp])\s*(\d*)\s*\}?/g,
        (_, symbol, family, index) => `${symbol.startsWith('p') ? 'pK' : 'K'}_{${family}${index}}`);
  }

  function normalizeChemToken(value) {
    let token = String(value || '').replace(/[⁺]/g, '+').replace(/[⁻−]/g, '-');
    const ion = token.match(/^([A-Z][a-z]?)(\d+)([+-])$/);
    if (ion) token = `${ion[1]}^${ion[2]}${ion[3]}`;
    return token;
  }

  function normalizeChemMarkup(value) {
    let text = String(value || '');
    for (let i = 0; i < 3; i += 1) {
      const next = text.replace(/\\ce\s*\{\s*\\ce\s*\{([^{}]+)\}\s*\}?/g, '\\ce{$1}');
      if (next === text) break;
      text = next;
    }
    return text.replace(/\\ce\s*\{([^{}]+)\}/g, (_, token) => `\\ce{${normalizeChemToken(token)}}`);
  }

  function formatText(value, state) {
    const stash = [];
    const noteState = state || { mCount: 0, volumeCount: 0 };
    const keep = (value) => {
      const key = `\uE200${'x'.repeat(stash.length + 1)}\uE201`;
      stash.push(value);
      return key;
    };
    let text = clean(normalizeEquilibriumSymbols(normalizeChemMarkup(value))).replace(/\$([^$]+)\$/g, (whole, body) => {
      const latex = normalizeEquilibriumSymbols(normalizeChemMarkup(body)).trim();
      const ce = latex.match(/^\\ce\{([^{}]+)\}$/);
      if (ce) return keep(chemistry(ce[1]));
      const acid = abstractAcidLatex(latex);
      if (acid) return keep(math(acid));
      if (isChemicalToken(latex)) return keep(chemistry(latex));
      if (/[=≈]|(?:mol|mL|L|M|mg|kg|atm|kPa|Pa)\b/i.test(latex)) return keep(math(calculation(latex, noteState)));
      return keep(math(latex));
    }).replace(/\\ce\s*\{([^{}]+)\}/g, (_, token) => keep(chemistry(token)))
      .replace(/\[([^\]]+)\]/g, (whole, token) => {
        const acid = abstractAcidLatex(token);
        if (acid) return keep(math(`[${acid}]`));
        return isChemicalToken(token) ? keep(math(`[\\ce{${normalizeChemToken(token)}}]`)) : whole;
      })
      .replace(/\bp?K_\{(?:sp|[abcwp])\d*\}/g, (symbol) => keep(math(symbol)))
      .replace(/(^|[^A-Za-z\\])((?:H\d*A|HA)(?:\^?\{?\d*[+\-−⁻]\}?)?|A(?:\^?\{?\d+[+\-−⁻]\}?|[+\-−⁻]))(?=$|[^A-Za-z])/g, (whole, prefix, token) => {
        const latex = abstractAcidLatex(token);
        return latex ? prefix + keep(math(latex)) : whole;
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
    const source = clean(normalizeEquilibriumSymbols(normalizeChemMarkup(value)));
    if (STRUCTURE_NARRATIVE.test(source)) return formatText(source, state);
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
      source.search(/\[[^\]]+\]\s*(?:[=＝\/×＊*+\-÷])/),
      source.search(/\b(?:p?K_\{(?:sp|[abcwp])\d*\}|pH)\s*[=＝]/),
      source.search(/\b(?:pH|[rvkmnxyCt])(?:_?\d+)?\s*(?:_[^=＝\s]+)?\s*(?:[=＝\/×＊*÷])/i),
      source.search(/\d+(?:\.\d+)?(?:\s*[A-Za-z]+(?:\s*\^?\s*-?\d+)?)?\s*(?:[\/×＊*÷]|\^\s*\d+\s*[=＝])/)
    ].filter((index) => index >= 0);
    if (!candidates.length) return formatText(source, state);
    let start = Math.min(...candidates);
    if (start > 0 && source[start - 1] === '(') {
      const close = source.indexOf(')', start);
      if (close > start && /^\s*\//.test(source.slice(close + 1))) start -= 1;
    }
    let end = source.length;
    const terminal = (source.match(/[，。；：？！]+$/) || [''])[0];
    if (terminal) end -= terminal.length;
    const tail = source.slice(start);
    const proseTail = tail.search(/[,，;；](?=[^,，;；]*[\u4e00-\u9fff])/);
    if (proseTail >= 0) end = Math.min(end, start + proseTail);
    const punctuation = source.slice(end);
    const calcState = Object.assign({}, state, {
      narrativePrefix: source.slice(0, start),
      narrativeLine: source
    });
    return `${formatText(source.slice(0, start), state)}${math(calculation(source.slice(start, end), calcState))}${formatText(punctuation, state)}`;
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
    let body = clean(normalizeChemMarkup(value)).replace(/^\\ce\s*\{?|\}$/g, '').trim()
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
    if (/IO3/i.test(value)) return '碘酸根';
    if (/HSO3/i.test(value)) return '亞硫酸氫根';
    if (/SO4/i.test(value)) return '硫酸根';
    if (/H3O|H\+/i.test(value)) return '氫離子';
    if (/OH/i.test(value)) return '氫氧根';
    if (/Ag/i.test(value)) return '銀離子';
    if (/Cu2/i.test(value)) return '銅（II）離子';
    if (/Cu\+|Cu1/i.test(value)) return '銅（I）離子';
    if (/I2/i.test(value)) return '碘';
    if (/I-/i.test(value)) return '碘離子';
    return '';
  }

  function formatSpeciesLabel(value) {
    const sub = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
    const sup = { '+': '⁺', '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(value || '')
      .replace(/\\ce\{([^{}]+)\}/g, '$1')
      .replace(/\^?\{?(\d*)([+-])\}?$/g, (_, n, sign) => `${n ? [...n].map((ch) => sup[ch] || ch).join('') : ''}${sup[sign]}`)
      .replace(/([A-Za-z\)])(\d+)/g, (_, a, n) => `${a}${[...n].map((ch) => sub[ch] || ch).join('')}`);
  }

  function speciesLabel(source) {
    const name = speciesName(source);
    return name ? `${formatSpeciesLabel(source)}（${name}）` : formatSpeciesLabel(source);
  }

  function contextWindow(source, offset, span = 44) {
    return String(source || '').slice(Math.max(0, offset - span), offset + span);
  }

  function inferSpeciesFromContext(source) {
    const text = String(source || '');
    const bracket = [...text.matchAll(/\[([^{}\]]+)\]/g)].pop();
    if (bracket) return speciesLabel(bracket[1]);
    const sub = [...text.matchAll(/(?:C|n|m)_\{([^{}]+)\}/g)].pop();
    if (sub) return speciesLabel(sub[1]);
    const plainMatches = [...text.matchAll(/((?:[A-Z][a-z]?\d*){1,4}(?:\^?\{?\d*[+-]\}?|[+-])?)/g)].reverse();
    for (const plain of plainMatches) {
      if (!/^(?:M|L|K|A|B|C|D|E|V|T|PV|RT)$/.test(plain[1])) return speciesLabel(plain[1]);
    }
    return '';
  }

  function noteContext(source, offset, state = {}) {
    return `${state.narrativePrefix || ''} ${state.narrativeLine || ''} ${contextWindow(source, offset, 70)}`;
  }

  function dilutionSpecies(state, source, offset) {
    return inferSpeciesFromContext(`${state.narrativePrefix || ''} ${String(source || '').slice(0, offset)}`);
  }

  function isDilutionExpression(source, state = {}) {
    const text = `${state.narrativePrefix || ''} ${state.narrativeLine || ''} ${source || ''}`;
    return /濃度|稀釋|混合|總體積|\[[^\]]+\]/.test(text) && /\\times\s*\\dfrac/.test(source);
  }

  function quantityNote(unit, source, offset, state = {}) {
    const ctx = noteContext(source, offset, state);
    const before = String(source || '').slice(0, offset);
    const species = inferSpeciesFromContext(`${state.narrativePrefix || ''} ${before}`);
    if (unit === 'M') {
      state.mCount += 1;
      if (isDilutionExpression(source, state) && species) {
        return /\\times\s*$|[＊*×]\s*$/.test(before) || /\\times\s*\\dfrac|\*\s*\(/.test(source.slice(offset))
          ? `原 ${species} 溶液濃度`
          : `混合後 ${species} 濃度`;
      }
      if (species) return `${species}濃度，代入濃度或速率式`;
      if (/[KQ]_(?:c|p)|平衡|ICE|解離|Ka|Kb|pH/i.test(ctx)) return '平衡或解離計算中的濃度';
      if (/稀釋|混合|總體積|配成|定容/.test(ctx)) return '混合後溶液濃度';
      if (/速率|rate|v[_\d]?|級數|反應時間/.test(ctx)) return '速率式中的反應物濃度';
      return state.mCount === 1 ? '溶液濃度，單位 M' : '另一溶液或物種的濃度';
    }
    if (/^(?:mL|L)$/i.test(unit)) {
      const speciesForDilution = dilutionSpecies(state, source, offset);
      if (isDilutionExpression(source, state) && /\\dfrac\{[^{}]*$/.test(String(source || '').slice(0, offset))) {
        return speciesForDilution ? `取用的 ${speciesForDilution} 溶液體積（${unit}）` : `取用原溶液體積（${unit}）`;
      }
      if (isDilutionExpression(source, state) && /\\dfrac\{[^{}]*\}\{[^{}]*$/.test(String(source || '').slice(0, offset))) {
        return `混合後總體積（${unit}）`;
      }
      if (/總體積|混合後|配成|定容|稀釋/.test(ctx)) return `混合後總體積，濃度計算要用 ${unit}`;
      if (/加入|取|量取|移取|滴加/.test(ctx)) return `題目給的溶液體積（${unit}）`;
      if (/\/|\\dfrac|V/.test(ctx)) return `濃度公式中的溶液體積（${unit}）`;
      return `溶液體積（${unit}）`;
    }
    if (unit === 'mol') {
      if (species) return `${species}的物質的量（莫耳數）`;
      if (/限量|過量|剩餘|消耗|生成/.test(ctx)) return '反應中追蹤的莫耳數';
      return '物質的量，單位 mol';
    }
    if (unit === 'g mol⁻¹') return '式量／分子量，用來把質量換成莫耳數';
    if (/g$/i.test(unit)) {
      if (/樣品|溶質|秤|取|質量/.test(ctx)) return '溶質質量，先換成莫耳數';
      return `質量，單位 ${unit}`;
    }
    if (/^(?:s|min|h)$/i.test(unit)) {
      if (/速率|反應時間|秒|時間/.test(ctx)) return '反應時間；時間越短，平均速率越快';
      return `時間，單位 ${unit}`;
    }
    if (/^(?:atm|kPa|Pa)$/i.test(unit)) {
      if (/分壓|Kp|氣體|壓力/.test(ctx)) return `氣體壓力或分壓，單位 ${unit}`;
      return `壓力，單位 ${unit}`;
    }
    if (unit === 'A') return '電流，計算電量 Q=It';
    if (unit === 'C') return '電量，單位庫侖 C';
    if (unit === 'K') return '絕對溫度，氣體或平衡計算須用 K';
    return `已知量，單位 ${unit}`;
  }

  function annotateQuantities(source, state = {}) {
    if (!Number.isFinite(state.mCount)) state.mCount = 0;
    if (!Number.isFinite(state.volumeCount)) state.volumeCount = 0;
    const quantity = /(\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:\s*\\times\s*10\s*\^\s*(?:\{[-+]?\d+\}|[-+]?\d+))?)\s*(g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C)/gi;
    return source.replace(quantity, (whole, number, unit, offset) => {
      const u = /^g\s*mol/i.test(unit) ? 'g mol⁻¹' : (unit === 'mol' ? 'mol' : unit);
      const after = source.slice(offset + whole.length);
      if (u === 's' && (/^\s*\^/.test(after) || /Ksp|溶解度|沉澱|飽和/.test(contextWindow(source, offset)))) return whole;
      const note = quantityNote(u, source, offset, state);
      return `\\htmlData{note=${note}}{${formatNumericLatex(number)}}`;
    });
  }

  function formatNumericLatex(value) {
    const raw = String(value || '').replace(/\s+/g, '');
    const m = raw.match(/^(\d+(?:\.\d+)?)e([+-]?\d+)$/i);
    return m ? `${m[1]}\\times10^{${Number(m[2])}}` : raw;
  }

  function bareNumberNote(value, source, offset, state = {}) {
    const before = source.slice(0, offset);
    const after = source.slice(offset + value.length);
    const ctx = noteContext(source, offset, state);
    const cleanValue = String(value || '').trim();
    const lastValue = !/\d/.test(after);
    const gasLawLike = /0\.082|PV|nRT|氣體|壓力|溫度|絕對溫度|P\/T|P\s*V|R\s*T/i.test(`${ctx} ${source}`);
    if (gasLawLike && /\\dfrac\{\s*$/.test(before)) return '氣體壓力，代入 PV=nRT';
    if (gasLawLike && /\\dfrac\{[^{}]*\\times\s*$/.test(before)) return '氣體體積，代入 PV=nRT';
    if (gasLawLike && /\\dfrac\{[^{}]+\}\{\s*$/.test(before)) return '氣體常數 R';
    if (gasLawLike && /\\dfrac\{[^{}]+\}\{[^{}]*\\times\s*$/.test(before)) return '絕對溫度，須用 K';
    if (cleanValue === '1' && /\\dfrac\{\s*$/.test(before)) return '倒數關係的分子';
    if (/\\dfrac\{\s*1\s*\}\{\s*$/.test(before)) return '倒數關係的分母';
    if (/\\dfrac\{\s*$/.test(before) && /K_c|Kp|Q_c|Qp|平衡/.test(ctx)) return '平衡常數式的分子項';
    if (/\\dfrac\{[^{}]+\}\{\s*$/.test(before) && /K_c|Kp|Q_c|Qp|平衡/.test(ctx)) return '平衡常數式的分母項';
    if (/\\dfrac\{\s*$/.test(before) && /Ksp|溶解度|沉澱/.test(ctx)) return '溶解度積關係中的分子';
    if (/\\dfrac\{[^{}]+\}\{\s*$/.test(before) && /Ksp|溶解度|沉澱/.test(ctx)) return '溶解度積關係中的分母';
    if (/\\dfrac\{\s*$/.test(before) && /產率|收率|理論產量/.test(ctx)) return '實際產量';
    if (/\\dfrac\{[^{}]+\}\{\s*$/.test(before) && /產率|收率|理論產量/.test(ctx)) return '理論產量';
    if (isDilutionExpression(source, state) && /\\dfrac\{\s*$/.test(before)) {
      const species = dilutionSpecies(state, source, offset);
      return species ? `取用的 ${species} 溶液體積` : '取用原溶液體積';
    }
    if (isDilutionExpression(source, state) && /\\dfrac\{[^{}]+\}\{\s*$/.test(before)) return '混合後總體積';
    if (/\\dfrac\{\s*$/.test(before)) return '比例或分式中的分子';
    if (/\\dfrac\{[^{}]+\}\{\s*$/.test(before)) return '比例或分式中的分母';
    if (lastValue && /[=＝]/.test(before)) return '此步計算結果';
    if (/\\times\s*$/.test(before) || /^\s*\\times/.test(after)) return '相乘的代入數值';
    if (/速率|rate|反應時間|時間比/.test(ctx)) {
      if (/^\s*[\/)]/.test(after) || /\/\s*$/.test(before)) return '速率比用時間倒數表示';
      return '反應時間或速率比較用數值';
    }
    if (/級數|反應級數|2\^\{?n|n\s*=/.test(ctx)) return '用速率倍數判斷反應級數';
    if (/濃度比|倍|變為|稀釋|混合/.test(ctx)) return '濃度比或稀釋倍數';
    if (/滴定|中和|當量點|酸鹼中和/.test(ctx)) return '酸鹼中和的莫耳數或濃度代入值';
    if (/pH|pOH|\[H|H\+|OH-|水解/.test(ctx)) return '酸鹼計算中的氫離子或氫氧根關係';
    if (/Ka|Kb|pKa|pKb|弱酸|弱鹼|緩衝/.test(ctx)) return '弱酸弱鹼平衡中的代入值';
    if (/K_c|Kp|Q_c|Qp|平衡|解離|ICE|勒沙特列/.test(ctx)) return '化學平衡計算中的代入值';
    if (/氧化|還原|電子|電荷|Faraday|法拉第|電解|氧化數/.test(ctx)) return '氧化還原或電量計算中的代入值';
    if (/電池|電位|E\^|Nernst|能斯特|陰極|陽極/.test(ctx)) return '電化學電位或電子轉移用數值';
    if (/焓|熵|自由能|ΔH|Delta H|kJ|熱化學|放熱|吸熱/.test(ctx)) return '熱化學能量變化的代入值';
    if (/莫耳比|係數比|配平|反應式/.test(ctx)) return '配平方程式的莫耳比';
    if (/氣體|分壓|PV|nRT|體積比/.test(ctx)) return '氣體定律中的比例或代入值';
    if (/溶解度|Ksp|沉澱|飽和/.test(ctx)) return '溶解度或沉澱判斷用數值';
    if (/沸點|凝固點|滲透壓|依數性質/.test(ctx)) return '依數性質計算中的代入值';
    if (/半衰期|衰變|放射性|一級反應/.test(ctx)) return '一級反應或半衰期計算用數值';
    if (/產率|收率|百分產率|理論產量/.test(ctx)) return '產率計算中的實際量或理論量';
    if (/百分濃度|重量百分|質量百分|ppm|ppb/.test(ctx)) return '溶液組成或濃度換算用數值';
    if (/有機|同分異構|官能基|烷|烯|炔|醇|醛|酮|酸|酯/.test(ctx)) return '有機結構或官能基判斷用數值';
    if (/週期表|原子半徑|游離能|電負度|價電子|主族/.test(ctx)) return '週期性質判斷用數值';
    if (/^\d+$/.test(cleanValue) && Number(cleanValue) <= 12 && /\\ce\{|[A-Z][a-z]?\d*|反應式/.test(ctx)) return '化學式或反應式中的係數';
    if (/^\d+$/.test(cleanValue) && Number(cleanValue) <= 20) return '題目中的比例或倍數';
    return '題目給定數值';
  }

  function annotateBareNumbers(source, state = {}) {
    const protectedParts = [];
    const protect = (value) => {
      const key = `\uE300${'x'.repeat(protectedParts.length + 1)}\uE301`;
      protectedParts.push(value);
      return key;
    };
    let body = source
      .replace(/\\htmlData\{[^{}]*\}\{(?:[^{}]|\{[^{}]*\})*\}/g, protect)
      .replace(/\bp?K_\{(?:sp|[abcwp])\d*\}/g, protect)
      .replace(/\\(?:ce|mathrm|text)\{(?:[^{}]|\{[^{}]*\})*\}(?:\^\{\d*[+-]\})?/g, protect);
    const number = /\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:\s*\\times\s*10\s*\^\s*\{[-+]?\d+\})?/gi;
    body = body.replace(number, (value, offset) => {
      const before = body.slice(0, offset);
      if (/[_^]\{?[-+]?\s*$/.test(before)) return value;
      const note = bareNumberNote(value, body, offset, state);
      return `\\htmlData{note=${note}}{${formatNumericLatex(value)}}`;
    });
    protectedParts.forEach((value, index) => {
      body = body.replace(`\uE300${'x'.repeat(index + 1)}\uE301`, value);
    });
    return body;
  }

  function protectLatexCommandGroups(source, commandRe, transform) {
    const protectedParts = [];
    const protect = (value) => {
      const key = `\uE400${'x'.repeat(protectedParts.length + 1)}\uE401`;
      protectedParts.push(value);
      return key;
    };
    const group = String.raw`\{(?:[^{}]|\{[^{}]*\})*\}`;
    let body = String(source || '').replace(new RegExp(String.raw`\\(?:${commandRe})${group}(?:${group})?`, 'g'), protect);
    body = transform(body);
    protectedParts.forEach((value, index) => {
      body = body.replace(`\uE400${'x'.repeat(index + 1)}\uE401`, value);
    });
    return body;
  }

  function preferDisplayFractions(source) {
    const units = String.raw`(?:g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C)`;
    const number = String.raw`\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:\s*\\times\s*10\s*\^\s*\{[-+]?\d+\})?(?:\s*${units})?`;
    const variable = String.raw`[A-Za-z](?:_\{[^{}]+\}|_\d+)?`;
    const noted = String.raw`\\htmlData\{[^{}]*\}\{(?:[^{}]|\{[^{}]*\})*\}`;
    const bracketed = String.raw`\[[^\]]+\]`;
    const bracketProduct = String.raw`${bracketed}(?:\s*(?:\\cdot\s*)?${bracketed})+`;
    const operand = String.raw`(?:${noted}|${bracketed}|${variable}|${number})`;
    const parenthesized = String.raw`\(([^(){}]+)\)`;
    const sideBoundary = String.raw`(?=$|[\s=+\-\\times\\div,，;；:：。)])`;

    return protectLatexCommandGroups(source, 'htmlData|ce|d?frac|text|mathrm', (body) => body
      .replace(new RegExp(String.raw`(${bracketProduct})\s*\/\s*(${bracketed})${sideBoundary}`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(String.raw`${parenthesized}\s*/\s*${parenthesized}`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(String.raw`${parenthesized}\s*/\s*(${operand})${sideBoundary}`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(String.raw`(^|[\s=+\-\\times\\div,(（])(${operand})\s*/\s*${parenthesized}`, 'g'), '$1\\dfrac{$2}{$3}')
      .replace(new RegExp(String.raw`(^|[\s=+\-\\times\\div,(（])(${operand})\s*/\s*(${operand})${sideBoundary}`, 'g'), '$1\\dfrac{$2}{$3}'));
  }

  function readBalancedGroup(source, openIndex) {
    if (source[openIndex] !== '{') return null;
    let depth = 0;
    for (let i = openIndex; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '\\') { i += 1; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return { body: source.slice(openIndex + 1, i), end: i + 1 };
      }
    }
    return null;
  }

  function readDfrac(source, index) {
    if (!source.startsWith('\\dfrac', index)) return null;
    const numerator = readBalancedGroup(source, index + 6);
    if (!numerator) return null;
    const denominator = readBalancedGroup(source, numerator.end);
    if (!denominator) return null;
    return { numerator: numerator.body, denominator: denominator.body, end: denominator.end };
  }

  function readLatexOperand(source, index) {
    const dfrac = readDfrac(source, index);
    if (dfrac) return { text: `\\dfrac{${dfrac.numerator}}{${dfrac.denominator}}`, end: dfrac.end };
    if (source.startsWith('\\htmlData', index)) {
      const meta = readBalancedGroup(source, index + 9);
      if (!meta) return null;
      const value = readBalancedGroup(source, meta.end);
      if (!value) return null;
      return { text: source.slice(index, value.end), end: value.end };
    }
    const m = source.slice(index).match(/^(?:\[[^\]]+\]|[A-Za-z](?:_\{[^{}]+\}|_\d+)?|\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:\\times10\^\{[-+]?\d+\})?)/i);
    return m ? { text: m[0], end: index + m[0].length } : null;
  }

  function normalizeDisplayFractions(source) {
    let out = '';
    for (let i = 0; i < source.length;) {
      const first = readDfrac(source, i);
      if (!first) { out += source[i]; i += 1; continue; }
      let end = first.end;
      let rendered = `\\dfrac{${first.numerator}}{${first.denominator}}`;
      const slash = String(source || '').slice(end).match(/^\s*\/\s*/);
      if (slash) {
        const second = readLatexOperand(source, end + slash[0].length);
        if (second) {
          rendered = `\\dfrac{${rendered}}{${second.text}}`;
          end = second.end;
        }
      }
      const power = source.slice(end).match(/^\s*\^\s*(?:\{([^{}]+)\}|([A-Za-z0-9]+))/);
      if (power) {
        const exponent = power[1] || power[2];
        rendered = `\\left(${rendered}\\right)^{${exponent}}`;
        end += power[0].length;
      }
      out += rendered;
      i = end;
    }
    return out;
  }

  function calculation(value, state) {
    let body = clean(normalizeEquilibriumSymbols(normalizeChemMarkup(value))).replace(/^\$+|\$+$/g, '')
      .replace(/(\d+(?:\.\d+)?)\s*g\s*\/\s*mol(?:\s*\^\s*-?\s*1)?/gi, '$1 g mol^-1')
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/[×＊*]/g, '\\times ')
      .replace(/÷/g, '\\div ')
      .replace(/≈/g, '\\approx ')
      .replace(/\b(log|ln)\s*(?=\()/g, '\\$1')
      .replace(/→/g, '\\rightarrow ')
      .replace(/\\frac\b/g, '\\dfrac')
      .replace(/\\,/g, ' ')
      .replace(/\\(?:mathrm|text)\{\s*([^{}]+)\s*\}/g, '$1')
      .replace(/\^\s*(-?\d+)(?![}\d])/g, '^{$1}')
      .replace(/\\?(log|ln)\s*\(\s*([^()]+)\s*\/\s*([^()]+)\s*\)/g, '\\$1\\left(\\dfrac{$2}{$3}\\right)')
      .replace(/\(\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\)/g, '\\dfrac{$1}{$2}')
      .replace(/\(\s*([^()]+)\s*\)\s*\/\s*(\d+(?:\.\d+)?(?:\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C))?)/gi, '\\dfrac{$1}{$2}')
      .replace(/(\d+(?:\.\d+)?(?:\s*g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C))?)\s*\/\s*(\d+(?:\.\d+)?(?:\s*g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C))?)/gi, '\\dfrac{$1}{$2}')
      .replace(/\b([tv])_(\d+)\b/g, '$1_{$2}')
      .replace(/\b([tv])(\d+)\b/g, '$1_{$2}')
      .replace(/\b([tv](?:_\{\d+\})?)\s*\/\s*([tv](?:_\{\d+\})?)/g, '\\dfrac{$1}{$2}');
    const autoNote = !state || state.autoNote !== false;
    body = preferDisplayFractions(body);
    body = body.replace(/\\ce\{([^{}]+)\}/g, (whole, token) => `\\ce{${normalizeChemToken(token)}}`);
    body = body.replace(/n\s*\(\s*([^()]+)\s*\)/g, (whole, token) => {
      const acid = abstractAcidLatex(token);
      return acid ? `n_{${acid}}` : (isChemicalToken(token) ? `n_{\\ce{${normalizeChemToken(token)}}}` : whole);
    });
    body = body.replace(/n_\{([^{}]+)\}/g, (whole, token) => {
      const acid = abstractAcidLatex(token);
      return acid ? `n_{${acid}}` : (isChemicalToken(token) ? `n_{\\ce{${normalizeChemToken(token)}}}` : whole);
    });
    body = body.replace(/\[([^\]]+)\]/g, (whole, token) => {
      const acid = abstractAcidLatex(token);
      return acid ? `[${acid}]` : (!/\\ce\{/.test(token) && isChemicalToken(token) ? `[\\ce{${normalizeChemToken(token)}}]` : whole);
    });
    body = protectLatexCommandGroups(body, 'htmlData|ce|d?frac|text|mathrm', (plain) => plain.replace(
      /(^|[^A-Za-z\\])((?:H\d*A|HA)(?:\^?\{?\d*[+\-−⁻]\}?)?|A(?:\^?\{?\d+[+\-−⁻]\}?|[+\-−⁻]))(?=$|[^A-Za-z])/g,
      (whole, prefix, token) => {
        const acid = abstractAcidLatex(token);
        return acid ? prefix + acid : whole;
      }
    ));
    if (autoNote) body = annotateQuantities(body, state);
    if (autoNote) body = body.replace(/=\s*(\d+)\s*\\times(?=\s*n_)/g, '=\\htmlData{note=反應係數比}{$1}\\times');
    if (autoNote) body = annotateBareNumbers(body, state);
    body = preferDisplayFractions(body);
    body = normalizeDisplayFractions(body);
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

  function reactionTable(block, fallbackEquation = '', opts = {}) {
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
    const noteState = { mCount: 0, volumeCount: 0, autoNote: opts.autoNote !== false };
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

  function compile(doc, opts = {}) {
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
        const noteState = { mCount: 0, volumeCount: 0, autoNote: opts.autoNote !== false };
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
        const noteState = { mCount: 0, volumeCount: 0, autoNote: opts.autoNote !== false };
        splitCalculation(expression || clean(block.text)).forEach((part) => lines.push(math(calculation(part, noteState))));
      } else if (block.type === 'reaction_table') {
        const table = reactionTable(block, latestEquation, opts);
        if (table) lines.push(table);
        else {
          const text = formatText(block.text, { mCount: 0, volumeCount: 0, autoNote: opts.autoNote !== false });
          if (text) lines.push(text);
        }
      } else {
        const noteState = { mCount: 0, volumeCount: 0, autoNote: opts.autoNote !== false };
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

  function prepare(raw, opts = {}) {
    const document = normalizeDocument(parse(raw));
    const text = compile(document, opts);
    return text
      ? { ok: true, text, document, fallback: false }
      : { ok: false, text: String(raw || '').trim(), document: null, fallback: true };
  }

  global.SolutionCore = Object.freeze({ SCHEMA, SYSTEM, buildSystem, parse, normalizeDocument, fullwidth, formatText, calculation, compile, prepare });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SolutionCore;
})(typeof window !== 'undefined' ? window : globalThis);
