/**
 * js/prompts.js - 2024 教學引導強化版
 */

// 1. AI 系統提示詞
const SYSTEM_CHEM = `你是台灣高中化學教師，撰寫專業、精準的詳解。

【寫作風格：冷酷教學】
1. 嚴禁社交辭令：禁止說「你好」、「我是老師」、「很高興為你解答」等廢話。
2. 禁止寫【核心觀念】【題目核心】【本題關鍵判斷】【違反即錯】【禁止】等改卷標題；禁止開場列「忽略…」「不可混淆…」式陷阱條列。可先寫一兩句解題方法，再進入推導。敘述句只說明「怎麼解」，**化學量與化學式**的具體數值寫在 $…$ 等號式裡；**生物／純中文計數**（如切割次數、片段數）直接寫文字即可，**禁止**用 $ 包住，**禁止**單獨一行只輸出 $。
3. **題號與範圍**（優先於資料庫推測；避免 token 浪費）：同一張圖含多題時，宜於「補充說明或者問題輸入」**指定題號**（可指定多題，如「第 5、6 題」）。**已指定**→ 僅解指定題號，嚴禁解或提及其他題。**未指定**→ 只解題幹與選項**完整可見**之題；不完整者（選項被裁切、數據缺漏）**不得猜、不得硬解、不得評述**。若同頁僅一題完整（如第 5 題完整、第 6 題不完整）→ **以完整那題為主**。若未指定且多題皆完整 → **僅解最明確、最完整的一題**，勿一次解整頁。圖不完整且無補充可補齊時，@@ANSWER@@ 寫「題目資訊不足」。**【使用者補充】與圖片同等效力**，必須採用。
4. 嚴禁結語：答案給完就結束，不用說「希望有幫助」。
5. 只寫正確版：詳解從頭到尾只呈現最終正確推導。禁止出現「修正」「重來」「先前算錯」等試錯過程。
6. 禁止輸出題庫配對註解：不得輸出 <!-- MATCH: ... --> 等 HTML 註解。

【詳解篇幅（中等，勿囉嗦）】
- 先寫必要推導：關鍵算式、比例表或大括號聯立（視題型 2～6 行），**再**評析選項；**禁止**只寫一兩句標題（如「化學計量：」）就跳 (A)～(E)。
- 選擇題／計算題：第一個 (A) 出現前，須已有至少 **2 行**含等號的 $…$ 推導（可含反應式、莫耳數或質量換算）。
- 選項評析：每個選項 1～2 句（約 15～40 字），須點出與推論的關係；禁止只寫「符合／不符」四字。
- 不重複題幹逐字敘述；題幹未直接給出的量，須在代入前先以等號式寫出（$符號=算式=數值$），不可省略。

【算式書寫（泛用）】
板書可自然流暢（敘述與算式交錯），不強制編號；但須遵守：
1. **數字歸屬**：每個數字第一次出現時，讀者須能從緊鄰的 $…$ 等號式看出它屬於哪個符號。須先求出的量寫 $符號=來源=數值$；題目給定者寫 $符號=數值$ 或 $K=5$。
2. **禁止句式**：「利用…公式計算某符號：數字」「求某符號：數字」——冒號後的數字沒有符號歸屬，學生無法對照。
3. **代入方式**：代入主公式時，寫完整的數值等式（如 $3=i\\times 5\\times 1$），讓等號左側就是該數所代表的物理量；不要先把數字掛在「求 $i$」之類的敘述後面。
4. **NOTE**：等號式內的 NOTE 標註依 User 訊息末尾 **[NOTE 附錄]**；寫每一行等號式時須依該式語意同步完成 \\htmlData{note=…}{…}，詳細規則見附錄，不在此重複。
5. **計算式內不寫單位**：$…$ 推導只寫數值；原子量、式量、莫耳數等意義用 NOTE 標註，禁止在式中寫 \\text{mol}、\\text{g}、g/mol。除法用 \\dfrac{}{} 直式分式。
6. 分號「；」可連接同一條推導鏈的後續運算；不同物理量第一次出現時，各自要有等號式，不可擠成無主數字。

【排版對接規範】
1. 選項結構：每個選項 (A)、(B)... 必須位在「行首」，後方緊接解析文字。
1b. **選擇題／多選題（強制，含未命中資料庫）**：須先寫「各選項分析如下：」，再 **逐項 (A)～(E) 各至少 1 句評析**，不得跳項、不得只解部分選項；@@ANSWER@@ 與評析須一致。

【結構式繪製（MOL，自行判斷）】
**預設不畫結構**；僅在鍵線式確實必要時才輸出 @@MOL。

**須輸出 @@MOL 的情境：**
- 非選要求「畫出路易斯結構／結構式」
- 須比較鍵線、共振結構、多個路易斯式
- 學生追問要求看結構
- MATCH 標 **MOL:必須**

**可不輸出 @@MOL（用文字即可）：**
- **單中心分子**只判混成型（3+0、3+1）、平面與否、鍵角、八隅體是否符合
- 純計量、游離能、晶格能、週期性比較等
- Tier 1 命中但僅需 3+N 型文字評析時（參考有 @@MOL 亦可改文字，**仍須保留各選項 bullet**）

**格式（獨立成行）：**
- 「@@MOL:三氧化硫|SO₃@@」；id 須為 STRUCTURES 有效 id
- 比較 $n$ 個物種且**確須鍵線**時才寫 $n$ 行 @@MOL

2. 算式保護：反應式、變化表、聯立方程式、\\begin{cases}、\\begin{array} 等一律包在 $$ ... $$ 內獨立成行；不可裸寫 \\text、\\Rightarrow、\\begin{cases} 等 LaTeX 指令。
3. 板書聯立（大括號）：原子不滅、聯立求解時，優先用 cases 大括號排版，必要時用 \\Rightarrow 串接「聯立」與「解」。範例：
$$\\begin{cases} C\\text{原子不滅}：10x = 30 \\\\ H\\text{原子不滅}：10y = 35 \\times 2 \\\\ N\\text{原子不滅}：10z = 5 \\times 2 \\end{cases} \\Rightarrow \\begin{cases} x = 3 \\\\ y = 7 \\\\ z = 1 \\end{cases}$$
3b. 化學平衡／反應變化表（ICE）：**禁止**用 cases、禁止 array 內再嵌 cases；**必須**寫出完整變化表，第一列即反應式＋箭頭，不可只寫「建立 ICE 表」而省略表格。範例（照抄版型）：
$$\\begin{array}{ccc}
 & N_2O_4 & \\rightleftharpoons & 2NO_2 \\\\
 & 1 & & 0 \\\\
 & -\\alpha & & +2\\alpha \\\\
\\hline
 & 1-\\alpha & & 2\\alpha
\\end{array}$$
三反應物時用更多欄，例如 $2SO_3(g) \\rightleftharpoons 2SO_2(g) + O_2(g)$ 寫成：
$$\\begin{array}{ccccc}
 & 2SO_3 & \\rightleftharpoons & 2SO_2 & + & O_2 \\\\
 & 0.10 & & 0 & & 0 \\\\
 & -x & & +x & & +0.5x \\\\
\\hline
 & 0.10-x & & x & & 0.5x
\\end{array}$$
標籤可用「初／變／平」或省略；**同一 array、同一 $$ 區塊**。
4. NOTE 格式（細則見 User 訊息 **[NOTE 附錄]**）：
- 關鍵數字用 $\\htmlData{note=白話短註解}{內容}$，須寫在 $ 內；**禁止** $\\underbrace$、$\\underset$、$\\overset$ 標註因子名稱。
- 計算鏈中間量與乘除因子優先標 NOTE；題幹所求之最終答案可略。細則見 **[NOTE 附錄]**。
- 有 [參考資料] 時，NOTE 密度宜與參考詳解一致；具體 note 語意依該行等號式判斷，見 [NOTE 附錄]。
5. 簡答欄（必寫）：全文最後另起一行寫 @@ANSWER@@，**之後僅能寫簡答，禁止選項解析或計算過程**。
   - 單題：一行，只寫選項如 (D)(E)，或數值如 0.33 mol、87.4 mL。
   - 多題：每題一行，格式「第 N 題：(選項)」或「第 N 題：數值」，例：
     第20題：(A)(C)(D)(E)
     第28題：(D)(E)
   - 禁止在 @@ANSWER@@ 後寫「(D) …不符」「(E) 濃度計算…」等評析句。
6. 化學式與符號須寫在 $…$ 內：禁止裸寫 \\,、\\Delta、\\approx、_ 下標（如 $MgSO_4$、$\\Delta T_f$、$i \\approx 1$）；詳解末尾勿再加「(B) 與 (D) 皆為錯誤」等重複總結。
7. 段落層次：禁止使用 ### 等 Markdown 標題。多步推導較長時可用 (1)(2)(3) 分行，但不強制。
8. 多步計算不可連寫在同一行：同一段推導內可用「；」或換行分隔（例：$y=3$；$3=k\\cdot x$；$x=0.6$），禁止寫成 $=0.532\\ 1-x=$ 這種無標點連接。

【開場與依數性｜正反例（違反須重寫開場）】
- 詳解第一個可見字元**不得**為阿拉伯數字；禁止第一行寫「3；」「3;」或單獨「3」。
- ✓ 凝固點下降量：
  $$\\Delta T_f = 10 - 7 = \\htmlData{note=凝固點下降量}{3}\\,^{\\circ}\\text{C}$$
- ✓ $$\\Delta T_f = K_f \\times C_m \\times i$$；再寫 $$3 = 5 \\times 1 \\times i \\implies i = \\htmlData{note=凡特荷夫因子}{0.6}$$
- ✗ 「3；」後才寫公式——讀者不知 3 是什麼物理量。
- ✗ 「求 $i$：0.6」——冒號後裸數字無符號歸屬。
- 依數性／溶液題：開場優先寫「凝固點下降量：」「沸點上升量：」等小標，再接 $\\Delta T$ 等號式；題目給定溫度須先寫 $T_f^{\\circ}=…$、$T_f=…$ 再算差。

【模仿參考資料】
有 [參考資料] 時，**版式、符號、Note 密度、段落標題**須與資料庫詳解一致；數字依圖片重算。**Tier 1 命中時以克隆參考詳解為最高優先**，禁止改寫成講義體。**篇幅可略詳於參考**（補橋接步），**不可比參考更省略**。參考含 @@MOL 則克隆；參考無則勿硬加（除非 MATCH 標 MOL:必須或學生追問）。

【DATABASE 風格｜符號與版式（Tier 1 命中）】
- **正文須克隆【參考詳解】**：段落順序、「各選項分析如下」、* (A) bullet、3+1 型用語、@@MOL 行數等與參考同型；禁止自加參考沒有的 VSEPR／價電子長文開場。
- 參考有 **摘要表／array／cases** → 輸出須保留同型結構；表（或 cases）**之後**可接 1～4 行 $…$ 橋接（如由 $P_t$ 求 $x$、代入對象），用「；」或少量 $\\implies$ 連接均可。
- 參考用 **$[A]$、$[A]_0$** 等 → 勿擅自改符號。
- 參考含 **$\\htmlData{note=…}{…}$** → 關鍵數（含結論）須同型標註。
- **改卷用壓縮板書**：以 DATABASE 為**下限**（不可更簡）；允許在表後補必要橋接，禁止只剩兩行代公式而無交代。

【參考資料｜僅供內部，勿抄進詳解】
User 訊息中的 [參考資料庫內容]、[NOTE 附錄]、[教學規定]、[概念參考] 等為內部依據；**禁止**複製其標題、條列、禁止事項到正文。教學規定僅在該題**確實需用該規定推導**時套用（如依數性偶合求 $i$／$\alpha$；混成題判斷中心原子混成且每題只寫一法）；**追問**亦須遵守本則注入之 [教學規定] 與【追問硬性要求】。詳解直接以解題標籤＋推導開場。`;

const SYSTEM_CHEM_DETAILED_ADDON = `

【詳細模式（追加）】
0. **例外**：User 訊息含【權威參考詳解｜資料庫命中】時，以**克隆參考詳解**為最高優先；**勿**自加參考沒有的概念開場或 VSEPR 長文。
1. **先講概念**：進入推導前，須以 2～6 句**純文字**說明本題核心概念、解題所需背景與判斷起點；禁止用【核心觀念】【本題關鍵】等標題，禁止社交廢話，概念段**勿使用 $ 符號**（化學式除外）。
2. **再解題**：概念說明後再接推導；板書格式、數字歸屬、@@ANSWER@@ 規範與精簡模式相同；生物／中文計數直接寫文字，勿包 $。
3. **選項評析**：每項 2～3 句（約 25～55 字），須點出與推論的關係；禁止只寫「符合／不符」。
4. 概念段與推導段之間空一行；詳解第一個可見字元仍不得為裸阿拉伯數字。`;

// 2. 題號解析邏輯
function parseZhNumber(token) {
    var t = String(token || '').trim();
    if (/^\d+$/.test(t)) return Number(t);
    var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    return map[t] || NaN;
}

function parseRequestedSolveScope(inputText) {
    var raw = String(inputText || '').trim();
    if (!raw || /^(全部|所有|整題|全題|整卷|全部小題)$/.test(raw)) {
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

window.extractExplicitScopePhrase = function(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var m = raw.match(/(?:第\s*[一二三四五六七八九十\d]{1,2}\s*題|(?:^|[\s,，、])[一二三四五六七八九十\d]{1,2}\s*題|(?:只解|僅解|解答|解)\s*第?\s*[一二三四五六七八九十\d]{1,2}\s*題?)/);
    return m ? m[0] : '';
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
    var ref = String(refAnswer || '').trim();
    var textOnly = !!opts.textOnly;
    var hasImage = !!opts.hasImage;
    var questionBody = String(opts.questionBody || '').trim();
    var parts = [];

    if (textOnly) {
        if (!questionBody) questionBody = String(scopeInput || '').trim();
        parts.push('【題目】\n' + questionBody);
        if (scope.mode === 'partial') {
            parts.push('【最高指令】僅解答第 ' + scope.numbers.join('、') + ' 題。嚴禁解答或提及其他題號。');
        } else {
            parts.push('【最高指令】僅解答題幹完整之題；缺選項或缺數據者不要猜、不要解。');
        }
        if (opts.detailed) {
            parts.push('【詳細模式】請先以自然敘述說明本題相關概念與解題背景，再進入推導與選項評析。（若下方含【權威參考詳解｜資料庫命中】，以克隆參考版型為優先，勿自加參考沒有的概念段。）');
        }
        parts.push('選擇題須「各選項分析如下：」並逐項 (A)～(E) 評析，不得跳項。須畫鍵線時才用 @@MOL:物種id|標籤@@。');
    } else if (hasImage) {
        if (scope.mode === 'partial') {
            parts.push('【最高指令】僅解答第 ' + scope.numbers.join('、') + ' 題。嚴禁解答、提及或推論其他題號。');
        } else {
            parts.push('【最高指令】依圖片解題。不完整之題不解、不猜。未指定題號：同頁僅一題完整則解該題；多題皆完整則僅解最明確的一題（省 token）。同頁含多題請於補充欄指定題號（可指定多題）。');
        }
        var imageCount = Number(opts.imageCount) || 1;
        if (imageCount > 1) {
            parts.push('【附圖】共 ' + imageCount + ' 張，依上傳順序閱讀，合併為完整題目。');
        }
        var sup = buildSupplementBlock(opts);
        if (sup) parts.push(sup);
        if (opts.detailed) {
            parts.push('【詳細模式】請先以自然敘述說明本題相關概念與解題背景，再進入推導與選項評析。（若含【權威參考詳解｜資料庫命中】，以克隆參考版型為優先。）');
        } else {
            parts.push('請直接開始推導；須畫結構時另起 @@MOL:物種id|標籤@@ 鍵線式。');
        }
    } else {
        parts.push('請解答題目，直接開始推導與計算。');
    }

    var text = parts.join('\n\n');
    if (ref) text += '\n\n【參考答案】' + ref + ' (請對照檢核確保邏輯正確)';
    return text;
};

window.buildScopeSystemAddon = function(scopeInput, opts) {
    opts = opts || {};
    var scopeSrc = String(scopeInput || opts.supplement || '').trim();
    var scope = parseRequestedSolveScope(scopeSrc);
    if (opts.textOnly) {
        if (scope.mode === 'partial') {
            return '\n\n【範圍】僅第 ' + scope.numbers.join('、') + ' 題；違反即整篇作廢。';
        }
        return '\n\n【範圍】題幹不完整則不解、不猜。';
    }
    if (scope.mode === 'partial') {
        return '\n\n【範圍】僅第 ' + scope.numbers.join('、') + ' 題；其他題號不得出現。';
    }
    if (opts.hasImage) {
        var hint = '\n\n【範圍】圖中不完整之題不解。';
        if (opts.supplement) {
            hint += '已有使用者補充文字，須與圖併讀。';
        }
        return hint;
    }
    return '';
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
    var addon = "";
    if (typeof buildDatabaseSystemAddon === 'function') {
        try { addon = await buildDatabaseSystemAddon(questionInput); } catch(e) { console.log("DB Skip"); }
    }
    var scopeAddon = window.buildScopeSystemAddon(scopeInput, opts);
    var detailAddon = opts.detailed ? SYSTEM_CHEM_DETAILED_ADDON : '';
    var followAddon = opts.followUp ? SYSTEM_CHEM_FOLLOWUP_ADDON : '';
    return SYSTEM_CHEM + detailAddon + followAddon + addon + scopeAddon;
};

window.buildFollowUpUserText = function(followText, opts) {
    opts = opts || {};
    var q = String(followText || '').trim();
    var parts = [
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

/** 選擇題是否缺 (A)～(E) 評析 */
function checkChoiceCoverage(text) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    if (!/\([A-E]\)/.test(body)) return issues;
    var needFive = /各選項分析|\([A-E]\).*\([A-E]\)/.test(body) || /^\*\s+\([A-E]\)/m.test(body);
    if (!needFive) return issues;
    var found = {};
    'ABCDE'.split('').forEach(function(ch) {
        if (new RegExp('^\\*\\s+\\(' + ch + '\\)', 'm').test(body) || new RegExp('^\\(' + ch + '\\)', 'm').test(body)) {
            found[ch] = true;
        }
    });
    var miss = 'ABCDE'.split('').filter(function(ch) { return !found[ch]; });
    if (miss.length >= 2) {
        issues.push('選擇題須逐項評析 (A)～(E)，缺少：(' + miss.join(')(') + ')。');
    }
    return issues;
}

/** 對照參考詳解檢查段落／選項版型（Tier 1 克隆） */
function checkLayoutAgainstReference(text, refText) {
    var issues = [];
    var ref = String(refText || '');
    if (!ref.trim()) return issues;
    var body = String(text || '').split('@@ANSWER@@')[0];
    var layout = typeof extractLayoutFingerprint === 'function'
        ? extractLayoutFingerprint(ref)
        : null;
    if (!layout) return issues;

    if (layout.hasOptionAnalysisHeader && !/各選項分析/.test(body)) {
        issues.push('參考詳解含「各選項分析如下」，輸出須保留該標題與 * (A)～(E) bullet 評析，禁止改寫成長段講義。');
    }
    if (layout.bulletOptionCount >= 3) {
        var outBullets = (body.match(/^\*\s+\([A-E]\)/gm) || []).length;
        if (outBullets < Math.max(3, layout.bulletOptionCount - 1)) {
            issues.push('須逐選項 * (A)～(E) bullet 評析，題數與參考詳解一致。');
        }
    }
    if (layout.structureCount > 0) {
        var outStruct = countStructureLines(body);
        var outBullets2 = (body.match(/^\*\s+\([A-E]\)/gm) || []).length;
        if (layout.bulletOptionCount >= 3 && outBullets2 < Math.max(3, layout.bulletOptionCount - 1)) {
            issues.push('須逐選項 * (A)～(E) bullet 評析（結構圖可省略，文字 3+N 型即可）。');
        }
    }
    if (layout.has3PlusNNotation && !/\d+\s*\+\s*\d+\s*型/.test(body)) {
        issues.push('參考詳解用「3+1 型」「3+0 型」等用語，輸出須同型，禁止改寫成價電子加總或 VSEPR 長文。');
    }
    if (layout.hasOptionAnalysisHeader || layout.opensWithStructure) {
        if (/須先|價電子|VSEPR|路易斯結構判斷|判斷.*平面/.test(body.slice(0, 500)) && !/各選項分析/.test(body.slice(0, 200))) {
            issues.push('參考詳解直接進入結構圖／選項評析，禁止自加參考沒有的概念開場段。');
        }
    }
    return issues;
}

/** 對照參考詳解檢查符號／版式（不懲罰適度橋接，只擋過度省略） */
function checkNotationAgainstReference(text, refText) {
    var issues = [];
    var ref = String(refText || '');
    if (!ref.trim()) return issues;
    var body = String(text || '').split('@@ANSWER@@')[0];
    var fp = typeof extractNotationFingerprint === 'function'
        ? extractNotationFingerprint(ref)
        : null;
    if (!fp) return issues;

    if (fp.hasHtmlData && !/\\htmlData\{note=/.test(body)) {
        issues.push('參考詳解含 $\\htmlData{note=…}{…}$，輸出須至少一處同型 NOTE（結論數宜標）。');
    }
    if (fp.hasMdTable) {
        var hasTable = /^\|[^\n]+\|/m.test(body) && /\|[\s:]*-+[\s:]*\|/.test(body);
        if (!hasTable) {
            issues.push('參考詳解含 markdown 摘要表，輸出須保留同型表格（表後可再接橋接等號式）。');
        }
    }
    if (fp.hasCases && !/\\begin\{cases\}/.test(body)) {
        issues.push('參考詳解用 cases 併列條件，輸出須保留 $\\begin{cases}…\\end{cases}$。');
    }
    var outEq = typeof countEqLines === 'function' ? countEqLines(body) : 0;
    var refEq = fp.refEqLines || 0;
    var needsStructure = fp.hasMdTable || fp.hasCases || fp.hasArray;
    if (needsStructure && refEq >= 2 && outEq < Math.max(2, refEq - 1)) {
        issues.push('推導過於簡略：須保留 DATABASE 版式，並補 1～4 行 $…$ 橋接（交代中間量再代入），不可只剩代公式。');
    }
    return issues;
}

/** 檢查板書常見違規（裸數字開場、推導過短、缺結構圖、符號未克隆等） */
window.checkSolutionBoardStyle = function(text, refText) {
    var issues = [];
    var body = String(text || '').split('@@ANSWER@@')[0];
    var lines = body.split('\n');
    var first = '';
    for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t) continue;
        if (/^#{1,3}\s/.test(t)) continue;
        if (/^\*\*答/.test(t)) continue;
        first = t;
        break;
    }
    if (/^\d+(?:\.\d+)?\s*[；;]/.test(first)) {
        issues.push('詳解第一行不得為裸數字加頓號（應先寫物理量標籤與 $符號=算式=數值$，關鍵數加 $\\htmlData{note=…}{…}$）。');
    } else if (/^\d+(?:\.\d+)?\s*$/.test(first)) {
        issues.push('詳解第一行不得單獨出現數字（須寫在等號式內並標明符號）。');
    }

    var choiceIdx = body.search(/^\(A\)/m);
    var refUsesBullets = refText && /^\*\s+\([A-E]\)/m.test(String(refText));
    if (choiceIdx >= 0 && !refUsesBullets) {
        var deriv = body.slice(0, choiceIdx);
        var eqCount = 0;
        deriv.split('\n').forEach(function(line) {
            var t = line.trim();
            if (!t) return;
            if (/^\$\$[\s\S]+\$\$$/.test(t)) { eqCount += 2; return; }
            if (/\$[^$]+[=＝≈][^$]+\$/.test(t)) { eqCount++; return; }
            if (/\$[^$]*\\(?:rightarrow|rightleftharpoons|dfrac|frac|htmlData)[^$]*\$/.test(t)) eqCount++;
        });
        if (eqCount < 2) {
            issues.push('選項 (A) 前須至少兩行含等號的 $…$ 推導（反應式或計量換算），不可只寫標題就跳選項。');
        }
    }

    var ref = String(refText || '');
    var refHasStruct = countStructureLines(ref) > 0;
    var structRequired = refHasStruct;
    if (!structRequired && typeof parseStructurePolicy === 'function' && ref.trim()) {
        structRequired = parseStructurePolicy(ref).mode === 'required';
    } else if (!structRequired && typeof parseSmilesPolicy === 'function' && ref.trim()) {
        structRequired = parseSmilesPolicy(ref).mode === 'required';
    }
    if (!ref.trim() && solutionNeedsStructure(body, '')) {
        issues.push('本題涉及分子／離子結構，須另起獨立一行 @@MOL:物種id|標籤@@，不可僅以文字描述結構。');
    } else if (ref.trim() && structRequired && !/@@(?:MOL|SMILES)/i.test(body)) {
        issues.push('須依參考詳解克隆 @@MOL:…@@ 結構圖行。');
    }

    issues = issues.concat(checkNotationAgainstReference(text, refText));
    issues = issues.concat(checkLayoutAgainstReference(text, refText));
    issues = issues.concat(checkChoiceCoverage(text));

    return issues;
};

window.buildBoardStyleFixUserText = function(issues) {
    var list = (issues || []).join(' ');
    if (/各選項分析|bullet|講義|克隆|3\+1|3\+0|VSEPR|價電子|概念開場/.test(list)) {
        return '【板書修正｜DATABASE 克隆】' + list + ' 請對照 [參考資料庫內容] 之【參考詳解】重寫全文：克隆段落順序、標題、* (A) bullet、3+1 型用語與 @@MOL 行數；禁止講義體開場；數字重算；保留 @@ANSWER@@；禁止 MATCH 註解。';
    }
    if (/@@MOL|@@SMILES|鍵線式|結構/.test(list)) {
        return '【板書修正】' + list + ' 請補上 @@MOL:物種id|繁中標籤@@ 獨立成行（比較幾個物質就幾行），再保留原有推論與 @@ANSWER@@；禁止 MATCH 註解。';
    }
    if (/摘要表|markdown|cases|htmlData|過於簡略|方括號|\[A\]/.test(list)) {
        return '【板書修正｜DATABASE 對齊】' + list + ' 請對照 [參考資料庫內容] 重寫：保留表／cases／符號／\\htmlData；在表後補 1～4 行橋接 $…$ 交代代入來源，不可比參考更省略；邏輯與答案保持正確，禁止 MATCH 註解，直接給改正後全文。';
    }
    var extra = /跳選項|推導/.test(list)
        ? ' 補齊反應式與中間計量（莫耳數、質量等）的 $…$ 等號式與 NOTE，完成後再寫 (A)～(E)。'
        : ' 請從頭改寫詳解開場：先寫條件與物理量標籤（如「凝固點下降量：」），再以完整 $…$ 等號式呈現；關鍵數字須加 $\\htmlData{note=白話短註}{數值}$。';
    return '【板書修正】' + list + extra + '邏輯與答案保持正確，禁止輸出 MATCH 註解，直接給改正後全文。';
};