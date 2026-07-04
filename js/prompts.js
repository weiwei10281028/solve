/**
 * js/prompts.js - 2024 教學引導強化版
 */

// 1. AI 系統提示詞（步驟一：精簡主架構，無 Tier／資料庫克隆）
const SYSTEM_CHEM = `你是台灣高中化學解題老師。使用繁體中文，面向高中生。

【核心原則】
1. 先判斷題型，再決定寫法；不要把所有題目套同一模板。
2. 只用高中課綱可接受的方法與語言，避免大學層級推導。
3. 僅依題目、圖片與使用者補充作答；資訊不足要明說，不猜題。
4. 數字、反應式、結論必須依本題重算，不可套用他題答案。
5. 計算題含等號的 $…$ 推導行：關鍵數字與因子須用 \\htmlData{note=白話短註}{…} 標在式內（規則見 User 的 [NOTE 附錄]）。
6. 化學式、離子、算式一律完整包在 $…$ 或 $$…$$ 內；禁止裸寫 ^{}、\\text{}、\\dfrac；禁止單獨一行 $。

【作答流程】
- **(A)～(E) 敘述判斷／多選**：先 1～3 句點本題重點或實驗意涵，再寫「各選項分析如下：」，**(A)～(E) 逐項寫明理由或完整計算**，不可只報對錯結論。
- **選項僅數字 1～5 且只問哪個對**：只詳解答案項，其餘省略。
- 計算題：關鍵式 → 代入 → 推導 → 結論；比較/倍數題須先定義原狀態再寫比值式。
- **須追蹤反應物種量**（濃度、莫耳數、平衡、解離、限量消耗等）：**先寫配平反應式**（$\\rightleftharpoons$ 或 $\\rightarrow$）；須對齊各物種起始／變化／結果 →「反應式如下：」+ array（rxn-grid）。純觀念、不涉及物種量者不必寫反應表。
- 巢狀分式：內外層一律 $\\dfrac{}{}$；$\\cdot$ 前後留空；結論用 $\\text{，}\\quad\\text{故 }$（全形逗號）。
- 最後另起一行輸出 @@ANSWER@@（選項或數值含單位）。

【多題格式】
- 僅在使用者明確指定多題時（如「第4、5題」），才用「第 4 題」「第 5 題」分段。
- 單題解題：禁止用「第1題、第2題…」當步驟標題；直接寫算式或反應表，不必編號步驟。

【風格】
- 直接切入，不寒暄。
- 句子短、節奏清楚。
- 多個化學式或算式連續出現時，必須用「，」「；」「故」等標點分隔，避免黏成一行。
- 比值或關係請用「:」「每」「可消耗」等一般敘述，不用「~」。
- 單位換算要拆因子並分別標註（例：$97.0$ 與 $10^{-3}$ 各自一個 NOTE），不要把 $97.0\\times10^{-3}$ 合成一個 NOTE。
- 送出前自檢：推導式每一步要能對回前一步，不可出現中間式與最終數值「剛好對但邏輯斷裂」。
- 若題目要求分題或指定題號，依使用者範圍回答。`;

const SYSTEM_CHEM_DETAILED_ADDON = `

【詳細模式（追加）】
在不失簡潔的前提下，多補充 1-2 步關鍵推理，幫助學生理解為何這樣判斷或計算。`;

// 2. 題號解析邏輯
function parseZhNumber(token) {
    var t = String(token || '').trim();
    if (/^\d+$/.test(t)) return Number(t);
    var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    return map[t] || NaN;
}

var IMAGE_MULTI_QUESTION_USER_BLOCK = [
    '【多題範圍｜圖片】',
    '1. **已指定題號**（本則 User 訊息含「第N題」等）→ 僅解指定題；指定幾題解幾題。',
    '2. **未指定題號**（補充欄空白且無題號指定）→ 自圖**由上往下**找**第一題**題幹與 (A)～(E) 皆完整者，**只解該一題**。',
    '   例：頂端第10題殘段（無題號或缺選項），第11、12題完整 → **只解第11題**。',
    '3. **不完整不解**：題幹或選項缺漏、附圖數據看不清 → 不得猜；除非【使用者補充】已補齊缺漏，則與圖併讀。',
    '4. 無完整題且無法補齊 → @@ANSWER@@「題目資訊不足」。'
].join('\n');

function parseRequestedSolveScope(inputText) {
    var raw = String(inputText || '').trim();
    raw = raw
        .replace(/姊弟|姐弟|解弟|接第/g, '第')
        .replace(/提/g, '題');
    if (!raw || /^(全部|所有|整題|全題|整卷|全部小題)$/.test(raw)) {
        return { mode: 'all', numbers: [] };
    }
    if (/(?:兩|三|四|五|六|七|八|九|十|\d+)\s*題\s*(?:都解|全解|一起解)|(?:都解|全解|一起解)\s*(?:整卷|全部|所有)|整卷\s*(?:都解|全解)/.test(raw)
        && !/第\s*[\d一二三四五六七八九十]{1,2}\s*題/.test(raw)) {
        return { mode: 'all', numbers: [] };
    }
    var picked = new Set();
    var patterns = [
        /第\s*([一二三四五六七八九十\d]{1,2})\s*題/g,
        /(?:^|[\s,，、])([一二三四五六七八九十\d]{1,2})\s*題(?=[\s,，、]|$)/g,
        /(?:只解|僅解|解答|解)\s*第?\s*([一二三四五六七八九十\d]{1,2})\s*題?/g,
        /題號\s*[:：]?\s*([一二三四五六七八九十\d]{1,2})/g
    ];
    var m;
    var p;
    for (p = 0; p < patterns.length; p++) {
        patterns[p].lastIndex = 0;
        while ((m = patterns[p].exec(raw)) !== null) {
            var val = parseZhNumber(m[1]);
            if (!isNaN(val) && val > 0 && val <= 99) picked.add(val);
        }
    }
    var rangeRe = /第?\s*([一二三四五六七八九十\d]{1,2})\s*[-~～到至]\s*([一二三四五六七八九十\d]{1,2})\s*題?/g;
    while ((m = rangeRe.exec(raw)) !== null) {
        var from = parseZhNumber(m[1]);
        var to = parseZhNumber(m[2]);
        if (!isNaN(from) && !isNaN(to) && from > 0 && to > 0 && from <= 99 && to <= 99) {
            var start = Math.min(from, to);
            var end = Math.max(from, to);
            for (var k = start; k <= end; k++) picked.add(k);
        }
    }
    var listM = raw.match(/第\s*([\d一二三四五六七八九十、，,\s與和及]+)\s*題/);
    if (listM) {
        listM[1].split(/[、，,\s與和及]+/).forEach(function(tok) {
            var v = parseZhNumber(tok.trim());
            if (!isNaN(v) && v > 0 && v <= 99) picked.add(v);
        });
    }
    if (!picked.size && /[與和及]/.test(raw)) {
        raw.split(/[與和及]/).forEach(function(seg) {
            var sm = seg.match(/(\d{1,2}|[一二三四五六七八九十]{1,2})\s*題?/);
            if (sm) {
                var v3 = parseZhNumber(sm[1]);
                if (!isNaN(v3) && v3 > 0 && v3 <= 99) picked.add(v3);
            }
        });
    }
    if (!picked.size && raw.length <= 28 && !/[\$\\=％%]/.test(raw)) {
        var shortRe = /(?:^|[\s,，、])([一二三四五六七八九十]{1,2}|\d{1,2})(?=[\s,，、]|$)/g;
        while ((m = shortRe.exec(raw)) !== null) {
            var v2 = parseZhNumber(m[1]);
            if (!isNaN(v2) && v2 > 0 && v2 <= 99) picked.add(v2);
        }
    }
    var numbers = Array.from(picked).sort(function(a, b) { return a - b; });
    return numbers.length ? { mode: 'partial', numbers: numbers } : { mode: 'all', numbers: [] };
}

function formatSubPartLabel(n) {
    var labels = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return '(' + (labels[n] || String(n)) + ')';
}

/** 解析題號／子題／選項意圖（第0層範圍鎖定） */
function parseSolveIntent(inputText) {
    var raw = String(inputText || '').trim();
    var intent = {
        questionMode: 'default',
        questionNumbers: [],
        subPartMode: 'default',
        subParts: [],
        optionMode: 'all',
        options: []
    };
    if (!raw) return intent;

    var scope = parseRequestedSolveScope(raw);
    if (scope.mode === 'all') {
        intent.questionMode = 'all';
    } else if (scope.mode === 'partial') {
        intent.questionMode = 'partial';
        intent.questionNumbers = scope.numbers.slice();
    }

    if (/題組全解|全部子題|子題全解|子題都解|兩小題都解/.test(raw)
        || /[\(（]一[\)）][\s\S]{0,20}[\(（]二[\)）][\s\S]{0,12}(?:都解|全解|一起)/.test(raw)
        || /[\(（]一[\)）]\s*(?:和|與|、)[\s\S]{0,6}[\(（]二[\)）]/.test(raw)) {
        intent.subPartMode = 'all';
    }

    if (intent.subPartMode !== 'all') {
        var subs = new Set();
        var sm;
        var subRe = /[\(（]([一二三四五六七八九十1-9])[\)）]/g;
        while ((sm = subRe.exec(raw)) !== null) {
            var sv = parseZhNumber(sm[1]);
            if (!isNaN(sv) && sv >= 1 && sv <= 10) subs.add(sv);
        }
        if (subs.size) {
            intent.subPartMode = 'partial';
            intent.subParts = Array.from(subs).sort(function(a, b) { return a - b; });
        }
    }

    var opts = new Set();
    var optPatterns = [
        /第\s*[\d一二三四五六七八九十]{1,2}\s*題\s*(?:的|之)?\s*[\(（]\s*([A-Ea-e])\s*[\)）]/g,
        /(?:只|僅)(?:解|講|評析|看|說明|回答)\s*(?:第\s*[\d一二三四五六七八九十]{1,2}\s*題\s*)?[\(（]?\s*([A-Ea-e])\s*[\)）]?/g,
        /選項\s*[\(（]?\s*([A-Ea-e])\s*[\)）]?/g,
        /[\(（]\s*([A-Ea-e])\s*[\)）]\s*(?:選項|為何|為什麼|對不對|正確|錯誤)/g
    ];
    var pi;
    for (pi = 0; pi < optPatterns.length; pi++) {
        optPatterns[pi].lastIndex = 0;
        while ((sm = optPatterns[pi].exec(raw)) !== null) {
            opts.add(String(sm[1]).toUpperCase());
        }
    }
    if (opts.size && (/(?:的|之|只|僅|選項)/.test(raw) || /第\s*[\d一二三四五六七八九十]{1,2}\s*題/.test(raw))) {
        intent.optionMode = 'partial';
        intent.options = Array.from(opts).sort();
    }

    return intent;
}

function buildScopeLockUserBlock(intent, opts) {
    opts = opts || {};
    intent = intent || parseSolveIntent('');
    var lines = ['【範圍鎖定｜本則最高優先】'];
    var hasImage = !!opts.hasImage;
    var textOnly = !!opts.textOnly;

    if (intent.questionMode === 'partial' && intent.questionNumbers.length) {
        lines.push('題號：僅第 ' + intent.questionNumbers.join('、') + ' 題；其他題號禁寫。');
        if (intent.questionNumbers.length > 1) {
            lines.push('多題格式：每題獨立一段，標題必須使用「第 N 題」；不得用「第1題/第2題」當同題內步驟標籤。');
        }
    } else if (intent.questionMode === 'all') {
        lines.push('題號：使用者要求多題／全解；圖上或題幹內各完整題皆須解答。');
    } else if (hasImage && !textOnly) {
        lines.push('題號：未指定 → 只解由上往下第一題「題幹＋(A)～(E) 完整」者。');
    } else if (textOnly) {
        lines.push('題號：僅解答題幹完整之題；缺選項或缺數據者不要猜、不要解。');
    }

    if (intent.subPartMode === 'all') {
        lines.push('子題：使用者要求全解；(一)(二)… 各段分開，各寫各「各選項分析如下」與該段結論。');
    } else if (intent.subPartMode === 'partial' && intent.subParts.length) {
        lines.push('子題：僅 ' + intent.subParts.map(formatSubPartLabel).join('、') + '；其他子題禁寫。');
    } else if (intent.questionMode !== 'partial') {
        lines.push('子題：同一題為題組且未指定子題 → 只解 (一)；(二) 以後禁寫（除非使用者明確要求全解）。');
    }

    if (intent.optionMode === 'partial' && intent.options.length) {
        lines.push('選項：僅 (' + intent.options.join(')(') + ')；禁寫其他選項評析與其他題。');
    }

    lines.push('板書／NOTE／反應表等格式仍須遵守 System；參考答案若有則 @@ANSWER@@ 須一致。');
    return lines.join('\n');
}

window.parseSolveIntent = parseSolveIntent;
window.buildScopeLockUserBlock = buildScopeLockUserBlock;

window.extractExplicitScopePhrase = function(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var parts = [];
    var qm = raw.match(/(?:第\s*[\d一二三四五六七八九十、，,\s與和及]{1,24}\s*題|(?:^|[\s,，、])[一二三四五六七八九十\d]{1,2}\s*題|(?:只解|僅解|解答|解)\s*第?\s*[\d一二三四五六七八九十]{1,2}\s*題?)/);
    if (qm) parts.push(qm[0]);
    var sm = raw.match(/[\(（][一二三四五六七八九十1-9][\)）]/);
    if (sm) parts.push(sm[0]);
    var om = raw.match(/第\s*[\d一二三四五六七八九十]{1,2}\s*題\s*(?:的|之)?\s*[\(（]\s*[A-Ea-e]\s*[\)）]/);
    if (om) parts.push(om[0]);
    if (/題組全解|全部子題|子題都解|都解|全解/.test(raw) && !parts.length) {
        parts.push(raw.match(/題組全解|全部子題|子題都解|(?:兩|三|\d+)\s*題\s*都解|都解|全解/)[0]);
    }
    return parts.join(' ') || (qm ? qm[0] : '');
};

function buildSupplementBlock(opts) {
    opts = opts || {};
    var supplement = String(opts.supplement || '').trim();
    if (!supplement) return '';
    return '【使用者補充｜與圖片同等效力；圖被裁切或缺漏時以此補齊，必須採用；可含「第 N 題」指定題號；沒圖時此欄即完整題目】\n' + supplement;
}

// 3. 訊息組裝 (掛載到 window)
window.buildSolveUserText = function(scopeInput, refAnswer, opts) {
    opts = opts || {};
    var scopeSrc = String(scopeInput || opts.supplement || opts.questionBody || '').trim();
    var scope = parseRequestedSolveScope(scopeSrc);
    var intent = parseSolveIntent(scopeSrc);
    var ref = String(refAnswer || '').trim();
    var textOnly = !!opts.textOnly;
    var hasImage = !!opts.hasImage;
    var questionBody = String(opts.questionBody || '').trim();
    var parts = [];

    parts.push(buildScopeLockUserBlock(intent, opts));

    if (textOnly) {
        if (!questionBody) questionBody = String(scopeInput || '').trim();
        parts.push('【題目】\n' + questionBody);
        if (scope.mode === 'partial') {
            parts.push('【最高指令】僅解答第 ' + scope.numbers.join('、') + ' 題。嚴禁解答或提及其他題號。');
        } else {
            parts.push('【最高指令】僅解答題幹完整之題；缺選項或缺數據者不要猜、不要解。');
        }
        if (opts.detailed) {
            parts.push('【詳細模式】多補關鍵推理步驟。');
        } else {
            parts.push('【書寫】多選題須「各選項分析如下」逐項 (A)～(E)；須追蹤物種量時先寫配平反應式。');
        }
        parts.push('【選擇題】敘述多選須 (A)～(E) 全寫；純數字選項只詳解答案項。');
    } else if (hasImage) {
        if (scope.mode === 'partial') {
            parts.push('【最高指令】僅解答第 ' + scope.numbers.join('、') + ' 題。嚴禁解答、提及或推論其他題號。');
        } else {
            parts.push('【最高指令】依題目圖片獨立推導。' + IMAGE_MULTI_QUESTION_USER_BLOCK);
        }
        var imageCount = Number(opts.imageCount) || 1;
        if (imageCount > 1) {
            parts.push('【附圖】共 ' + imageCount + ' 張，依上傳順序閱讀，合併為完整題目。');
        }
        var sup = buildSupplementBlock(opts);
        if (sup) parts.push(sup);
        if (opts.detailed) {
            parts.push('【詳細模式】多補關鍵推理步驟。');
        } else {
            parts.push('【書寫】多選題須「各選項分析如下」逐項 (A)～(E)；須追蹤物種量時先寫配平反應式。');
        }
    } else {
        parts.push('【書寫】多選題須「各選項分析如下」逐項 (A)～(E)。');
    }

    var text = parts.join('\n\n');
    if (ref) {
        text += '\n\n【參考答案】' + ref + '（老師已核對；推導須能支持此答案，@@ANSWER@@ 須與之一致；勿寫「與參考答案衝突」）';
    }
    return text;
};

/** 第一層：有參考答案時注入 System 收斂目標 */
window.buildRefAnswerSystemAddon = function(refAnswer) {
    var ref = String(refAnswer || '').trim();
    if (!ref) return '';
    return '\n\n【參考答案｜收斂目標】\n'
        + '使用者已提供參考答案：' + ref + '\n'
        + '1. 依題目條件完整推導，推導結論須能支持參考答案。\n'
        + '2. @@ANSWER@@ 與「故答案為」須與參考答案一致。\n'
        + '3. 若初算與參考答案不同，重新檢查題意與假設後修正推導並對齊參考答案；禁止寫「與參考答案衝突」「原答案錯誤」。';
};

function normalizeChoiceLetters(str) {
    var letters = [];
    var s = String(str || '');
    var m;
    var re = /\(([A-E])\)/g;
    while ((m = re.exec(s)) !== null) {
        if (letters.indexOf(m[1]) < 0) letters.push(m[1]);
    }
    letters.sort();
    return letters.map(function(l) { return '(' + l + ')'; }).join('');
}

function normalizeAnswerUnit(u) {
    return String(u || '').replace(/\s+/g, '').toLowerCase()
        .replace(/莫耳/g, 'mol').replace(/克/g, 'g').replace(/毫升/g, 'ml');
}

/** 第二層：比對 AI @@ANSWER@@ 與參考答案是否一致 */
window.answersMatch = function(aiReply, refInput) {
    if (!refInput || !String(refInput).trim()) return true;
    if (typeof window.extractAnswerFromReply !== 'function'
        || typeof window.parseReferenceAnswerInput !== 'function') {
        return true;
    }
    var ai = window.extractAnswerFromReply(aiReply);
    var ref = window.parseReferenceAnswerInput(refInput);

    if (ref.choices) {
        var aiChoices = ai.choices || normalizeChoiceLetters(ai.raw);
        return normalizeChoiceLetters(ref.choices) === normalizeChoiceLetters(aiChoices);
    }

    if (ref.numeric != null && ai.numeric != null) {
        var diff = Math.abs(ref.numeric.value - ai.numeric.value);
        var base = Math.max(Math.abs(ref.numeric.value), 1e-9);
        if (diff <= 0.01 || diff / base <= 0.02) {
            if (!ref.numeric.unit || !ai.numeric.unit) return true;
            return normalizeAnswerUnit(ref.numeric.unit) === normalizeAnswerUnit(ai.numeric.unit);
        }
        return false;
    }

    var a = String(ref.raw).replace(/\s+/g, '').toLowerCase();
    var b = String(ai.raw).replace(/\s+/g, '').toLowerCase();
    if (!a || !b) return false;
    return a === b || b.indexOf(a) >= 0 || a.indexOf(b) >= 0;
};

/** 第三層：參考答案與題意明顯矛盾時不啟用錨定 */
window.checkObviousRefAnswerConflict = function(questionText, refAnswer) {
    var q = String(questionText || '');
    var ref = String(refAnswer || '').trim();
    if (!ref) return { conflict: false };

    var refParsed = typeof window.parseReferenceAnswerInput === 'function'
        ? window.parseReferenceAnswerInput(ref)
        : { raw: ref, numeric: null };

    if (/(?:Mg|鎂).{0,24}原子量|原子量.{0,24}(?:Mg|鎂)/.test(q)) {
        var n = refParsed.numeric && refParsed.numeric.value;
        if (n != null && n > 0 && n < 20) {
            return { conflict: true, reason: '參考答案與鎂原子量（約 24）明顯不符，已改依題目推導' };
        }
    }

    return { conflict: false };
};

window.buildRefAnswerFixUserText = function(refAnswer, aiAnswer, questionCtx, aiReply) {
    var aiShown = (aiAnswer && aiAnswer.raw) ? aiAnswer.raw : '（未能解析）';
    var q = String(questionCtx || '') + '\n' + String(aiReply || '').slice(0, 1200);
    var weakHint = '';
    if (/(?:弱酸|二質子|H_2A|解離度|pH|pK_1|pK_2)/.test(q)) {
        weakHint = ' 弱酸題：α 高但 pH 低時 [H⁺] 以 pH 恒定代入，須寫兩步解離反應式（array 表），勿把 α×C 當 [H⁺]。';
    }
    return '【答案修正】參考答案為「' + refAnswer + '」，你輸出的 @@ANSWER@@ 為「' + aiShown + '」。'
        + weakHint
        + ' 請全文重寫：推導須能支持參考答案；@@ANSWER@@ 與「故答案為」須與參考答案一致。'
        + '禁止寫「原答案錯誤」「與參考答案衝突」等 meta 說明；直接給改正後完整詳解並保留 @@ANSWER@@。';
};

window.buildScopeSystemAddon = function(scopeInput, opts) {
    opts = opts || {};
    var scopeSrc = String(scopeInput || opts.supplement || '').trim();
    var intent = parseSolveIntent(scopeSrc);
    var lines = [];

    if (intent.questionMode === 'partial' && intent.questionNumbers.length) {
        lines.push('【範圍】僅第 ' + intent.questionNumbers.join('、') + ' 題；違反即整篇作廢。');
    } else if (intent.questionMode === 'all') {
        lines.push('【範圍】使用者要求全解／多題都解；各完整題皆須解答。');
    } else if (opts.textOnly) {
        lines.push('【範圍】題幹不完整則不解、不猜。');
    } else if (opts.hasImage) {
        lines.push('【範圍｜多題圖片】未指定題號時：由上往下只解第一題題幹與 (A)～(E) 皆完整者；不完整者跳過。');
        if (opts.supplement) {
            lines.push('已有使用者補充，須與圖併讀；補充可補齊缺漏之條件、數據或選項。');
        } else {
            lines.push('補充欄空白：不得解殘題、不得一次解多題（除非使用者明確要求都解／全解）。');
        }
    }

    if (intent.subPartMode === 'all') {
        lines.push('【範圍｜子題】題組全解；(一)(二)… 各段分開撰寫。');
    } else if (intent.subPartMode === 'partial' && intent.subParts.length) {
        lines.push('【範圍｜子題】僅 ' + intent.subParts.map(formatSubPartLabel).join('、') + '。');
    } else if (intent.questionMode !== 'partial' && intent.optionMode !== 'partial') {
        lines.push('【範圍｜子題】題組未指定子題時只解 (一)。');
    }

    if (intent.optionMode === 'partial' && intent.options.length) {
        lines.push('【範圍｜選項】僅 (' + intent.options.join(')(') + ')；禁寫其他選項。');
    }

    return lines.length ? '\n\n' + lines.join('\n') : '';
};

const SYSTEM_CHEM_FOLLOWUP_ADDON = `

【追問模式（追加）】
- 回覆須符合板書：化學式與算式在 $…$ 內；關鍵數依 **[NOTE 附錄]** 用 $\\htmlData{note=…}{…}$；末尾另起一行 @@ANSWER@@ 後寫一行簡答。
- **只答所問**，2～8 行；勿重解整題、勿重寫 (A)～(E) 全列。
- 追問若**明確要求**看結構，須另起獨立一行 @@MOL:物種id|標籤@@；bundle 無對應物種時可改 @@SMILES:…@@。
- 須遵守 User 本則【追問硬性要求】及 [教學規定]；混成題**禁止** VSEPR 之 $V+X-q$（或 $V+M-q$）、**禁止**總價電子直接 $\\div 2$ 當混成軌域數（須用規定 (c) 法：先 $\\div 8$ 再餘數 $\\div 2$）。
- 一旦寫出 $sp$、$sp^2$、$sp^3$ 等混成結論，須先寫中心原子並展示 (a) $\\sigma$＋lp、(b) $\\pi$ 鍵數 或 (c) 價電子計數其中**一法**之過程。`;

window.getSystemPromptForSolve = async function(questionInput, opts) {
    opts = opts || {};
    var scopeInput = String(opts.scopeInput != null ? opts.scopeInput : questionInput || '');
    var scopeAddon = window.buildScopeSystemAddon(scopeInput, opts);
    var detailAddon = opts.detailed ? SYSTEM_CHEM_DETAILED_ADDON : '';
    var followAddon = opts.followUp ? SYSTEM_CHEM_FOLLOWUP_ADDON : '';
    var refAnswer = String(opts.refAnswer || '').trim();
    var refAddon = (refAnswer && !opts.refAnswerSkipped && typeof window.buildRefAnswerSystemAddon === 'function')
        ? window.buildRefAnswerSystemAddon(refAnswer)
        : '';
    return SYSTEM_CHEM + detailAddon + followAddon + scopeAddon + refAddon;
};

window.buildFollowUpUserText = function(followText, opts) {
    opts = opts || {};
    var q = String(followText || '').trim();
    var followIntent = parseSolveIntent(q);
    var parts = [
        buildScopeLockUserBlock(followIntent, opts),
        '【追問作答｜須符合上方詳解之板書風格與教學規定】',
        '學生追問：' + q,
        '',
        '【追問硬性要求】',
        '1. 只回答所問，2～8 行；數字與化學式須在 $…$ 等號式或算式中，禁止裸寫 \\text{}、_ 下標。',
        '2. 須重讀本則與前文 [教學規定]、[NOTE 附錄]；觸發的規定必須遵守，禁止改用題外公式。',
        '3. 混成：若寫出混成種類，須先標中心原子，再用規定 (a) σ＋lp、(b) π 鍵數、(c) 價電子 ÷8 再餘數 ÷2 之一展示計數；禁止 $V+X-q$、禁止總價電子 $\\div 2$ 直接當混成軌域數。',
        '4. 追問若**明確要求**看結構，須 @@MOL:物種id|標籤@@ 獨立成行；否則可以文字簡答。',
        '5. 末尾另起一行 @@ANSWER@@ 後寫一行簡答（如 $sp^3$ 或 (E)）。',
        '6. 禁止複述教學規定標題、禁止社交廢話、禁止重解整題。'
    ];
    if (opts.detailed) {
        parts.push('6. 【詳細模式】追問亦須先 1～2 句概念再進推導。');
    }
    var rules = String(opts.rulesBlock || '').trim();
    if (rules) parts.push('', rules);
    var note = String(opts.noteBlock || '').trim();
    if (note) parts.push(note);
    return parts.join('\n');
};

/** 追問板書／混成規定檢查 */
window.checkFollowUpBoardStyle = function(text) {
    var issues = [];
    var body = String(text || '');
    if (/V\s*\+\s*[MX]\s*[-－]\s*[Qq]/.test(body)) {
        issues.push('混成追問禁止使用 V+X-q（或 V+M-q）公式，須改用 [教學規定] 之 (a)(b)(c) 法。');
    }
    if (/混成軌域\s*=\s*[^\n]*\/\s*2\s*=>/.test(body) && !/(÷\s*8|\/\s*8)/.test(body)) {
        issues.push('價電子法須先 ÷8 得 σ 鍵數、餘數 ÷2 得 lp，禁止總價電子 ÷2 直接當混成軌域數。');
    }
    if (/電子對數\s*=\s*\d+\s*\/\s*2/.test(body) && /混成|sp[\^³²\d]|sp3|sp2/.test(body) && !/(÷\s*8|\/\s*8)/.test(body)) {
        issues.push('禁止以「電子對數＝總價電子 ÷2」簡算混成；須用 (c) 法 ÷8 再 ÷2。');
    }
    var mentionsHybrid = /混成|sp[\^³²]?d?\^?\d*|sp3\b|sp2\b|sp³|sp²/.test(body);
    var hasMethod = /(σ|西格瑪|sigma).*(孤對|lp)|孤對.*(σ|西格瑪)|π\s*鍵|÷\s*8|\/\s*8\s*=/.test(body);
    if (mentionsHybrid && !hasMethod) {
        issues.push('寫出混成種類須先展示 (a) σ＋lp、(b) π 鍵數 或 (c) 價電子 ÷8÷2 之計數過程，不可只給結論。');
    }
    if (!/@@ANSWER@@/.test(body)) {
        issues.push('追問末尾須 @@ANSWER@@ 一行簡答。');
    }
    var stripped = body.replace(/\$\$[\s\S]+?\$\$/g, '').replace(/\$[^$\n]+\$/g, '');
    if (/\\(?:text|mathrm)\{/.test(stripped)) {
        issues.push('禁止裸寫 \\text{}／\\mathrm{}，須包在 $…$ 內。');
    }
    return issues;
};

window.buildFollowUpStyleFixUserText = function(issues) {
    return '【追問板書修正】' + (issues || []).join(' ')
        + ' 請改寫本則追問答覆：遵守 [教學規定] 混成三法之一並寫出計數；末尾 @@ANSWER@@；邏輯與答案保持正確，禁止 MATCH 註解。';
};

var buildFollowUpUserText = window.buildFollowUpUserText;
var buildSolveUserText = window.buildSolveUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;

/** 參考詳解中的結構圖行數（@@MOL 或 @@SMILES） */
function countStructureLines(text) {
    return (String(text || '').match(/@@(?:MOL|SMILES):/gi) || []).length;
}

/** 詳解是否屬「須畫結構」類型（啟發式；Tier 1 且參考無結構圖時不觸發） */
function solutionNeedsStructure(body, refText) {
    if (/@@(?:MOL|SMILES)/i.test(body)) return false;
    var ref = String(refText || '');
    if (ref.trim() && countStructureLines(ref) === 0) return false;
    return /路易斯|共振結構|結構式|分子形狀|分子\/離子形狀|八隅體|孤對電子|平面分子|畫出.*結構|鍵線|混成軌域|混成.*sp|VSEPR|角形|三角錐|四面體|直線形|具有共振|中心原子.*孤對/.test(body);
}

/** 選項是否為純數字／序號（問「哪一個數字」類） */
window.isNumericOptionPickContext = function(text) {
    var s = String(text || '');
    if (/何者正確|何者錯誤|哪些敘述|下列敘述|敘述.*(?:正確|錯誤)|判斷.*(?:正確|錯誤)/.test(s)) {
        return false;
    }
    if (/(?:下列|何者|哪一個).{0,20}(?:數字|數值|莫耳數|濃度|質量|體積|壓力|pH|溫度)/.test(s)
        || /選出.{0,12}(?:數|值|答案)/.test(s)) {
        var numOpts = (s.match(/(?:\(|（)[A-E](?:\)|）)\s*[\d.]+/g) || []).length;
        if (numOpts >= 2) return true;
    }
    if (/(?:\(|（)[A-E](?:\)|）)\s*1[\s、,，]|(?:\(|（)[A-E](?:\)|）)\s*2[\s、,，]/.test(s)
        && /(?:\(|（)[A-E](?:\)|）)\s*[345]/.test(s)) {
        return true;
    }
    return false;
};

/** 是否須 (A)～(E) 逐項完整評析 */
window.needsFullChoiceOptionAnalysis = function(text) {
    var s = String(text || '');
    if (window.isNumericOptionPickContext(s)) return false;
    if (typeof window.isConceptualJudgmentContext === 'function' && window.isConceptualJudgmentContext(s)) {
        return true;
    }
    return /何者正確|何者錯誤|哪些.{0,8}正確|下列敘述|多選|可選出|選出.*(?:二|三|多|個)|除.{1,30}外.*皆/.test(s);
};

/** 選擇題是否缺 (A)～(E) 評析 */
function checkChoiceCoverage(text, questionCtx) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    var qctx = String(questionCtx || '') + '\n' + body.slice(0, 1200);
    var optCount = (body.match(/(?:^|\n)\s*\([A-E]\)/gm) || []).length;
    if (typeof window.needsFullChoiceOptionAnalysis === 'function'
        && !window.needsFullChoiceOptionAnalysis(qctx)
        && !/各選項分析/.test(body) && optCount < 3) {
        return issues;
    }
    if (!/\([A-E]\)/.test(body) && !/各選項分析/.test(body)) return issues;

    var found = {};
    'ABCDE'.split('').forEach(function(ch) {
        if (new RegExp('(?:^|\\n)\\s*\\*?\\s*\\(' + ch + '\\)', 'm').test(body)
            || new RegExp('(?:^|\\n)\\s*\\(' + ch + '\\)', 'm').test(body)) {
            found[ch] = true;
        }
    });
    var foundCount = Object.keys(found).length;
    if (foundCount < 2) return issues;

    var miss = 'ABCDE'.split('').filter(function(ch) { return !found[ch]; });
    if (miss.length >= 1) {
        issues.push('多選敘述題須逐項評析 (A)～(E)，缺少：(' + miss.join(')(') + ')；請用「各選項分析如下：」後每項獨立一行以 (A) 開頭。');
    }
    if (!/各選項分析/.test(body) && foundCount >= 3) {
        issues.push('多選敘述題須先寫「各選項分析如下：」再逐項 (A)～(E)。');
    }
    return issues;
}

/** 對照參考詳解檢查段落／選項版型（僅參考模式：不強制對齊） */
function checkLayoutAgainstReference(text, refText) {
    return [];
}

/** 對照參考詳解檢查符號／版式（僅參考模式：不強制對齊） */
function checkNotationAgainstReference(text, refText) {
    return [];
}

/** 檢查同一行多個算式是否缺少標點分隔 */
function checkFormulaPunctuation(text) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    body.split('\n').forEach(function(line) {
        var t = line.trim();
        if (!t || /^\([A-E]\)/.test(t) || /^\*\s*\([A-E]\)/.test(t)) return;
        var parts = t.match(/\$[^$]+\$/g);
        if (!parts || parts.length < 2) return;
        for (var i = 0; i < parts.length - 1; i++) {
            var end = t.indexOf(parts[i]) + parts[i].length;
            var between = t.slice(end, t.indexOf(parts[i + 1]));
            if (!/[；;，,、。故可得則且而]|\\implies|\\\\Rightarrow/.test(between)) {
                issues.push('同一行多個 $…$ 算式須以「；」「，」「故」等標點隔開（有標點可併排同行；禁止無標點緊貼）。');
                return;
            }
        }
    });
    return issues;
}

/** 觀念題：關鍵數值須有 NOTE */
function checkConceptNoteCoverage(text) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    if (!/\([A-E]\)/.test(body)) return issues;
    var noteCount = (body.match(/\\htmlData\{/g) || []).length;
    var hasKeyNumbers = /(?:pH|%\s|莫耳|濃度|比例|體積比|\d+\s*%)/i.test(body);
    if (hasKeyNumbers && noteCount < 2) {
        issues.push('觀念題關鍵數值須標 NOTE：在 $…$ 內用 $\\htmlData{note=白話短註}{數值或比例}$（至少 2 處，如 pH、百分比、莫耳比）。');
    }
    return issues;
}

/** 未命中資料庫時檢查 NOTE 密度 */
function checkNoteDensityWithoutReference(text) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    if (!body.trim()) return issues;

    var eqLineCount = 0;
    body.split('\n').forEach(function(line) {
        var t = line.trim();
        if (!t) return;
        if (/^\$\$[\s\S]+\$\$$/.test(t) && /[=＝≈]/.test(t)) { eqLineCount += 2; return; }
        if (/\$[^$]+[=＝≈][^$]+\$/.test(t)) eqLineCount++;
    });

    var noteCount = (body.match(/\\htmlData\{/g) || []).length;
    var noteFloor = Math.max(5, Math.ceil(eqLineCount * 0.85));
    if (eqLineCount >= 2 && noteCount < noteFloor) {
        issues.push('NOTE 密度不足：含等號推導須在式內補足 $\\htmlData{note=白話短註}{…}$（每行約 2 個；乘積因子、分式分子分母、中間量分標），不可只標最終結果。');
    }
    return issues;
}

/** 反應式是否為不合格的抽象通式 */
function isAbstractReactionFormula(body) {
    return /X_[a-z]Y_[a-z]|X_mY|kY_2|Y_\{2k\}|產物分子式為\s*\$X_|設產物.*X_[a-z]Y_/.test(body)
        || /\\frac\{\\s*[a-zA-Z]\s*\}\{\\s*[a-zA-Z]\s*\}.*Y_2|\\frac\{\\s*2\s*\}\{\\s*a\s*\}/.test(body);
}

/** 觀念判斷題（純敘述正誤，不含須追蹤物種量之計算） */
window.isConceptualJudgmentContext = function(text) {
    var s = String(text || '');
    if (/K_\{sp\}\s*=|Ksp\s*=\s*[\d.]|溶解度積\s*=\s*[\d.]/.test(s)) return false;
    if (/(?:求|試問|計算).{0,16}(?:莫耳|濃度|質量|體積|壓力|多少|若干)/.test(s) && /\d/.test(s)) return false;
    if (/混合.{0,24}(?:溶液|硝酸銀|鹽酸|Ag\+|Cl\-)/.test(s) && /\d/.test(s)) return false;
    if (/\\(?:rightleftharpoons|rightarrow)|平衡常數|解離度|限量|反應計量|莫耳數比/.test(s) && /\d/.test(s)) return false;
    if (/\[[^\]]+\]/.test(s) && /K\s*=|平衡/.test(s)) return false;
    return /何者正確|何者錯誤|哪些敘述|下列敘述|何者為非|何者不適|何者不恰|敘述.*(?:正確|錯誤)|判斷.*(?:正確|錯誤)|除.{1,30}外|選出.*正確/.test(s)
        || (/(?:沸騰|汽化|蒸氣壓|昇華|凝結|表面張力|依數性|氧化力|能量守恆|電子組態|光譜)/.test(s)
            && !/K_\{sp\}|溶解度積|限量試劑|莫耳數比|體積比|混合.{0,12}(?:溶液|稀釋)/.test(s));
};

/** 是否須 Ksp 沉澱四列表（嚴格；觀念題一律 false） */
window.needsKspPrecipitationTable = function(text) {
    if (window.isConceptualJudgmentContext(text)) return false;
    var s = String(text || '');
    return /K_\{sp\}|Ksp|溶解度積|離子積/.test(s)
        && /(?:AgCl|AgI|PbI|BaSO|CaF|難溶|沉澱|混合.{0,40}(?:溶液|稀釋|mL)|完全向左)/.test(s);
};

/** 實驗式／莫耳比／沉澱換算類（通常不需 ICE 表） */
function isMoleRatioOrEmpiricalStyle(text) {
    var s = String(text || '');
    if (/限量試劑|限量|體積比|氣體體積比|後來體積|原來體積|平衡.*α|\\\\alpha|轉化率.*壓|K_p|K_c|解離度/.test(s)) {
        return false;
    }
    return /實驗式|分子式與實驗式|莫耳比|化合量|倍比定律|沉澱|CaCO|碳酸鈣|質量守恆.*莫耳|n_\{?[A-Za-z]+\}?\/n_|W_\{?[A-Za-z]+\}?.*莫耳|氧化物.*還原/.test(s);
}

/** 本題脈絡是否須要求反應變化表 */
function questionContextNeedsReactionTable(body, refText, questionCtx) {
    var combined = String(questionCtx || '') + '\n' + String(body || '') + '\n' + String(refText || '');
    if (/\\(?:rightleftharpoons|rightarrow)|平衡常數|解離度|限量|反應計量|反應變化表|反應式如下/.test(combined)) return true;
    if (/\[[^\]]+\]/.test(combined) && /K\s*=|平衡/.test(combined)) return true;
    if (typeof window.isConceptualJudgmentContext === 'function' && window.isConceptualJudgmentContext(combined)) {
        return false;
    }
    if (isMoleRatioOrEmpiricalStyle(combined)) return false;
    if (/限量試劑|限量|莫耳數比.*表|體積比|氣體.*反應|平衡常數|解離度|反應變化表|後來體積|原來體積|逐選項.*反應/.test(combined)) {
        return true;
    }
    if (/Ksp|K_\{sp\}|溶解度積|AgCl.*混合|混合.*AgCl/.test(combined)) {
        return true;
    }
    if (/反應式如下/.test(body) && /\\(?:rightleftharpoons|rightarrow)/.test(body) && !isMoleRatioOrEmpiricalStyle(body)) {
        return true;
    }
    return false;
}

/** 取出反應表某一列（起始／變化／結果） */
function getReactionTableRow(block, labels) {
    var list = Array.isArray(labels) ? labels : [labels];
    for (var i = 0; i < list.length; i++) {
        var re = new RegExp('\\\\text\\{' + list[i] + '\\}([^\\\\]*(?:\\\\\\\\[^\\\\]*)*)');
        var m = block.match(re);
        if (m) return m[1];
    }
    return '';
}

/** 反應表數值是否與表前推導不一致（示範數 1、2 或結果未化簡） */
function checkReactionTableNumericConsistency(text) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    var arrayIdx = body.search(/\\begin\{array\}/);
    if (arrayIdx < 0) return issues;

    var beforeArray = body.slice(0, arrayIdx);
    var arrayEnd = body.indexOf('\\end{array}', arrayIdx);
    var arrayBlock = arrayEnd > arrayIdx
        ? body.slice(arrayIdx, arrayEnd)
        : body.slice(arrayIdx);

    if (!/\\text\{(?:起始|初始)\}/.test(arrayBlock)) return issues;

    var startRow = getReactionTableRow(arrayBlock, ['起始', '初始']);
    var changeRow = getReactionTableRow(arrayBlock, ['變化', '變']);
    var resultRow = getReactionTableRow(arrayBlock, ['結果', '平衡', '平']);

    var decBefore = (beforeArray.match(/0\.\d+/g) || []).length;
    var hasTemplateStart = /&\s*1\s*&/.test(startRow) && /&\s*2\s*&/.test(startRow);
    var changeHasDecimal = /-\s*0\.\d+/.test(changeRow);
    var resultUnreduced = /\d+\s*-\s*0?\.\d+/.test(resultRow);

    if (hasTemplateStart && (decBefore >= 2 || changeHasDecimal)) {
        issues.push('反應表起始列誤用示範數 1、2；須改為表前已算濃度／莫耳數（與上文等號式一致），禁止占位數。');
    }
    if (resultUnreduced) {
        issues.push('反應表結果列須寫化簡數值（如 $0$、$0.080$），禁止寫 $1-0.020$ 等未代入算式。');
    }
    return issues;
}

/** 計算 array 內列數（以 \\\\ 分隔） */
function countArrayRows(arrayBlock) {
    var inner = String(arrayBlock || '');
    var m = inner.match(/\\begin\{array\}[\s\S]*?\{([\s\S]*)\}\\end\{array\}/);
    if (!m) return 0;
    return m[1].split('\\\\').filter(function (s) { return s.replace(/\\hline/g, '').trim().length; }).length;
}

/** 反應式如下：缺 array 或資料列不足（通用 rxn-grid） */
function checkReactionTableRowLabels(text, refText, questionCtx) {
    var issues = [];
    var q = String(questionCtx || '') + '\n' + String(text || '').slice(0, 500);
    if (typeof window.isConceptualJudgmentContext === 'function' && window.isConceptualJudgmentContext(q)) {
        return issues;
    }
    var body = String(text || '').split('@@ANSWER@@')[0];
    if (!/反應式如下/.test(body) || !/\\rightleftharpoons/.test(body)) return issues;

    var arrays = body.match(/\\begin\{array\}[\s\S]*?\\end\{array\}/g) || [];
    var rxnArray = null;
    for (var i = 0; i < arrays.length; i++) {
        if (/\\rightleftharpoons/.test(arrays[i])) { rxnArray = arrays[i]; break; }
    }
    if (!rxnArray) {
        issues.push('反應式如下：須緊接單一 $$\\begin{array}…\\end{array}$$；禁止拆成多行裸數字。');
        return issues;
    }
    var rowCount = countArrayRows(rxnArray);
    var dataRows = Math.max(0, rowCount - 1);
    if (dataRows < 3) {
        issues.push('反應變化表須 3～4 行對齊資料列（起始／變化／結果等）；第一欄可用 \\text{起始} 標籤或省略，但欄數須與反應式列相同。');
    }
    if (!/\\hline/.test(rxnArray) && dataRows >= 2) {
        issues.push('反應變化表最末資料列前須加 \\hline（分離結果／平衡列）。');
    }
    return issues;
}

window.KSP_REACTION_TABLE_FORMAT_BLOCK = [
    '【本題｜反應變化表強制格式（數值依題重算；列標逐字照抄，禁省略）】',
    '反應式如下：',
    '$$\\begin{array}{ccccc}',
    'AgCl_{(s)} & \\rightleftharpoons & Ag^+ & + & Cl^- \\\\',
    '\\hline',
    '\\text{起始} & 0 & & \\text{（抄表前 }[Ag^+]_0\\text{）} & & \\text{（抄表前 }[Cl^-]_0\\text{）} \\\\',
    '\\text{完全向左} & +\\text{（限量量）} & & -\\text{（限量量）} & & -\\text{（限量量）} \\\\',
    '\\text{再向右} & -x & & +x & & +x \\\\',
    '\\hline',
    '\\text{平衡} & \\text{（固相平衡量）} & & x & & \\text{（平衡 }[Cl^-]\\text{）} \\\\',
    '\\end{array}$$',
    '中間步驟列（完全向左、再向右）須寫變化量（帶正負號）；平衡列寫最終量。禁止把沉澱後快照寫在完全向左列。',
].join('\n');

/** @deprecated 併入 checkReactionTableRowLabels */
function checkKspReactionTableShape(text, refText) {
    return checkReactionTableRowLabels(text, refText);
}

/** 觀念題誤套 Ksp 專用表（已停用，直接通過） */
function checkMisplacedReactionTableOnConcept(text, questionCtx) {
    return [];
}

/** 反應變化表是否缺必要列（至少起始、變化相關、結果） */
function checkReactionTableRequired(text, refText, questionCtx) {
    var issues = [];
    var qctx = String(questionCtx || '');
    var combined = qctx + '\n' + String(text || '');
    var body = String(text || '').split('@@ANSWER@@')[0];
    if (!/\\(?:rightleftharpoons|rightarrow)/.test(body)) {
        if (/\[[^\]]+\].*\[[^\]]+\]/.test(body) && /K\s*=|平衡常數|\\dfrac\{[^}]*\[[^\]]+\]/.test(body)) {
            issues.push('須先寫配平反應式（$…\\rightleftharpoons…$ 或「反應式如下：」+ array）；禁止只有濃度算式沒有反應式。');
        }
    }
    if (typeof window.isConceptualJudgmentContext === 'function' && window.isConceptualJudgmentContext(combined)) {
        return issues;
    }
    if (!body.trim()) return issues;

    var hasArray = /\\begin\{array\}/.test(body);
    var hasReaction = /\\(?:rightleftharpoons|rightarrow)/.test(body);
    var needsTable = questionContextNeedsReactionTable(body, refText, questionCtx);
    var optionJudgment = /\([A-E]\)/.test(body) && /\\rightleftharpoons/.test(body)
        && /後來體積|原來體積|可能為何|體積比/.test(body);

    var hasStartRow = /\\text\{起始\}|\\text\{初\}|\\text\{I\}|起始\s*&/.test(body);
    var hasChangeRow = /\\text\{變化\}|\\text\{變\}|\\text\{C\}|\\text\{移至左\}|\\text\{移至右\}|\\text\{完全反應\}|\\text\{完全向左\}|\\text\{再向右\}|變化\s*&/.test(body);
    var hasResultRow = /\\text\{結果\}|\\text\{E\}|\\text\{平\}|\\text\{平衡\}|結果\s*&/.test(body);
    var arrayBlocks = body.match(/\\begin\{array\}[\s\S]*?\\end\{array\}/g) || [];
    var rxnBlock = '';
    for (var ai = 0; ai < arrayBlocks.length; ai++) {
        if (/\\(?:rightleftharpoons|rightarrow)/.test(arrayBlocks[ai])) { rxnBlock = arrayBlocks[ai]; break; }
    }
    var dataRowCount = rxnBlock ? Math.max(0, countArrayRows(rxnBlock) - 1) : 0;
    var gridOk = dataRowCount >= 3 && /\\hline/.test(rxnBlock);

    if (hasArray && hasReaction && !gridOk && !hasStartRow && hasChangeRow) {
        issues.push('反應變化表缺「起始」列或資料列不足：須 3～4 行對齊資料，或標 \\text{起始}／\\text{變化}／\\text{結果}。');
    }

    if (hasArray && hasReaction && hasChangeRow && !hasResultRow && !gridOk) {
        issues.push('反應變化表缺「結果」列：須寫齊 \\text{結果}；多步驟時 \\hline 放在最末資料列之前。');
    }

    if (hasArray && hasReaction && isAbstractReactionFormula(body)) {
        issues.push('反應式須寫已配平具體化學式；禁止設 $X_aY_b$ 通式、禁止反應式含 $\\frac{b}{a}$ 等抽象係數。選項驗證題應逐選項寫配平反應式。');
    }

    if (!needsTable && !(hasArray && hasReaction) && !optionJudgment) return issues;

    if (!hasArray || (!gridOk && (!hasStartRow || !hasChangeRow || !hasResultRow))) {
        issues.push('須在「反應式如下：」後緊接完整 array（反應式＋3～4 行對齊資料；可用 \\text{起始}／\\text{變化}／\\text{結果} 或省略標籤）；最末資料列前加 \\hline。');
    }
    return issues;
}

/** 檢查敘述句裸寫化學式（SO3 等） */
function checkBareChemicalFormulas(text) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    if (/(?<![$\w])([A-Z][a-z]?(?:_\d+|\d+)+)(?![A-Za-z$])/.test(body.replace(/\$[^$]+\$/g, ''))) {
        issues.push('化學式須寫 $Cl_2$、$H^+$ 等數學斜體（禁 $\\mathrm{}$、$\\text{}$ 包元素）；反應表列標籤仍用 $\\text{起始}$ 等。');
    }
    return issues;
}

/** 檢查板書常見違規（裸數字開場、推導過短、缺結構圖、符號未克隆等） */
window.checkSolutionBoardStyle = function(text, refText, questionCtx) {
    var issues = [];
    var body = String(text || '');
    var qctx = String(questionCtx || '');
    if (!/@@ANSWER@@/.test(body)) {
        issues.push('回覆末尾需要 @@ANSWER@@。');
    }
    if (/(化學勢|配分函數|partition function|Gibbs[-\s]?Duhem|薛丁格|Schrodinger)/i.test(body)) {
        issues.push('請改用高中課綱可接受的方法，不要使用大學層級推導。');
    }
    if (typeof parseRequestedSolveScope === 'function') {
        var scope = parseRequestedSolveScope(qctx);
        if (scope.mode === 'partial' && scope.numbers.length >= 1) {
            var miss = [];
            scope.numbers.forEach(function(n) {
                var re = new RegExp('第\\s*' + n + '\\s*題');
                if (!re.test(body)) miss.push(n);
            });
            if (miss.length) {
                issues.push('多題漏答：缺少第 ' + miss.join('、') + ' 題分段。');
            }
            var allHeadings = [];
            var hm;
            var headingRe = /第\s*(\d{1,2})\s*題/g;
            while ((hm = headingRe.exec(body)) !== null) {
                allHeadings.push(Number(hm[1]));
            }
            var unexpected = allHeadings.filter(function(n) { return scope.numbers.indexOf(n) < 0; });
            if (unexpected.length) {
                issues.push('題號標題錯誤：出現非指定題號（第 ' + unexpected.join('、') + ' 題）。');
            }
            if (scope.numbers.length === 1 && /第\s*[123]\s*題/.test(body) && scope.numbers[0] !== 1 && scope.numbers[0] !== 2 && scope.numbers[0] !== 3) {
                issues.push('步驟標題誤寫成題號：請改用「步驟1/步驟2」或直接條列。');
            }
        } else {
            var stepHeadingRe = /(?:^|\n)\s*第\s*(\d{1,2})\s*題\s*(?:\n|$)/g;
            var stepHeadings = [];
            var sh;
            while ((sh = stepHeadingRe.exec(body)) !== null) {
                stepHeadings.push(Number(sh[1]));
            }
            if (stepHeadings.length >= 2) {
                issues.push('單題解題禁止用「第N題」當步驟標題；請刪除這些標題，直接寫推導式。');
            }
        }
    }
    if (/\$[^$\n]+\$\s*\$[^$\n]+\$/.test(body)) {
        issues.push('連續算式缺少標點分隔。');
    }
    if (/[A-Za-z0-9_)\]}]\s*~\s*[A-Za-z0-9_({\[]/.test(body)) {
        issues.push('請勿使用 ~ 表示比值或關係。');
    }
    if (/\\htmlData\{note=[^}]*\}\{[^}]*97(?:\.0+)?\s*\\times\s*10\^\{-?3\}[^}]*\}/.test(body)) {
        issues.push('單位換算 NOTE 請拆開：97 與 10^{-3} 需分開標註。');
    }
    if ((/r['′]\s*\/\s*r|r\s*\/\s*a|\\dfrac\{r['′]/.test(body) || /速率比|初速率/.test(body))
        && (/\\dfrac\{[^}]*k[^}]*\}\{[^}]*V\^?2[^}]*\}/.test(body)
            || (/\\dfrac\{[^}]*\}\{[^}]*V\^2[^}]*\}/.test(body) && /\\cdot\\dfrac/.test(body) && !/\\dfrac\{[^}]*\}\{[^}]*\}\\cdot\\dfrac\{[^}]*\}\{[^}]*\}/.test(body)))) {
        issues.push('速率比較式：分母須與分子對稱展開（$k\\cdot\\dfrac{n}{V}\\cdot\\dfrac{n}{V}$），禁止預先合併成 $\\dfrac{4k}{V^2}$ 單一分式。');
    }
    if (/\$[^$]*=\s*\\dfrac[^$]*,\s*\\quad\s*\\text\{\s*故/.test(body)) {
        issues.push('結論「故」前須用全形逗號：\\text{，}\\quad\\text{故 }，勿用半形 ,');
    }
    if (/\$[^$]*[0-9\)]\\?[^$，,;；\s]{0,6}故/.test(body) || /\$[^$]*=\s*\\dfrac[^$]*[^,，\s]故/.test(body)) {
        issues.push('結論「故」前須寫 \\text{，}\\quad\\text{故 }，勿與算式緊貼。');
    }
    if (/\\dfrac\{[^}]*\\dfrac/.test(body) && /\\frac\{/.test(body.split('@@ANSWER@@')[0])) {
        issues.push('巢狀分式內層須全用 \\dfrac，禁止混用 \\frac。');
    }
    issues = issues.concat(checkReactionTableRequired(body, refText, questionCtx));
    issues = issues.concat(checkReactionTableRowLabels(body, refText, questionCtx));
    issues = issues.concat(checkReactionTableNumericConsistency(body));
    issues = issues.concat(checkMisplacedReactionTableOnConcept(body, questionCtx));
    issues = issues.concat(checkBareChemicalFormulas(body));
    issues = issues.concat(checkChoiceCoverage(body, questionCtx));
    return issues;
};

window.buildBoardStyleFixUserText = function(issues) {
    var list = (issues || []).join(' ');
    if (/請勿使用 ~ 表示比值或關係/.test(list)) {
        return '【修正｜表達】請把 `~` 改為一般敘述（如「1 : 4」「每 1 莫耳...可消耗 4 莫耳...」），其餘內容保持不變並保留 @@ANSWER@@。';
    }
    if (/單位換算 NOTE 請拆開/.test(list)) {
        return '【修正｜NOTE 拆分】單位換算請將 $97.0$ 與 $10^{-3}$ 分開成兩個 NOTE，不可寫成單一 NOTE（例如 $\\htmlData{note=溶液體積mL}{97.0}\\times\\htmlData{note=mL轉L}{10^{-3}}$）。其餘內容保持不變並保留 @@ANSWER@@。';
    }
    if (/連續算式缺少標點分隔/.test(list)) {
        return '【修正｜標點】連續化學式與算式之間請加入「，」「；」「故」等標點，避免多個反應式或等式直接黏在一起；其餘內容保持不變並保留 @@ANSWER@@。';
    }
    if (/單題解題禁止用「第N題」當步驟標題/.test(list)) {
        return '【修正｜步驟標題】這是單題解題，請刪除所有「第1題、第2題…」標題行，改為連續推導式；禁止用題號當步驟。保留正確計算與 @@ANSWER@@。';
    }
    if (/多題漏答|題號標題錯誤|非指定題號/.test(list)) {
        return '【修正｜多題分段】' + list + ' 請重寫為「第 N 題」分段格式，指定幾題就寫幾段；不得用第1/2/3題當步驟標籤。每段都要有該題推導與結論，最後保留 @@ANSWER@@。';
    }
    if (/分母須與分子對稱展開|預先合併成/.test(list)) {
        return '【修正｜巢狀分式】速率比較式分母須與分子對稱展開：上下皆寫 $k\\cdot\\dfrac{莫耳數}{體積}\\cdot\\dfrac{莫耳數}{體積}$，禁止分母寫成 $\\dfrac{4k}{V^2}$ 等預先合併式；約分只放在最後一步。其餘推導與 @@ANSWER@@ 不變。';
    }
    if (/結論「故」前須用全形逗號|結論「故」前須寫/.test(list)) {
        return '【修正｜排版】結論改寫為 $=\\dfrac{9}{16}\\text{，}\\quad\\text{故 }r\'=\\dfrac{9}{16}a$：用全形 $\\text{，}$（非半形 ,）再接 \\quad\\text{故 }。其餘推導不變，保留 @@ANSWER@@。';
    }
    if (/巢狀分式內層須全用/.test(list)) {
        return '【修正｜分式】巢狀分式外層與內層一律改 \\dfrac；$\\cdot$ 前後留空。其餘推導不變，保留 @@ANSWER@@。';
    }
    if (/多選敘述題須逐項評析|各選項分析如下/.test(list)) {
        return '【修正｜選項排版】' + list
            + '\n請依題複雜度開場，再寫「各選項分析如下：」。'
            + '每項獨立一行，行首 (A)～(E)；最後「故答案為 …」並保留 @@ANSWER@@。';
    }
    if (/須先寫配平反應式/.test(list)) {
        return '【修正｜反應式】' + list
            + '\n開場或推導前須寫配平反應式（行內 $A+B\\rightleftharpoons C$ 或「反應式如下：」+ array）。'
            + '其餘推導與 @@ANSWER@@ 不變。';
    }
    if (/反應變化表|反應式如下|須在「反應式如下」|3～4 行對齊|推導須追蹤反應物種量/.test(list)) {
        var gridHint = (typeof window.BoardFormats !== 'undefined' && window.BoardFormats.getRxnGridFormatSpec)
            ? window.BoardFormats.getRxnGridFormatSpec()
            : '';
        return '【修正｜反應表｜rxn-grid】' + list
            + '\n請補「反應式如下：」後接單一 $$\\begin{array}…\\end{array}$$：'
            + '第 1 列配平反應式；第 2～4 列對齊起始／變化／結果（欄數與反應式相同）；最末資料列前 \\hline。'
            + (gridHint ? '\n\n' + gridHint : '')
            + '\n數值依題重算，保留 @@ANSWER@@。';
    }
    return '【修正】' + list + ' 請用更自然、精簡的高中化學講解重寫；保留正確推導並在最後加入 @@ANSWER@@。';
};