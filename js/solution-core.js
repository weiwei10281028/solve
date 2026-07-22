/* 單一詳解核心：Gemini 只交付內容區塊，顯示語法由本機編譯。 */
(function (global) {
  'use strict';

  const BLOCK_TYPES = ['heading', 'paragraph', 'chemical_equation', 'calculation', 'reaction_table', 'choice'];
  const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
  const CHEM_CANDIDATE = /(^|[^A-Za-z\\])((?:[A-Z][a-z]?\d*){1,6}(?:\((?:[A-Z][a-z]?\d*)+\)\d*)?(?:\^?\{?\d*[+-]\}?)?)(?=$|[^A-Za-z])/g;
  const STRUCTURE_NARRATIVE = /混成|鍵角|孤對電子|π\s*鍵|共振|路易斯|價電子|VSEPR|分子形狀|平面三角|直線型|四面體|三角錐/;
  const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['blocks', 'answer'],
    properties: {
      blocks: {
        type: 'array', minItems: 1, maxItems: 32,
        items: {
          type: 'object', required: ['type', 'text'],
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: BLOCK_TYPES },
            text: { type: 'string' }
          }
        }
      },
      answer: { type: 'string' }
    }
  };

  // 唯一的化學計算符號規範：其他提示詞不得自行定義 n、W、V 或濃度的寫法。
  const QUANTITY_NOTATION = Object.freeze({
    amount: 'n',
    mass: 'W',
    volume: 'V'
  });
  const QUANTITY_NOTATION_PROMPT = `【化學量與濃度符號｜唯一規範】
莫耳數寫 n(物質)，質量寫 W(物質)，體積寫 V(對象)；括號內必須寫物質、元素、樣品、氣體或溶液名稱。不可只寫 n、W、V，也不可用 m 表示質量。溶液濃度一律寫 [物種]，不可用 C(物種)、c(物種) 或 C1V1。例：n(CO2)、W(O)、W(樣品)、V(甲溶液)、[IO3-]。莫耳關係寫 n(X) = [X] * V；濃度關係寫 [X] = frac(n(X))(V)。科學符號的下標與次方必須明確寫成 N_A、m^2、cm^3；數值與單位之間留一個半形空格，如 300 DU、3.0 cm、22.4 L mol^-1。`;

  function buildQuantityNotationPrompt(_mode) {
    return QUANTITY_NOTATION_PROMPT;
  }

  const SYSTEM_CORE = `你是台灣高中化學老師。使用繁體中文，依題目正確、清楚地解題。
只回傳指定 JSON；不得輸出 Markdown、HTML、$、$$、LaTeX 或其他排版指令。公式與化學式寫在 block 的 text 字串內。
${QUANTITY_NOTATION_PROMPT}
每個 block 只有 type 與 text，整題最多 32 個 block。heading 是固定架構，且只可為「題意、依據與推導、結果、選項分析」；第一個 heading 必須是「題意」，不得在它前面加入題號、題名、章節或類別。paragraph 是說明；chemical_equation 是反應式；calculation 是一條算式；reaction_table 依序寫物種、起始、變化、結果；choice 以題目原標籤開頭並判定正誤。
【先列必要方程式與計算｜必須遵守】題幹、判斷或結果需要完整化學反應式時，先以一個獨立 chemical_equation block 寫出完整反應物、箭頭與產物；不得把箭頭反應式塞入 paragraph 或 choice，也不得拆開同一反應式。題目提到、要求或必須用到某物種的濃度時，必須先以 calculation 寫出 [物種] = frac(n(物種))(V) 的代入與數值結果；不得只寫「計算濃度」或只重述濃度資料。之後才用 paragraph 說明該反應式或濃度如何用於判斷。
【詳解架構｜必須遵守】
題意：只寫本題要判斷或求出的核心問題；不重述題幹資料、方法或所有選項，限一句且不超過 30 個中文字。
依據與推導：只寫導出本題結果所必需的化學判準、比較與算式，優先 2～3 個圓點。每個 paragraph 必須以「• 」起首，且一個「• 」只代表一項獨立結論；每點只寫一個短句，不重述題幹、算式或已列反應式。比較題優先直接列倍率或比值；可相消的相同量不逐一計算。paragraph 只能陳述已知事實、已得結果或化學判斷，禁止以「先計算、計算、求出、代入」描述解題動作；若需計算，圓點改寫為「由……得……」，並在同段後緊接 calculation，不得只宣告要計算。非決定答案的機制背景、重複反應式與重複結論一律省略；同段的 calculation 或 chemical_equation 緊接在該段後且不再加圓點。算式一式一行。
結果：整理可直接用於判斷選項的結論；一項結論不用編號，互不相同的多項結論才以 1、2、整理。
選項分析：選擇題逐項依據前述結果判定；每項只寫決定正誤的必要理由，不重複整段推導，不得漏掉或增加選項。answer 只寫最終答案。
【文字與算式分工｜必須遵守】paragraph、choice 與 chemical_equation 的化學式與離子可用一般文字或直接 AsciiMath（例：H3PO4、H3O+、CH3COOH）。化學反應式使用 chemical_equation；分式、不等式與數學等式才獨立為 calculation。不得在學生詳解提及類別卡、通則卡或系統條件。科學符號可保留明確的 _ 與 ^，如 N_A、m^2、cm^3。`;

  const SYSTEM_CALC = `【算式｜必須遵守】
一個 calculation 是同一推理目的的一條完整等號鏈；說明用 paragraph。能直接比較的量以同一比值或倍率式呈現，不另列可相消的中間量；由濃度倍率求反應級數時，同一條 calculation 必須同時包含速率比、濃度倍率的未知數次方與求得的指數結論，不得只寫速率比後以文字宣布級數。反應式各自一個 chemical_equation，且每個 block 只放一條完整橫式；可逆寫 <->。數字與單位之間不可用逗號，只可空格或緊貼。禁止 calculation 只輸出單一數字；算式一式一行。`;

  const ASCIIMATH_OUTPUT_RULES = `【輸出格式】
所有公式一律直接使用 AsciiMath，不使用 LaTeX、KaTeX、mhchem、Markdown、反引號、$、$$、[[...]]、HTML 或其他包裝格式。下標用 _、次方用 ^、根號用 sqrt(...)、分式用 frac(分子)(分母)，箭頭用 -> 或 <->。例如 chemical_equation：Fe_xO_y + y CO -> x Fe + y CO_2；calculation：n(Fe) = frac(3.92)(56) = 0.07 mol。paragraph 與 choice 可自然混用中文及必要的 AsciiMath。`;

  const SYSTEM = SYSTEM_CORE + SYSTEM_CALC + ASCIIMATH_OUTPUT_RULES;

  function buildSystem() { return SYSTEM; }

  /** 供答案比對與 API 記錄使用的純文字摘要；視覺排版只由 ascii-solution-render.js 負責。 */
  function compilePlainDocument(doc) {
    if (!doc || !Array.isArray(doc.blocks)) return '';
    const lines = [];
    doc.blocks.forEach((block) => {
      if (!block || !block.type) return;
      if (block.type === 'heading') lines.push(`// ${clean(block.text)}`);
      else if (block.type === 'choice') lines.push(`(${clean(block.label)}) ${clean(block.text)}`);
      else if (block.type === 'reaction_table') lines.push(clean(block.text));
      else lines.push(clean(block.expression || block.text));
    });
    if (clean(doc.answer)) lines.push(`@@ANSWER@@${answerText(doc.answer)}`);
    return lines.filter(Boolean).join('\n');
  }

  /**
   * JSON／API 解析會把 \times 的 \t 吃成 tab，畫面變「imes」。
   * 此函式作用於「已解析的字串內容」（不是 JSON 原文）。
   */
  function restoreEatenLatexCommands(value) {
    let s = String(value || '');
    // \times 被 JSON 吃成 tab+imes；用 split 還原，且不可再把「\times 裡的 imes」重寫一次
    s = s.split(String.fromCharCode(9) + 'imes').join('\\times');
    s = s.split(String.fromCharCode(9) + 'Imes').join('\\times');
    s = s.split(String.fromCharCode(9) + 'ext{').join('\\text{');
    // \frac / \fallingdotseq 的 \f 被 JSON 吃成 form feed
    s = s.split(String.fromCharCode(12) + 'rac{').join('\\frac{');
    s = s.split(String.fromCharCode(12) + 'allingdotseq').join('\\approx');
    s = s.replace(/\ballingdotseq\b/g, '\\approx');
    s = s.replace(/\\fallingdotseq\b/g, '\\approx');
    s = s.replace(/\r(?=mmathrm|mathrm|ightarrow|ight\b)/g, '\\r');
    // 模型常把攝氏寫成不存在的 \textdegreeC；統一成一般字元，
    // 後續若在 calculation 會自然進入數學渲染，若在敘述也不會裸露指令。
    s = s.replace(/\\textdegree\s*(?:\{\s*\})?\s*([CFK])?\b/gi, (_, unit) => `°${unit || ''}`);
    s = s.replace(/\\Delta\b/g, 'Δ');
    // 僅補「單位後殘字」Mimes0.02，禁止匹配 \times 內部的 imes
    s = s.replace(/([MLKg}])imes(?=\d)/g, '$1\\times');
    s = s.replace(/(^|[^\\A-Za-z])imes(?=\d)/g, '$1\\times');
    s = s.replace(/×/g, '\\times ');
    s = s.replace(/÷/g, '\\div ');
    s = s.replace(/≈/g, '\\approx ');
    return s;
  }

  /** 作用於 API 回傳的 JSON 原文：tab+imes 要寫成 \\times 才能被 JSON.parse 成 \times。 */
  function restoreEatenLatexInJsonSource(value) {
    let s = String(value || '');
    s = s.split(String.fromCharCode(9) + 'imes').join('\\\\times');
    s = s.split(String.fromCharCode(9) + 'Imes').join('\\\\times');
    s = s.split(String.fromCharCode(9) + 'ext{').join('\\\\text{');
    s = s.split(String.fromCharCode(12) + 'rac{').join('\\\\frac{');
    s = s.split(String.fromCharCode(12) + 'allingdotseq').join('\\\\approx');
    s = s.replace(/\ballingdotseq\b/g, '\\\\approx');
    s = s.replace(/([MLKg}])imes(?=\d)/g, '$1\\\\times');
    s = s.replace(/(^|[^\\A-Za-z])imes(?=\d)/g, '$1\\\\times');
    return s;
  }

  function deepRestoreLatex(value) {
    if (typeof value === 'string') return restoreEatenLatexCommands(value);
    if (Array.isArray(value)) return value.map(deepRestoreLatex);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((key) => { out[key] = deepRestoreLatex(value[key]); });
      return out;
    }
    return value;
  }

  function escapeLatexBackslashesForJson(text) {
    let repaired = '';
    let inString = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        const escaped = countTrailingEscapes(text, i - 1) % 2 === 1;
        if (!escaped) inString = !inString;
      }
      if (inString && char === '\\') {
        const next = text[i + 1] || '';
        const jsonEscape = /["\\/bfnrt]/.test(next) && !(/[bfnrt]/.test(next) && /[A-Za-z]/.test(text[i + 2] || ''));
        const unicodeEscape = next === 'u' && /^[0-9a-f]{4}$/i.test(text.slice(i + 2, i + 6));
        if (!jsonEscape && !unicodeEscape) repaired += '\\';
      }
      repaired += char;
    }
    return repaired;
  }

  function countTrailingEscapes(text, index) {
    let n = 0;
    for (let i = index; i >= 0 && text[i] === '\\'; i -= 1) n += 1;
    return n;
  }

  /** 補齊被截斷的 JSON：關閉字串與括號，並去掉殘缺的最後一個欄位。 */
  function closeTruncatedJson(text) {
    let s = String(text || '');
    let inString = false;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '"' && countTrailingEscapes(s, i - 1) % 2 === 0) inString = !inString;
    }
    if (inString) s += '"';
    // 去掉截斷造成的殘缺屬性：,"ans 或 ,"answer":"A 或 ,"text":"…
    s = s
      .replace(/,\s*"[^"]*"\s*:\s*"[^"]*"?\s*$/g, '')
      .replace(/,\s*"[^"]*"\s*:\s*$/g, '')
      .replace(/,\s*"[^"]*"?\s*$/g, '');
    const stack = [];
    inString = false;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === '"' && countTrailingEscapes(s, i - 1) % 2 === 0) {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        if (stack.length) stack.pop();
      }
    }
    while (stack.length) s += stack.pop() === '{' ? '}' : ']';
    return s;
  }

  function tryParseJsonText(text) {
    const attempts = [
      text,
      escapeLatexBackslashesForJson(text),
      closeTruncatedJson(text),
      closeTruncatedJson(escapeLatexBackslashesForJson(text))
    ];
    for (const candidate of attempts) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (_) { /* next */ }
    }
    return null;
  }

  function parse(raw) {
    if (raw && typeof raw === 'object') return deepRestoreLatex(raw);
    let text = restoreEatenLatexInJsonSource(String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''));
    const first = text.indexOf('{');
    if (first < 0) return null;
    text = text.slice(first);
    const parsed = tryParseJsonText(text);
    return parsed ? deepRestoreLatex(parsed) : null;
  }

  function clean(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }

  function stripHtmlData(source) {
    let text = String(source || '');
    for (let pass = 0; pass < 8 && /\\htmlData\b/i.test(text); pass += 1) {
      let out = '';
      let index = 0;
      while (index < text.length) {
        const start = text.indexOf('\\htmlData', index);
        if (start < 0) { out += text.slice(index); break; }
        out += text.slice(index, start);
        const metaOpen = text.indexOf('{', start + 9);
        if (metaOpen < 0 || metaOpen > start + 12) {
          index = start + 9;
          continue;
        }
        const meta = readBalancedGroup(text, metaOpen);
        if (!meta) {
          const close = text.indexOf('}', metaOpen + 1);
          index = close >= 0 ? close + 1 : text.length;
          continue;
        }
        if (text[meta.end] !== '{') { index = meta.end; continue; }
        const body = readBalancedGroup(text, meta.end);
        if (!body) {
          out += text.slice(meta.end + 1);
          index = text.length;
          continue;
        }
        out += body.body;
        index = body.end;
      }
      if (out === text) break;
      text = out;
    }
    return text
      .replace(/\\?htmlData(?:\{[^{}]*\})?/gi, '')
      .replace(/\bhtmlDatanot\b/gi, '');
  }

  function stripQuantityCommas(value) {
    return String(value || '')
      .replace(/(\d+(?:\.\d+)?)[\s\u00a0\u3000]*[,，、][\s\u00a0\u3000\r\n]*(mmol|mol|mL|mg|kg|atm|kPa|Pa|min|h|A|C|M|L|g|s)\b/g, '$1 $2')
      .replace(/(\d+(?:\.\d+)?)[\s\u00a0\u3000]+(mmol|mol|mL|mg|kg|atm|kPa|Pa|min|h|A|C|M|L|g|s)\b/g, '$1 $2');
  }

  function fullwidth(value) {
    return stripQuantityCommas(clean(value))
      .replace(/\.{3,}/g, '……')
      .replace(/[，,]\s*[；;]/g, '；').replace(/[；;]\s*[，,]/g, '；')
      .replace(/,/g, '，').replace(/;/g, '；').replace(/:/g, '：')
      .replace(/\?/g, '？').replace(/!/g, '！')
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
      .replace(/\\leftrightarrow|\\rightleftharpoons/g, '⇌')
      .replace(/↔|<->/g, '⇌')
      .replace(/\bpK\s*_?\s*(?:\{\s*)?(\d+)\s*\}?/g, 'pK_{a$1}')
      // 不可吞掉後面的 }（否則 \dfrac{K_w}{K_a} 會被拆壞）
      .replace(/\b(p?K)_?(sp|[abcwp])(\d*)\b/g,
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
    const keep = (value) => {
      const key = `\uE200${'x'.repeat(stash.length + 1)}\uE201`;
      stash.push(value);
      return key;
    };
    let text = stripHtmlData(clean(normalizeEquilibriumSymbols(normalizeChemMarkup(restoreEatenLatexCommands(value)))));
    text = normalizeConcentrationNotation(text);
    text = stripQuantityCommas(text);
    text = text.replace(/\$([^$]+)\$/g, (whole, body) => {
      let latex = normalizeEquilibriumSymbols(normalizeChemMarkup(body)).trim();
      latex = stripQuantityCommas(latex);
      const ce = latex.match(/^\\ce\{([^{}]+)\}$/);
      if (ce) return keep(chemistry(ce[1]));
      const acid = abstractAcidLatex(latex);
      if (acid) return keep(math(acid));
      if (isChemicalToken(latex)) return keep(chemistry(latex));
      if (/[=≈]|(?:mol|mL|L|M|mg|kg|atm|kPa|Pa)\b/i.test(latex)) return keep(math(calculation(latex, state)));
      return keep(math(latex));
    })
      // 敘述文字中的化學量也必須顯示下標；唯一轉換規則仍由
      // normalizeQuantityNotation() 提供，避免 paragraph／choice 另有一套寫法。
      .replace(/\b([nWV]|m)\s*[（(]\s*([^()（）]+)\s*[）)]/g, (whole) =>
        keep(math(normalizeQuantityNotation(whole))))
      .replace(/\\ce\s*\{([^{}]+)\}/g, (_, token) => keep(chemistry(token)))
      .replace(/\[([^\]]+)\]/g, (whole, token) => {
        const acid = abstractAcidLatex(token);
        if (acid) return keep(math(`[${acid}]`));
        return isChemicalToken(token) ? keep(math(`[\\ce{${normalizeChemToken(token)}}]`)) : whole;
      })
      .replace(/\bp?K_\{(?:sp|[abcwp])\d*\}/g, (symbol) => keep(math(symbol)))
      .replace(/(^|[^A-Za-z\\])((?:H\d*A|HA)(?:\^?\{?\d*[+\-−⁻]\}?)?|A(?:\^?\{?\d+[+\-−⁻]\}?|[+\-−⁻]))(?=$|[^A-Za-z])/g, (whole, prefix, token) => {
        const latex = abstractAcidLatex(token);
        return latex ? prefix + keep(math(latex)) : whole;
      })
      .replace(CHEM_CANDIDATE, (whole, prefix, token) => (
        isChemicalToken(token) ? prefix + keep(chemistry(token)) : whole
      ));
    // 裸數字、科學記號保留給 AsciiMath 詳解 renderer 處理。
    text = fullwidth(text);
    stash.forEach((item, index) => { text = text.replace(`\uE200${'x'.repeat(index + 1)}\uE201`, item); });
    return repairInlineSlashFractions(text);
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
          lines.push(prose.trim());
          prose = '';
        }
        lines.push(part.trim());
      });
      if (prose.trim()) lines.push(prose.trim());
    });
    return lines;
  }

  function formatNarrativeLine(value, state) {
    const source = clean(normalizeEquilibriumSymbols(normalizeChemMarkup(value)));
    if (STRUCTURE_NARRATIVE.test(source)) return [formatText(source, state)];
    if (/->|→|\\rightarrow|<=>|⇌/.test(source)) {
      const terminal = (source.match(/[，。；：？！]+$/) || [''])[0];
      const body = terminal ? source.slice(0, -terminal.length) : source;
      const colon = Math.max(body.lastIndexOf('：'), body.lastIndexOf(':'));
      const prefix = colon >= 0 ? body.slice(0, colon + 1) : '';
      const equations = splitChemicalEquations(body.slice(colon + 1));
      if (prefix && equations.length === 1) {
        return [`${formatText(prefix, state)}${chemistry(equations[0])}${fullwidth(terminal)}`];
      }
      const lines = [];
      if (prefix) lines.push(formatText(prefix, state));
      equations.forEach((equation, index) => {
        const suffix = index === equations.length - 1 ? fullwidth(terminal) : '';
        const rendered = chemistry(equation);
        if (rendered) lines.push(`${rendered}${suffix}`);
      });
      return lines.filter(Boolean);
    }
    if (/\$[^$]+\$/.test(source)) {
      const tokens = source.split(/(\$[^$]+\$)/).filter((part) => part !== '');
      const calcCount = tokens.filter((part) => /^\$/.test(part) && /[=≈]/.test(part)).length;
      if (calcCount >= 2) {
        const lines = [];
        let prose = '';
        tokens.forEach((token) => {
          if (/^\$/.test(token) && /[=≈]/.test(token)) {
            if (prose.trim()) {
              lines.push(formatText(prose, state));
              prose = '';
            }
            const inner = token.replace(/^\$|\$$/g, '');
            splitCalculation(inner).forEach((part) => {
              const rendered = math(calculation(part, state));
              if (rendered) lines.push(rendered);
            });
          } else {
            prose += token;
          }
        });
        if (prose.trim()) lines.push(formatText(prose, state));
        return lines.filter(Boolean);
      }
      return [formatText(source, state)];
    }
    if (!/[=＝]/.test(source)) return [formatText(source, state)];
    const candidates = [
      source.search(/\[[^\]]+\]\s*(?:[=＝/×＊÷*+\-])/),
      source.search(/\b(?:p?K_\{(?:sp|[abcwp])\d*\}|pH)\s*[=＝]/),
      source.search(/\b(?:m|n)\s*(?:_\{|\(|_)/i),
      // 次方式（x^2、10^-5 等）出現在敘述中 → 導入數學通道，避免上標破裂
      source.search(/[A-Za-z0-9]\s*\^\s*\{?[-+]?\d/),
      source.search(/\b(?:pH|[rvkmnxyCt])(?:_?\d+)?\s*(?:_[^=＝\s]+)?\s*(?:[=＝/×＊÷*])/i),
      // 5.20-1.28=3.92 這類加減乘除鏈，避免只抓到後面的 3.92/56
      // 運算子字元類把 - 放開頭，避免 *÷ 變成範圍誤含小數點
      source.search(/\d+(?:\.\d+)?\s*[-+−×＊÷*/]\s*\d+(?:\.\d+)?/),
      source.search(/\d+(?:\.\d+)?(?:\s*[A-Za-z]+(?:\s*\^?\s*-?\d+)?)?\s*(?:[/×＊÷*]|\^\s*\d+\s*[=＝])/),
      source.search(/\d+(?:\.\d+)?(?:\s*(?:g|mol|mL|L|M))?\s*[=＝]/)
    ].filter((index) => index >= 0);
    if (!candidates.length) return [formatText(source, state)];
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
    const chineseTail = tail.search(/[\u4e00-\u9fff]/);
    if (chineseTail > 0) end = Math.min(end, start + chineseTail);
    const punctuation = source.slice(end);
    const calcState = Object.assign({}, state, {
      narrativePrefix: source.slice(0, start),
      narrativeLine: source
    });
    const calcParts = splitCalculation(source.slice(start, end));
    if (calcParts.length > 1) {
      const lines = [];
      const lead = formatText(source.slice(0, start), state);
      if (lead) lines.push(lead);
      calcParts.forEach((part, index) => {
        const suffix = index === calcParts.length - 1 ? formatText(punctuation, state) : '';
        const rendered = math(calculation(part, calcState));
        if (rendered) lines.push(`${rendered}${suffix}`);
      });
      return lines.filter(Boolean).flatMap((line) => breakAdjacentMathIslands(line).split('\n'));
    }
    return breakAdjacentMathIslands(`${formatText(source.slice(0, start), state)}${math(calculation(source.slice(start, end), calcState))}${formatText(punctuation, state)}`).split('\n').filter(Boolean);
  }

  function formatNarrative(value, state) {
    return splitNarrative(value)
      .flatMap((line) => formatNarrativeLine(line, state))
      .flatMap((line) => breakAdjacentMathIslands(repairInlineSlashFractions(line)).split('\n'))
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function normalizeChoice(block) {
    let label = clean(block?.label);
    let text = clean(block?.text);
    if (!label) {
      const prefixed = text.match(/^\s*(?:\(([^()\s]{1,16})\)|（([^（）\s]{1,16})）|\[([^\[\]\s]{1,16})\])\s*(.*)$/);
      if (prefixed) {
        label = clean(prefixed[1] || prefixed[2] || prefixed[3]);
        text = clean(prefixed[4]);
      }
    }
    if (!label || !text) return null;
    const verdict = clean(block?.verdict);
    if (verdict && !text.includes(verdict)) text = `${text.replace(/[，,；;：:]\s*$/, '')}，${verdict}`;
    return { label, text };
  }

  function choiceMarker(label, text) {
    return `@@CHOICE[${String(label).replace(/[\]\r\n]/g, '')}]@@ ${text}`;
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

  function auditRequiredSections(document) {
    const headings = (document?.blocks || [])
      .filter((block) => block?.type === 'heading')
      .map((block) => clean(block.text));
    const required = ['題意', '依據與推導', '結果'];
    const issues = required.filter((name) => !headings.includes(name)).map((name) => `缺少「${name}」`);
    const hasChoices = (document?.blocks || []).some((block) => block?.type === 'choice');
    if (hasChoices && !headings.includes('選項分析')) issues.push('選擇題缺少「選項分析」');
    return issues;
  }

  function math(value) {
    const body = clean(value).replace(/^\$+|\$+$/g, '').trim();
    return body ? `$${body}$` : '';
  }

  function chemistry(value) {
    let body = clean(normalizeChemMarkup(value)).replace(/^\\ce\s*\{?|\}$/g, '').trim()
      .replace(/⇌|↔|<->|\\leftrightarrow|\\rightleftharpoons/g, '<=>').replace(/→/g, '->').replace(/\\rightarrow/g, '->').replace(/\\to\b/g, '->');
    body = body.replace(CHEM_CANDIDATE, (whole, prefix, token) => prefix + (isChemicalToken(token) ? normalizeChemToken(token) : token));
    if (!body) return '';
    // mhchem <=> 會畫成過長雙箭頭；改拆成兩側 \\ce + 短字元 ⇌
    if (/\s*<=>\s*/.test(body)) {
      const sides = body.split(/\s*<=>\s*/).map((s) => s.trim()).filter(Boolean);
      if (sides.length >= 2) {
        return `$${sides.map((side) => `\\ce{${side}}`).join(' ⇌ ')}$`;
      }
    }
    return `$\\ce{${body}}$`;
  }

  /** 多條反應式黏在同一字串時拆開；每式之後各自成行。 */
  function isLikelyReactantSide(value) {
    const source = String(value || '').trim();
    if (!source || /->|<=>/.test(source)) return false;
    if (!/^[A-Z\\]/.test(source)) return false;
    let depth = 0;
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }

  function findNextReactionStart(mid) {
    let depth = 0;
    let best = -1;
    let bestScore = -1;
    for (let i = 1; i < mid.length; i += 1) {
      const ch = mid[i];
      if (ch === '(') { depth += 1; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
      if (depth !== 0 || !/[A-Z]/.test(ch)) continue;
      const prev = mid[i - 1];
      if (!(/\s/.test(prev) || /[0-9a-z)}]/.test(prev))) continue;
      const left = mid.slice(0, i).trim();
      const rest = mid.slice(i).trim();
      if (!left || !isLikelyReactantSide(rest)) continue;
      let score = 0;
      if (/\+/.test(rest)) score += 2;
      if (/\+/.test(left)) score += 2;
      if (/\s/.test(prev) || /[0-9)]/.test(prev)) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  function splitChemicalEquations(value) {
    const source = clean(value)
      .replace(/⇌|↔|<->|\\leftrightarrow|\\rightleftharpoons/g, '<=>')
      .replace(/→|\\rightarrow|\\to\b/g, '->');
    if (!source) return [];
    const arrows = [...source.matchAll(/->|<=>/g)];
    if (arrows.length < 2) return [source];
    const starts = [0];
    for (let index = 0; index < arrows.length - 1; index += 1) {
      const afterArrow = arrows[index].index + arrows[index][0].length;
      const beforeNext = arrows[index + 1].index;
      const mid = source.slice(afterArrow, beforeNext);
      const offset = findNextReactionStart(mid);
      if (offset < 0) return [source];
      starts.push(afterArrow + offset);
    }
    const parts = [];
    for (let index = 0; index < starts.length; index += 1) {
      const end = index + 1 < starts.length ? starts[index + 1] : source.length;
      const part = source.slice(starts[index], end).trim();
      if (part) parts.push(part);
    }
    return parts.length ? parts : [source];
  }

  function splitCalculation(value) {
    const parts = []; let start = 0; let depth = 0;
    // 先清掉內文 $，避免中途 $ 阻擋相鄰算式拆分
    const source = clean(String(value || '').replace(/\$+/g, ' '));
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth = Math.max(0, depth - 1);
      else if (!depth && /[,，;；]/.test(source[i])) { parts.push(source.slice(start, i)); start = i + 1; }
    }
    parts.push(source.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean).flatMap((part) => splitAdjacentAssignments(part));
  }

  /** 無標點卻緊接下一條算式時拆開，例如「=3.92g 3.92/56」「≈5.56e-10 [OH-]=」。 */
  function splitAdjacentAssignments(source) {
    const lhs = String.raw`(?:\[[^\]]+\]|\\(?:mathrm|text|ce)\{[^}]+\}|(?:m|n|M|N|C|V|pH|pOH|K))(?:_\{[^}]*\}|_[A-Za-z0-9]+|\([^)]*\))?`;
    const num = String.raw`\d+(?:\.\d+)?(?:e[-+]?\d+)?(?:\s*(?:\\times|[×x＊*])\s*10\s*\^\s*\{?[-+]?\d+\}?)?(?!\d)`;
    const unit = String.raw`(?:\s*(?:g\s*mol(?:\s*\^\s*\{?-?1\}?|-1)|mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h))?`;
    const op = String.raw`(?:[+\-−×＊*÷=＝]|\\times|\\div|\\dfrac|/)`;
    const opNoEq = String.raw`(?:[+\-−×＊*÷]|\\times|\\div|/)`;
    let text = restoreEatenLatexCommands(String(source || ''));
    text = stripQuantityCommas(text)
      .replace(/＝/g, '=')
      .replace(/\\fallingdotseq|≒|\\approx/g, '≈');
    // 約等鏈拆行：…≒ a ≒ b → 各成一段
    text = text.replace(
      new RegExp(String.raw`(≈\s*(?:\\dfrac\{[^{}]*\}\{[^{}]*\}|${num})${unit}(?:\s*\\times\s*(?:10\s*\^\s*\{[^}]+\}|${num}))*)\s*(?=≈)`, 'g'),
      '$1\u0001'
    );
    // 「=0.002 0.10…」等號結果後緊接下一個數字 → 新行（學生才看得懂）
    text = text.replace(
      new RegExp(String.raw`((?:=|≈)\s*${num}${unit})\s+(?=${num})`, 'g'),
      '$1\u0001'
    );
    text = text.replace(
      new RegExp(String.raw`((?:=|≈)\s*${num})\s*(?=${lhs}\s*[=≈])`, 'g'),
      '$1\u0001'
    );
    text = text.replace(
      new RegExp(String.raw`(${num})\s+(?=${lhs}\s*[=≈])`, 'g'),
      '$1\u0001'
    );
    text = text.replace(
      new RegExp(String.raw`((?:=|≈)\s*${num}${unit})\s*(?=${num}\s*${op})`, 'g'),
      '$1\u0001'
    );
    text = text.replace(
      new RegExp(String.raw`(${num}${unit})\s*(?=${num}\s*${opNoEq}\s*${num}\s*[=＝≈])`, 'g'),
      '$1\u0001'
    );
    text = text.replace(
      new RegExp(String.raw`((?:=|≈)\s*${num}${unit})(?=${num}\s*${op})`, 'g'),
      '$1\u0001'
    );
    text = text.replace(
      new RegExp(String.raw`(${num}${unit})\s*(?=${lhs}\s*[=≈])`, 'g'),
      '$1\u0001'
    );
    // 「≈ 5.56 × 10^{-10} [OH-]=…」數值後接下一個濃度／物種賦值
    text = text.replace(
      new RegExp(String.raw`((?:=|≈)\s*${num}${unit})\s*(?=${lhs}\s*[=≈])`, 'g'),
      '$1\u0001'
    );
    // 「0.0015 mol n_…=」「0.0005mol[」「…10^{-10} [OH-]=」
    text = text.replace(
      new RegExp(String.raw`(${num})\s*(mol|mL|L|M|g)?\s*(?=(?:n\s*[_(]|n_\{|\\ce\{|\[[A-Z]|K_\{?|Kb\b|pOH\b|pH\b))`, 'gi'),
      (_, n, u) => `${n}${u || ''}\u0001`
    );
    return text.split('\u0001').map((part) => part.trim()).filter(Boolean);
  }

  /** 相鄰的算式數學島拆成新行，避免 $a$$b$ 擠在同一段。 */
  function breakAdjacentMathIslands(value) {
    let text = String(value || '');
    for (let pass = 0; pass < 8; pass += 1) {
      const next = text.replace(/\$([^$]+)\$\s*\$([^$]+)\$/g, (whole, left, right) => {
        const calcish = (body) => /[=≈]|\\dfrac|\\times|\\div|\\rightarrow|->/.test(body);
        if (calcish(left) && calcish(right)) return `$${left}$\n$${right}$`;
        if (calcish(left) || calcish(right)) return `$${left}$；$${right}$`;
        return whole;
      });
      if (next === text) break;
      text = next;
    }
    return text;
  }

  /** 行內被拆成 $3$/$4$、$3$÷$4$ 或 $3$\div$4$ 時，強制併回直式分式。 */
  function repairInlineSlashFractions(value) {
    let text = String(value || '');
    const piece = String.raw`(?:\\(?:mathrm|text)\{[^{}]+\}|\d+(?:\.\d+)?(?:e[-+]?\d+)?)`;
    for (let pass = 0; pass < 6; pass += 1) {
      const next = text
        .replace(new RegExp(String.raw`\$?(${piece})\$?\s*(?:\/|÷|\\div)\s*\$?(${piece})\$?`, 'g'), (whole, a, b) => {
          if (/\\dfrac|\\ce|\\rightarrow/.test(whole)) return whole;
          const left = String(a).replace(/^\$|\$$/g, '');
          const right = String(b).replace(/^\$|\$$/g, '');
          if (!left || !right) return whole;
          return `$\\dfrac{${left}}{${right}}$`;
        });
      if (next === text) break;
      text = next;
    }
    return text.replace(/\$\$+/g, '$');
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
    const fraction = String.raw`\\dfrac\{[^{}]*\}\{[^{}]*\}`;
    const chemical = String.raw`\\ce\{[^{}]+\}`;
    const bracketed = String.raw`\[[^\]]+\]`;
    const bracketProduct = String.raw`${bracketed}(?:\s*(?:\\cdot\s*)?${bracketed})+`;
    const operand = String.raw`(?:${fraction}|${chemical}|${bracketed}|${variable}|${number})`;
    const parenthesized = String.raw`\(([^(){}]+)\)`;
    const division = String.raw`(?:/|\\div|÷)`;
    const sideBoundary = String.raw`(?=$|[\s=+\-\\times\\div,，;；:：。)])`;

    let body = protectLatexCommandGroups(source, 'ce|d?frac|text|mathrm|sqrt', (plain) => plain
      .replace(new RegExp(String.raw`(${bracketProduct})\s*${division}\s*(${bracketed})${sideBoundary}`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(String.raw`${parenthesized}\s*${division}\s*${parenthesized}`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(String.raw`${parenthesized}\s*${division}\s*(${operand})${sideBoundary}`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(String.raw`(^|[\s=+\-\\times\\div,(（])(${operand})\s*${division}\s*${parenthesized}`, 'g'), '$1\\dfrac{$2}{$3}')
      .replace(new RegExp(String.raw`(^|[\s=+\-\\times\\div,(（])(${operand})\s*${division}\s*(${operand})${sideBoundary}`, 'g'), '$1\\dfrac{$2}{$3}')
      // 殘留的純數字除式一律轉直式
      .replace(/(\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*(?:\/|\\div|÷)\s*(\d+(?:\.\d+)?(?:e[-+]?\d+)?)/g, '\\dfrac{$1}{$2}'));
    return body;
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

  /** \dfrac{複雜分子}{=} → \sqrt{分子}=（含巢狀分式；舊正則遇巢狀會失敗）。 */
  function repairDenomEqualsAsSqrt(source) {
    let out = '';
    const s = String(source || '');
    for (let i = 0; i < s.length;) {
      const d = readDfrac(s, i);
      if (!d) { out += s[i]; i += 1; continue; }
      const denom = String(d.denominator || '').replace(/\s+/g, '');
      if (denom === '=' || denom === '＝') {
        out += `\\sqrt{${d.numerator}}`;
        i = d.end;
        if (!/^\s*[=＝≈]/.test(s.slice(i)) && !/^\s*\\approx/.test(s.slice(i))) out += '=';
        continue;
      }
      if (denom === '\\approx' || denom === '≈') {
        out += `\\sqrt{${d.numerator}}`;
        i = d.end;
        if (!/^\s*[=＝≈]/.test(s.slice(i)) && !/^\s*\\approx/.test(s.slice(i))) out += '\\approx ';
        continue;
      }
      out += `\\dfrac{${d.numerator}}{${d.denominator}}`;
      i = d.end;
    }
    return out;
  }

  /** 步驟間漏等號：\dfrac{a}{b}\dfrac{c}{d}、\sqrt{a}\sqrt{b} → 補 = */
  function insertMissingStepEquals(source) {
    let s = String(source || '');
    for (let pass = 0; pass < 6; pass += 1) {
      let out = '';
      let i = 0;
      let changed = false;
      while (i < s.length) {
        if (s.startsWith('\\dfrac', i)) {
          const d = readDfrac(s, i);
          if (d) {
            out += `\\dfrac{${d.numerator}}{${d.denominator}}`;
            i = d.end;
            const sp = (s.slice(i).match(/^\s*/) || [''])[0].length;
            if (/^(\\dfrac|\\sqrt)/.test(s.slice(i + sp))) {
              out += '=';
              changed = true;
            }
            continue;
          }
        }
        if (s.startsWith('\\sqrt{', i)) {
          const g = readBalancedGroup(s, i + 5);
          if (g) {
            out += `\\sqrt{${g.body}}`;
            i = g.end;
            const sp = (s.slice(i).match(/^\s*/) || [''])[0].length;
            if (/^(\\dfrac|\\sqrt)/.test(s.slice(i + sp))) {
              out += '=';
              changed = true;
            }
            continue;
          }
        }
        out += s[i];
        i += 1;
      }
      s = out;
      if (!changed) break;
    }
    return s;
  }

  function readLatexOperand(source, index) {
    const dfrac = readDfrac(source, index);
    if (dfrac) return { text: `\\dfrac{${dfrac.numerator}}{${dfrac.denominator}}`, end: dfrac.end };
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
      const slash = String(source || '').slice(end).match(/^\s*(?:\/|\\div|÷)\s*/);
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

  /** 拆掉誤包根號等號鏈的 \dfrac{…}（無分母或括號未閉合）。 */
  function unwrapBogusSqrtDfrac(value) {
    let s = String(value || '');
    for (let guard = 0; guard < 8; guard += 1) {
      const at = s.indexOf('\\dfrac{');
      if (at < 0) break;
      const open = at + 6; // points at '{'
      let depth = 0;
      let close = -1;
      for (let j = open; j < s.length; j += 1) {
        if (s[j] === '{') depth += 1;
        else if (s[j] === '}') {
          depth -= 1;
          if (depth === 0) { close = j; break; }
        }
      }
      if (close < 0) {
        const rest = s.slice(open + 1);
        if (/\\sqrt/.test(rest) && /[=≈]/.test(rest)) {
          s = s.slice(0, at) + rest;
          continue;
        }
        break;
      }
      const inner = s.slice(open + 1, close);
      const hasDenom = /^\s*\{/.test(s.slice(close + 1));
      if (!hasDenom && /\\sqrt/.test(inner) && /[=≈]/.test(inner)) {
        s = s.slice(0, at) + inner + s.slice(close + 1);
        continue;
      }
      // 合法 dfrac：跳過此處繼續找下一個（用佔位避免死循環）
      s = `${s.slice(0, at)}\uE300${s.slice(at + 6)}`;
    }
    return s.replace(/\uE300/g, '\\dfrac');
  }

  /** calculation 薄層：還原被吃的 \\times、直式分式並清除內部 $。 */
  function calculation(value) {
    let body = stripHtmlData(clean(normalizeEquilibriumSymbols(normalizeChemMarkup(restoreEatenLatexCommands(value)))));
    body = normalizeConcentrationNotation(body);
    // 剝離內文 $，避免中途 $ 弄斷；外包由 math() 統一加一層
    body = body.replace(/\$+/g, '');
    body = stripQuantityCommas(body);
    body = body
      // 單位先標準化成 KaTeX 直立字與薄空白，避免 214gmol^-1 的 -1
      // 跟在分母基線上或與 mol 黏在一起。
      .replace(/(\d+(?:\.\d+)?)\s*g\s*(?:\/\s*mol|mol)(?:\s*\^\s*\{\s*-\s*1\s*\}|\s*\^\s*-\s*1|\s*-\s*1)/gi, '$1\\,\\mathrm{g\\,mol^{-1}}')
      .replace(/(\d+(?:\.\d+)?)\s*(mmol|mol|mL|mg|kg|atm|kPa|Pa|L|M|g)\b/g, '$1\\,\\mathrm{$2}')
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/[×＊*]/g, '\\times ')
      .replace(/÷/g, '\\div ')
      .replace(/≈/g, '\\approx ')
      .replace(/\ballingdotseq\b/g, '\\approx ')
      .replace(/\\fallingdotseq\b/g, '\\approx ')
      // 根號：√(x)、\sqrt(x)、\sqrt{(x)} → \sqrt{x}
      .replace(/√\s*\(\s*([^()]+)\s*\)/g, '\\sqrt{$1}')
      .replace(/\\sqrt\s*\{\(\s*([^()]+)\s*\)\}/g, '\\sqrt{$1}')
      .replace(/\\sqrt\s*\(\s*([^()]+)\s*\)/g, '\\sqrt{$1}')
      .replace(/(?<![A-Za-z\\])sqrt\s*\(\s*([^()]+)\s*\)/gi, '\\sqrt{$1}')
      .replace(/√\s*\{([^{}]+)\}/g, '\\sqrt{$1}')
      .replace(/\b(log|ln)\s*(?=\()/g, '\\$1')
      .replace(/→/g, '\\rightarrow ')
      .replace(/\\frac\b/g, '\\dfrac')
      .replace(/°\s*([CFK])\s*\^\s*\{?(-?\d+)\}?/g, '^{\\circ}\\mathrm{$1}^{$2}')
      .replace(/°\s*([CFK])\b/g, '^{\\circ}\\mathrm{$1}')
      .replace(/Δ/g, '\\Delta ')
      .replace(/\^\s*(-?\d+)(?![}\d])/g, '^{$1}')
      .replace(/\\?(log|ln)\s*\(\s*([^()]+)\s*\/\s*([^()]+)\s*\)/g, '\\$1\\left(\\dfrac{$2}{$3}\\right)')
      .replace(/\(\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\)/g, '\\dfrac{$1}{$2}')
      .replace(/\(\s*([^()]+)\s*\)\s*\/\s*(\d+(?:\.\d+)?(?:\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C))?)/gi, '\\dfrac{$1}{$2}')
      .replace(/(\d+(?:\.\d+)?(?:\s*g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C))?)\s*\/\s*(\d+(?:\.\d+)?(?:\s*g\s*mol\s*(?:\^\s*\{?\s*-?1\s*\}?|-1)|\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|A|C))?)/gi, '\\dfrac{$1}{$2}')
      .replace(/\b([tv])_(\d+)\b/g, '$1_{$2}')
      .replace(/\b([tv])(\d+)\b/g, '$1_{$2}')
      .replace(/\b([tv](?:_\{\d+\})?)\s*\/\s*([tv](?:_\{\d+\})?)/g, '\\dfrac{$1}{$2}');
    // AI 常把「根號等號鏈」誤包進 \dfrac（無分母或未閉合）→ 拆掉外殼
    body = unwrapBogusSqrtDfrac(body);
    body = preferDisplayFractions(body);
    // 僅正規化已有 \\ce；裸化學式交給 render
    body = body.replace(/\\ce\{([^{}]+)\}/g, (whole, token) => `\\ce{${normalizeChemToken(token)}}`);
    body = normalizeQuantityNotation(body);
    body = body.replace(/\[([^\]]+)\]/g, (whole, token) => {
      const acid = abstractAcidLatex(token);
      return acid ? `[${acid}]` : (!/\\ce\{/.test(token) && isChemicalToken(token) ? `[\\ce{${normalizeChemToken(token)}}]` : whole);
    });
    body = protectLatexCommandGroups(body, 'ce|d?frac|text|mathrm', (plain) => plain.replace(
      /(^|[^A-Za-z\\])((?:H\d*A|HA)(?:\^?\{?\d*[+\-−⁻]\}?)?|A(?:\^?\{?\d+[+\-−⁻]\}?|[+\-−⁻]))(?=$|[^A-Za-z])/g,
      (whole, prefix, token) => {
        const acid = abstractAcidLatex(token);
        return acid ? prefix + acid : whole;
      }
    ));
    body = preferDisplayFractions(body);
    body = normalizeDisplayFractions(body);
    body = repairDenomEqualsAsSqrt(body);
    body = insertMissingStepEquals(body);
    return body.replace(/[=＝]\s*$/, '').trim();
  }

  function quantitySubscript(symbol, token) {
    const subject = String(token || '').trim().replace(/^\{|\}$/g, '');
    if (!subject) return symbol;
    const acid = abstractAcidLatex(subject);
    if (acid) return `${symbol}_{${acid}}`;
    if (isChemicalToken(subject)) return `${symbol}_{\\ce{${normalizeChemToken(subject)}}}`;
    return `${symbol}_{\\text{${subject}}}`;
  }

  function normalizeQuantityNotation(value) {
    let body = String(value || '');
    // m(物質) 是舊質量寫法；顯示端一律改為 W 下標。
    body = body.replace(/\b([nWV]|m)\s*[（(]\s*([^()（）]+)\s*[）)]/g, (whole, symbol, token) =>
      quantitySubscript(symbol === 'm' ? QUANTITY_NOTATION.mass : symbol, token));
    body = body.replace(/\b([nWV]|m)_\{([^{}]+)\}/g, (whole, symbol, token) =>
      quantitySubscript(symbol === 'm' ? QUANTITY_NOTATION.mass : symbol, token));
    body = body.replace(/\b([nWV]|m)_([A-Za-z][A-Za-z0-9^+\-]*|[\u4e00-\u9fff]+)/g, (whole, symbol, token) =>
      quantitySubscript(symbol === 'm' ? QUANTITY_NOTATION.mass : symbol, token));
    return body;
  }

  /** 濃度顯示一律使用 [物種]；僅改明確的 C(物種)／c(物種)，不碰碳元素 C。 */
  function normalizeConcentrationNotation(value) {
    return String(value || '')
      .replace(/\b[cC]\s*[（(]\s*([^()（）]+)\s*[）)]/g, (_, token) => `[${String(token || '').trim()}]`)
      .replace(/\b[cC]_\{([^{}]+)\}/g, (_, token) => `[${String(token || '').trim()}]`);
  }

  function answerText(value) {
    const answer = clean(value).toUpperCase();
    return /^[A-Z](?:\s*[,，、]\s*[A-Z])+$/.test(answer)
      ? answer.split(/\s*[,，、]\s*/).join('、')
      : fullwidth(value);
  }

  /** 同一 calculation 含多步等號鏈時標記，供補寫輪拆開。 */
  function auditCrowdedCalculations(documentValue) {
    const issues = [];
    const blocks = Array.isArray(documentValue?.blocks) ? documentValue.blocks : [];
    blocks.forEach((block, blockIndex) => {
      if (block?.type !== 'calculation') return;
      const source = String(block.text || block.expression || '');
      const parts = splitCalculation(source);
      if (parts.length > 1) {
        issues.push(`第 ${blockIndex + 1} 個 calculation 含多步算式，應拆成多個 calculation`);
      }
    });
    return { issues };
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
    const body = rows.map((row) => {
      let label = fullwidth(row.label).replace(/[{}\\]/g, '');
      if (/^(起始|變化)/.test(label)) label = label.replace(/\s*[（(]\s*mol\s*[）)]/i, '');
      const values = ordered.flatMap((term, index) => {
        const value = clean(row.values[species.indexOf(term.species)] || '—');
        const item = cell(/^[—-]+$/.test(value) ? '\\text{—}' : calculation(value));
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
    const allowedHeadings = new Set([
      '題意', '已知與目標', '已知條件', '依據與推導', '依據', '推導',
      '解題步驟', '結果', '結論', '選項判斷', '選項分析'
    ]);
    let latestEquation = '';
    let currentSection = '';
    const blocks = doc.blocks;
    blocks.forEach((block, index) => {
      if (!BLOCK_TYPES.includes(block?.type)) return;
      const expression = clean(block.expression);
      if (block.type === 'heading') {
        const heading = fullwidth(block.text).replace(/^[【\[]|[】\]]$/g, '').replace(/[。；]+$/, '');
        if (allowedHeadings.has(heading)) {
          currentSection = heading;
          lines.push(`【${heading}】`);
        }
      } else if (block.type === 'paragraph') {
        const hasReactionTable = blocks.slice(index + 1).some((item) => item?.type === 'reaction_table');
        if (latestEquation && hasReactionTable && /^反應式如下[：:]?$/.test(clean(block.text))) return;
        const source = clean(block.text);
        const isDerivation = currentSection === '依據與推導';
        const paragraph = isDerivation ? source.replace(/^[•·]\s*/, '') : source;
        const rendered = formatNarrative(paragraph);
        if (isDerivation && rendered.length) {
          lines.push(`@@DERIVATION@@${rendered.shift()}`);
          lines.push(...rendered);
        } else {
          lines.push(...rendered);
        }
      } else if (block.type === 'chemical_equation') {
        const hasReactionTable = blocks.slice(index + 1).some((item) => item?.type === 'reaction_table');
        const text = clean(block.expression) && !(hasReactionTable && /^反應式如下[：:]?$/.test(clean(block.text))) ? formatText(block.text) : '';
        if (text) lines.push(text);
        latestEquation = expression || clean(block.text);
        if (latestEquation && !hasReactionTable) {
          splitChemicalEquations(latestEquation).forEach((equation) => {
            const rendered = chemistry(equation);
            if (rendered) lines.push(rendered);
          });
        }
      } else if (block.type === 'calculation') {
        const text = clean(block.expression) ? formatText(block.text) : '';
        if (text) lines.push(text);
        splitCalculation(expression || clean(block.text)).forEach((part) => {
          const raw = String(part || '').trim();
          const onlyNum = stripHtmlData(raw).replace(/\s+/g, '');
          // 略過無等號的孤島數字。
          if (!/[=≈]/.test(onlyNum) && /^\d+(?:\.\d+)?$/.test(onlyNum)) return;
          const rendered = math(calculation(part));
          if (rendered) lines.push(rendered);
        });
      } else if (block.type === 'reaction_table') {
        const table = reactionTable(block, latestEquation);
        if (table) lines.push(table);
        else {
          const text = formatText(block.text);
          if (text) lines.push(text);
        }
      } else if (block.type === 'choice') {
        const choice = normalizeChoice(block);
        if (!choice) return;
        const choiceLines = formatNarrative(choice.text);
        if (choiceLines.length) {
          lines.push(choiceMarker(choice.label, choiceLines[0]));
          lines.push(...choiceLines.slice(1));
        }
      }
    });
    const answer = answerText(doc.answer);
    if (answer) lines.push(`@@ANSWER@@${answer}`);
    return lines.join('\n');
  }

  function prepare(raw) {
    try {
      const document = normalizeDocument(parse(raw));
      const text = compilePlainDocument(document);
      return text
        ? { ok: true, text, document, fallback: false }
        : { ok: false, text: String(raw || '').trim(), document: null, fallback: true, reason: 'parse_or_empty' };
    } catch (err) {
      console.warn('SolutionCore.prepare failed', err);
      return {
        ok: false,
        text: String(raw || '').trim(),
        document: null,
        fallback: true,
        reason: String(err && err.message || err || 'compile_error')
      };
    }
  }

  global.SolutionCore = Object.freeze({
    SCHEMA, SYSTEM, SYSTEM_CORE, SYSTEM_CALC, QUANTITY_NOTATION, QUANTITY_NOTATION_PROMPT, buildSystem, buildQuantityNotationPrompt, parse, normalizeDocument, fullwidth, formatText, calculation, normalizeQuantityNotation, normalizeConcentrationNotation,
    compile, prepare, auditRequiredSections, auditCrowdedCalculations, splitCalculation, stripHtmlData,
    isChemicalToken, chemistry, splitChemicalEquations, restoreEatenLatexCommands, restoreEatenLatexInJsonSource, stripQuantityCommas
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SolutionCore;
})(typeof window !== 'undefined' ? window : globalThis);
