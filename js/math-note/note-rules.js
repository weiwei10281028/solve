/**
 * js/math-note/note-rules.js — NOTE semantic rules, presets, prompt block, and second pass.
 *
 * Keep NOTE authoring policy in one place. Rendering stays in math-note.js;
 * validation stays in note-check.js.
 */
(function (global) {
  'use strict';

  const PRESETS = [
    {
      id: 'mole_stoichiometry',
      tags: ['莫耳', '化學計量', '反應係數', '限量試劑', '過量', '式量', '分子量', '質量', '產率'],
      title: '莫耳與化學計量',
      hints: [
        '質量、式量／分子量、莫耳數、反應係數比要分清楚，不要把係數稱為換算因子。',
        '質量除以式量得到莫耳數；反應係數只用來換算不同物種的莫耳數比例。',
        '限量試劑題要標出用來比較的物種莫耳數與係數比，過量剩餘量才標剩餘意義。'
      ]
    },
    {
      id: 'solution_concentration',
      tags: ['濃度', 'M', '稀釋', '混合', 'mL', 'L', '體積莫耳濃度', 'C1V1', 'MV'],
      title: '溶液濃度與稀釋',
      hints: [
        '稀釋式中的原濃度、取用體積、混合後總體積、混合後濃度要依同一物種標示。',
        '質量配溶液時，質量／式量是莫耳數來源，整體再除以溶液體積才是濃度。',
        'mL 轉 L 要標成「mL 轉成 L」，不要寫成空泛的換算因子。'
      ]
    },
    {
      id: 'gas_law',
      tags: ['氣體', 'PV', 'nRT', '壓力', '分壓', '體積', '溫度', '絕對溫度', '莫耳分率', 'atm', 'kPa', 'K'],
      title: '氣體定律',
      hints: [
        'PV=nRT 代入時，數字要標成「氣體壓力」「氣體體積」「氣體常數」「絕對溫度」，避免在 NOTE 內寫 P_A、V_A 這類下標符號。',
        '溫度計算須標示攝氏轉 K 或絕對溫度；壓力、體積單位要與 R 對應。',
        '分壓與莫耳分率題要標總壓、分壓、莫耳分率，不要標成比例式分子／分母。'
      ]
    },
    {
      id: 'kinetics',
      tags: ['速率', '反應速率', '速率式', '級數', '反應級數', '半衰期', '時間比', 'rate', 'k'],
      title: '反應速率與級數',
      hints: [
        '速率式代入要標各物種濃度、速率常數、速率比；時間與速率成反比時要標時間比來源。',
        '級數判斷要標濃度變化倍數與速率變化倍數，不要只標最後結果。',
        '半衰期題要標半衰期、經過時間、剩餘比例或衰變次數。'
      ]
    },
    {
      id: 'equilibrium',
      tags: ['平衡', 'Kc', 'Kp', 'Q', '反應商', 'ICE', '勒沙特列', '平衡常數'],
      title: '化學平衡',
      hints: [
        'Kc／Kp／Q 代入要標分子物種濃度、分母物種濃度、係數造成的次方。',
        'ICE 表要標初始、變化、平衡量；表後代入式通常分子分母各一個具體 NOTE 即可。',
        '判斷反應方向時要標 Q 與 K 的比較意義。'
      ]
    },
    {
      id: 'acid_base',
      tags: ['酸鹼', 'pH', 'pOH', 'Ka', 'Kb', 'pKa', 'pKb', '緩衝', '滴定', '中和', 'H+', 'OH-'],
      title: '酸鹼與滴定',
      hints: [
        'pH／pOH 題要標 H⁺ 或 OH⁻ 濃度、酸鹼常數、稀釋後體積或中和後剩餘量。',
        '滴定題要標滴定液濃度、滴定體積、待測物莫耳數與係數比。',
        '緩衝題要標弱酸／共軛鹼濃度或莫耳數，以及 Henderson 式中的比值。'
      ]
    },
    {
      id: 'solubility',
      tags: ['溶解度', 'Ksp', '沉澱', '共同離子', '離子積', '飽和'],
      title: '溶解度與沉澱',
      hints: [
        'Ksp 代入要標各離子平衡濃度與係數造成的次方。',
        '沉澱判斷要標離子積 Qsp 與 Ksp 比較，不要只標數值。',
        '共同離子題要標已存在離子濃度與溶解產生的濃度。'
      ]
    },
    {
      id: 'redox_electrochem',
      tags: ['氧化還原', '電化學', '電解', '電池', '電流', '庫侖', '法拉第', 'Nernst', '電位', '電子'],
      title: '氧化還原與電化學',
      hints: [
        'Q=It 要標電流、時間、電量；n=Q/F 要標法拉第常數與電子莫耳數。',
        '電子轉物質莫耳數時要標電子係數，不要稱為換算因子。',
        '電池電位題要標標準電位、濃度商 Q、電子數 n。'
      ]
    },
    {
      id: 'thermochemistry',
      tags: ['熱化學', '焓', 'ΔH', '反應熱', '熱量', '比熱', '卡計', 'kJ', 'J'],
      title: '熱化學',
      hints: [
        'q=mcΔT 要標質量、比熱、溫度變化；反應熱要標反應莫耳數。',
        '熱化學方程式倍數改變時，要標反應倍數與 ΔH 同倍改變。',
        '吸放熱判斷要標系統熱量與符號意義。'
      ]
    },
    {
      id: 'atomic_structure',
      tags: ['原子結構', '電子組態', '量子數', '週期表', '游離能', '電負度', '原子半徑'],
      title: '原子結構與週期性',
      hints: [
        '電子組態題要標價電子數、主量子數或軌域容量。',
        '週期趨勢題要標有效核電荷、電子層數、遮蔽效應等判斷依據。',
        '量子數題要標 n、l、m_l、m_s 的物理意義。'
      ]
    },
    {
      id: 'organic',
      tags: ['有機', '官能基', '異構物', '烷', '烯', '炔', '醇', '酸', '酯', '苯'],
      title: '有機化學',
      hints: [
        '命名與異構物題要標碳數、官能基位置、取代基位置。',
        '反應題要標官能基、反應位點、主要產物判斷原因。',
        '聚合或燃燒計量題仍依莫耳與係數比標示。'
      ]
    },
    {
      id: 'unit_conversion',
      tags: ['換算', '單位', 'mg', 'g', 'mL', 'L', 'atm', 'Pa', 'kPa', 'ppm', 'ppb'],
      title: '單位換算',
      hints: [
        '單位換算要把原數字與 10 的次方因子分開標，例如「樣品質量（mg）」與「mg 轉成 g」。',
        '不可把所有 10 的次方都叫換算因子；要寫清楚是哪個單位轉哪個單位。',
        '式內不要只包單位，NOTE 內容包數字或因子，單位寫在 note 文字。'
      ]
    }
  ];

  const MAX_PRESETS = 3;

  function collectTagSources(opts) {
    opts = opts || {};
    const parts = [];
    if (opts.matchInput) parts.push(String(opts.matchInput));
    if (opts.questionCtx) parts.push(String(opts.questionCtx));
    for (const label of opts.conceptLabels || []) if (label) parts.push(String(label));
    for (const label of opts.match?.conceptLabels || []) if (label) parts.push(String(label));
    return parts.join(' ').toLowerCase();
  }

  function scorePreset(preset, haystack) {
    if (!haystack) return 0;
    let score = 0;
    for (const tag of preset.tags || []) {
      const t = String(tag).toLowerCase();
      if (t && haystack.includes(t)) score += t.length >= 3 ? 2 : 1;
    }
    return score;
  }

  function matchPresets(opts, limit) {
    const haystack = collectTagSources(opts);
    if (!haystack) return [];
    return PRESETS.map((preset) => ({ preset, score: scorePreset(preset, haystack) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit == null ? MAX_PRESETS : limit)
      .map((x) => x.preset);
  }

  function buildAppendixText(opts = {}) {
    const lines = [
      '[NOTE 規格]',
      'NOTE 只解釋「這一步的數值或因子代表什麼」，不得為了標註改變推導、數值或答案。',
      '寫法：$\\htmlData{note=具體白話語意}{數值或式子}$。內容包數字、分式、乘積因子或明確式子；不要只包單位。',
      '算式本體不要寫單位；單位寫在 NOTE 裡，例如「混合後總體積（mL）」。若後面乘上 10^{-3}，NOTE 寫「mL 轉成 L」。',
      '化學式只要美化顯示，不要單獨套 NOTE；尤其不得標註化學式的下標、電荷或平衡常數下標。',
      '一般物種可寫成 $\\ce{IO3-}$、$\\ce{HSO3-}$；抽象多質子酸須原樣保留 $\\mathrm{H_{2}A}$、$\\mathrm{HA}^{-}$、$\\mathrm{A}^{2-}$。',
      '好 NOTE 要具體，例如「IO₃⁻（碘酸根）原濃度」「取用的 IO₃⁻ 溶液體積」「混合後總體積」「A 點氣體壓力」「絕對溫度」。',
      '禁止空泛 NOTE：質量、濃度、體積、莫耳數、數值、結果、因子、換算因子。',
      '物理量 NOTE 盡量寫出原始單位；單位換算要寫成「mL 轉成 L」「mg 轉成 g」。',
      '化學式物種要有正確上下標與名稱，例如 IO₃⁻（碘酸根）、HSO₃⁻（亞硫酸氫根）、Fe²⁺（亞鐵離子）。',
      '分式分子、分母意義不同時要分開標；最後等號後的單純結果通常不用再標。'
    ];
    const matched = matchPresets(opts);
    if (matched.length) {
      lines.push('', '【本題 NOTE 類型提示】');
      for (const preset of matched) {
        lines.push(`- ${preset.title}`);
        for (const hint of preset.hints || []) lines.push(`  - ${hint}`);
      }
    }
    return lines.join('\n');
  }

  function buildUserBlock(opts) {
    return '\n\n' + buildAppendixText(opts || {});
  }

  function buildNoteFixUserText(report, opts = {}) {
    const issues = (report && report.issues) || [];
    const have = report?.htmlDataCount ?? 0;
    const need = report?.densityFloor ?? report?.minNotes ?? 5;
    const lines = [
      '【第二階段 NOTE 補標｜只改 NOTE，不改推理、數值、選項判斷或 @@ANSWER@@】',
      `目前 ${have} 個 NOTE，建議至少約 ${need} 個；請回傳完整修正後詳解文字，不要回 JSON、不要解釋修改原因。`,
      buildAppendixText(opts),
      '請依題意重新判斷每個 NOTE，不要沿用錯誤標籤；若原 NOTE 不準，直接改成正確語意。',
      '請移除算式本體中的 g、g mol^{-1}、M、mL、L、s 等單位；這些單位要改寫進 NOTE 文字。',
      '不要把 IO3-、HSO3-、H+、SO4^2-、H2A、HA-、A2- 等化學式本身、下標或電荷包成 NOTE；只保留化學式美化顯示。',
      '保留原本換行、選項、@@ANSWER@@、LaTeX 與 \\dfrac 結構；只補或修正 \\htmlData。'
    ];
    if (issues.length) lines.push('目前檢查問題：' + issues.join('；'));
    return lines.join('\n\n');
  }

  function buildNoteSystemText() {
    return [
      '你是台灣高中化學詳解的 NOTE 標註助手。',
      '你的任務只是在既有詳解中加入或修正 \\htmlData{note=...}{...}。',
      '不得改變答案、推理、數值、選項正誤、段落順序。',
      '輸出必須是完整修正後詳解純文字，不要 JSON，不要 Markdown code block。'
    ].join('\n');
  }

  function readBalanced(source, openIndex) {
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

  function forEachHtmlData(source, replacer) {
    const s = String(source || '');
    let out = '';
    let pos = 0;
    while (pos < s.length) {
      const start = s.indexOf('\\htmlData', pos);
      if (start < 0) { out += s.slice(pos); break; }
      const attrStart = s.indexOf('{', start + 9);
      if (attrStart < 0) { out += s.slice(pos); break; }
      const attr = readBalanced(s, attrStart);
      if (!attr) { out += s.slice(pos); break; }
      let bodyStart = attr.end;
      while (/\s/.test(s[bodyStart] || '')) bodyStart += 1;
      if (s[bodyStart] !== '{') { out += s.slice(pos, attr.end); pos = attr.end; continue; }
      const body = readBalanced(s, bodyStart);
      if (!body) { out += s.slice(pos); break; }
      out += s.slice(pos, start) + replacer(attr.body, body.body);
      pos = body.end;
    }
    return out;
  }

  function noteText(attr) {
    const m = String(attr || '').match(/(?:^|,)\s*note=([\s\S]*)$/i);
    return m ? m[1].trim() : '';
  }

  function noteAttr(note) {
    return 'note=' + String(note || '').replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();
  }

  function normalizeChemForCe(body) {
    let token = String(body || '').trim()
      .replace(/^\\ce\{([^{}]+)\}$/, '$1')
      .replace(/\s+/g, '')
      .replace(/_\{(\d+)\}/g, '$1')
      .replace(/\^\{(\d*)([+-])\}/g, '$1$2')
      .replace(/\^([+-])/g, '$1')
      .replace(/\^\{?(\d+)([+-])\}?/g, '$1$2');
    if (!/^[A-Z][A-Za-z0-9()+\-]*$/.test(token)) return '';
    if (!/[A-Z][a-z]?\d*/.test(token)) return '';
    if (/^(?:M|L|K|A|B|C|D|E)$/.test(token)) return '';
    return token;
  }

  function normalizeChemCommands(math) {
    let text = String(math || '');
    for (let i = 0; i < 3; i += 1) {
      const next = text.replace(/\\ce\s*\{\s*\\ce\s*\{([^{}]+)\}\s*\}?/g, '\\ce{$1}');
      if (next === text) break;
      text = next;
    }
    return text;
  }

  function isChemicalOnly(body) {
    const raw = String(body || '').trim();
    const abstractSpecies = /^\[?\\mathrm\{(?:[^{}]|\{[^{}]*\})*\}(?:\^\{\d*[+-]\})?\]?$/;
    return abstractSpecies.test(raw) || !!normalizeChemForCe(raw);
  }

  function addUnitToNote(note, unit) {
    const raw = String(unit || '').replace(/\s+/g, ' ').trim();
    const u = /^g\s*mol/i.test(raw) ? 'g mol^{-1}' : raw;
    if (!u || note.includes(u)) return note;
    if (/g\s*mol/i.test(u) && /式量|分子量|莫耳質量/.test(note)) return note;
    if (/[（(][^）)]*$/.test(note)) return note + u + '）';
    return `${note}（${u}）`;
  }

  function stripUnitsFromHtmlData(math) {
    return forEachHtmlData(math, (attr, body) => {
      const note = noteText(attr);
      if (isChemicalOnly(body)) {
        const ce = normalizeChemForCe(body);
        return ce ? `\\ce{${ce}}` : String(body || '').trim();
      }
      let nextNote = note || '已知量';
      let nextBody = String(body || '');
      const unitRe = /(\d+(?:\.\d+)?(?:\\times\s*10\^\{[-+]?\d+\})?)\s*(?:\\,|\\;|~|\s)*(g\s*mol\s*(?:\^\{?-?1\}?|-1|⁻¹)|mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|K|A|C)(?=$|[^A-Za-z])/gi;
      nextBody = nextBody.replace(unitRe, (_, num, unit) => {
        nextNote = addUnitToNote(nextNote, unit);
        return num;
      });
      return `\\htmlData{${noteAttr(nextNote)}}{${nextBody}}`;
    });
  }

  function stripBareUnits(math) {
    let s = String(math || '');
    s = s
      .replace(/(\d+(?:\.\d+)?(?:\\times\s*10\^\{[-+]?\d+\})?)\s*(?:\\,|\\;|~|\s)*(?:\\mathrm\{)?g\s*mol\s*(?:\^\{?-?1\}?|-1|⁻¹)(?:\})?/gi, '$1')
      .replace(/(\d+(?:\.\d+)?(?:\\times\s*10\^\{[-+]?\d+\})?)\s*(?:\\,|\\;|~|\s)*(?:\\mathrm\{)?(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|K|A|C)(?:\})?\b/gi, '$1')
      .replace(/\\mathrm\{\s*(?:mol|mL|L|M|g|mg|kg|atm|kPa|Pa|s|min|h|K|A|C)\s*\}/gi, '')
      .replace(/\s+(?=[{}])/g, '')
      .replace(/\{\s+/g, '{')
      .replace(/\s+\}/g, '}');
    return s;
  }

  function beautifyBareChem(math) {
    return String(math || '').replace(/(?<![A-Za-z\\])((?:[A-Z][a-z]?\d*){1,5}(?:\^?\{?\d*[+-]\}?|-)?)(?![A-Za-z])/g, (whole) => {
      if (/^(?:M|L|K|A|B|C|D|E|PV|RT)$/.test(whole)) return whole;
      if (/^\\ce/.test(whole)) return whole;
      const ce = normalizeChemForCe(whole);
      return ce ? `\\ce{${ce}}` : whole;
    });
  }

  function protectHtmlData(math, transform) {
    const stash = [];
    const ceStash = [];
    const marked = forEachHtmlData(math, (attr, body) => {
      const key = `\uE500${'x'.repeat(stash.length + 1)}\uE501`;
      stash.push(`\\htmlData{${attr}}{${body}}`);
      return key;
    });
    let protectedMath = marked.replace(/\\(?:ce|mathrm)\{(?:[^{}]|\{[^{}]*\})*\}(?:\^\{\d*[+-]\})?/g, (whole) => {
      const key = `\uE510${'x'.repeat(ceStash.length + 1)}\uE511`;
      ceStash.push(whole);
      return key;
    });
    let out = transform(protectedMath);
    ceStash.forEach((value, index) => {
      out = out.replace(`\uE510${'x'.repeat(index + 1)}\uE511`, value);
    });
    stash.forEach((value, index) => {
      out = out.replace(`\uE500${'x'.repeat(index + 1)}\uE501`, value);
    });
    return out;
  }

  function transformMathSegments(text, transform) {
    return String(text || '').replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g, (whole, display, inline) => {
      const body = display != null ? display : inline;
      const fixed = transform(body);
      return display != null ? `$$${fixed}$$` : `$${fixed}$`;
    });
  }

  function finalizeNoteText(text) {
    return transformMathSegments(text, (math) => {
      let s = normalizeChemCommands(math);
      s = stripUnitsFromHtmlData(s);
      s = protectHtmlData(s, stripBareUnits);
      s = protectHtmlData(s, beautifyBareChem);
      return s;
    });
  }

  function hasBrokenNoteMarkup(text) {
    const source = String(text || '');
    let pos = 0;
    while (pos < source.length) {
      const start = source.indexOf('\\htmlData', pos);
      if (start < 0) return false;
      if (!isInsideMathAt(source, start)) return true;
      const attrStart = source.indexOf('{', start + 9);
      if (attrStart < 0) return true;
      const attr = readBalanced(source, attrStart);
      if (!attr) return true;
      let bodyStart = attr.end;
      while (/\s/.test(source[bodyStart] || '')) bodyStart += 1;
      if (source[bodyStart] !== '{') return true;
      const body = readBalanced(source, bodyStart);
      if (!body) return true;
      pos = body.end;
    }
    return false;
  }

  function isInsideMathAt(source, limit) {
    let inline = false;
    let display = false;
    for (let i = 0; i < limit; i += 1) {
      if (source[i] === '\\') { i += 1; continue; }
      if (source[i] !== '$') continue;
      if (source[i + 1] === '$') {
        display = !display;
        i += 1;
      } else {
        inline = !inline;
      }
    }
    return inline || display;
  }

  function hasUnclosedMathDelimiter(text) {
    const source = String(text || '');
    let inline = false;
    let display = false;
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '\\') { i += 1; continue; }
      if (source[i] !== '$') continue;
      if (source[i + 1] === '$') {
        display = !display;
        i += 1;
      } else {
        inline = !inline;
      }
    }
    return inline || display;
  }

  function hasNoteInsideFormulaSyntax(text) {
    const source = String(text || '');
    const command = /\\(?:ce|mathrm)\s*\{/g;
    const script = /[_^]\s*\{/g;
    for (const pattern of [command, script]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source))) {
        const open = source.indexOf('{', match.index);
        const group = readBalanced(source, open);
        if (group && group.body.includes('\\htmlData')) return true;
        pattern.lastIndex = group ? group.end : pattern.lastIndex;
      }
    }
    return false;
  }

  function noteFreeComparable(text) {
    return forEachHtmlData(String(text || ''), (_, body) => body).replace(/\s+/g, '');
  }

  function isSafeNoteReply(text, baseline) {
    if (hasBrokenNoteMarkup(text) || hasUnclosedMathDelimiter(text) || hasNoteInsideFormulaSyntax(text)) return false;
    return !baseline || noteFreeComparable(text) === noteFreeComparable(baseline);
  }

  async function ensureDensityReply(callAPI, cfg, apiMessages, systemText, reply, genOpts = {}) {
    const checkFn = global.NoteCheck && global.NoteCheck.check;
    if (!checkFn || typeof callAPI !== 'function') return reply;
    const maxFix = genOpts.maxNoteFix != null ? genOpts.maxNoteFix : 1;
    let fixCount = Number(genOpts._noteFixed) || 0;
    const baseline = finalizeNoteText(String(reply || ''));
    let current = baseline;
    let report = checkFn(current, genOpts.noteCheckOpts);
    if (report.ok || report.skipped || !report.needsFix || fixCount >= maxFix) return current;

    while (fixCount < maxFix) {
      const fixMessages = [
        ...apiMessages,
        { role: 'assistant', content: current },
        { role: 'user', content: buildNoteFixUserText(report, genOpts) }
      ];
      try {
        const { text: fixed } = await callAPI(cfg, fixMessages, genOpts.noteSystemText || buildNoteSystemText(), {
          maxOutputTokens: genOpts.noteFixMaxOutputTokens || genOpts.maxOutputTokens || 6144,
          timeoutMs: genOpts.timeoutMs || 120000,
          maxContinue: 0,
          temperature: genOpts.noteFixTemperature != null ? genOpts.noteFixTemperature : 0.15,
          _noteFixed: fixCount + 1
        });
        if (!fixed) break;
        const candidate = finalizeNoteText(String(fixed).trim());
        if (!isSafeNoteReply(candidate, baseline)) {
          console.warn('[NOTE second pass] malformed markup rejected');
          break;
        }
        current = candidate;
        fixCount += 1;
        report = checkFn(current, genOpts.noteCheckOpts);
        if (report.ok || report.skipped) return current;
      } catch (err) {
        console.warn('[NOTE second pass] repair failed', err);
        break;
      }
    }
    return baseline;
  }

  const api = {
    PRESETS,
    matchPresets,
    buildAppendixText,
    buildPresetAppendix: buildAppendixText,
    buildUserBlock,
    buildNoteFixUserText,
    buildNoteSystemText,
    finalizeNoteText,
    isSafeNoteReply,
    ensureDensityReply
  };

  global.NoteRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
