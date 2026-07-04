/* 內建版型庫：由同步資料庫.bat 自動產生 */
const EMBEDDED_DATABASE = {
  "files": {
    "formats/format-cases.md": "---\nid: format-cases\nkind: format\nlabel: 聯立方程式\nlayout_id: cases\ninject: always\npriority: 80\n---\n\n## 用途\n\n多個方程式聯立求解（體積、莫耳、濃度關係等）。\n\n## 輸出規格\n\n1. 整段放在**一個** `$$…$$` 內\n2. 使用 `\\begin{cases}…\\end{cases}`；解與題意相鄰時可用 `\\quad\\Rightarrow\\quad` 連接第二個 cases\n3. 中文說明可寫在 cases 外、或每行方程前的文字於 `$` 外\n\n## 範例骨架\n\n$$\n\\begin{cases}\n\\text{條件一} \\\\\n\\text{條件二}\n\\end{cases}\n\\quad\\Rightarrow\\quad\n\\begin{cases}\nx=\\cdots \\\\\ny=\\cdots\n\\end{cases}\n$$\n",
    "formats/format-choice-line.md": "---\nid: format-choice-line\nkind: format\nlabel: 選項逐項評析\nlayout_id: choice-line\ninject: always\npriority: 70\n---\n\n## 模式 A｜(A)～(E) 敘述多選（須全寫）\n\n1. 先 1～3 句點本題重點或實驗意涵\n2. 須追蹤物種濃度／莫耳數／平衡時，**先寫配平反應式**，再「各選項分析如下：」\n3. **(A)～(E) 每項獨立一行**，行首 `(A)`～`(E)`，含完整理由或計算，不可只寫對錯\n4. 關鍵數 NOTE；需對齊物種量時接 rxn-grid\n5. 「故答案為 …」與 @@ANSWER@@ 一致\n\n## 模式 B｜純數字選項（精簡）\n\n選項僅 1～5 且只問哪個對 → 只詳解答案項，其餘省略。\n\n## 禁止\n\n- 禁止多選只寫部分選項或只報結論\n- 禁止用 `* (A)` bullet\n",
    "formats/format-eq-block.md": "---\nid: format-eq-block\nkind: format\nlabel: 等號推導列\nlayout_id: eq-block\ninject: always\npriority: 90\n---\n\n## 用途\n\n一般計算推導、代入、約分、求未知數。與反應表可並用。\n\n## 輸出規格\n\n1. 關鍵式寫在 `$…$` 內；巢狀分式用 `\\dfrac`\n2. 多個等號式同一行時，以 `；`、`，`、`故` 分隔\n3. 結論：`=\\dfrac{…}{…}\\text{，}\\quad\\text{故 }…`（全形逗號）\n4. 關鍵數字須 `\\htmlData{note=…}{…}`（見 NOTE 附錄）\n5. 式內不寫單位；答案句與 @@ANSWER@@ 須附單位\n\n## 禁止\n\n- 禁止裸數字開場\n- 禁止多個 `$…$` 無標點緊貼\n",
    "formats/format-rxn-grid.md": "---\nid: format-rxn-grid\nkind: format\nlabel: 反應變化表（通用）\nlayout_id: rxn-grid\ninject: always\npriority: 100\n---\n\n## 用途\n\n推導須**追蹤各反應物種的量**（莫耳數、濃度、平衡量、解離量、限量消耗等）時使用。與單元、實驗種類無關；**該追蹤就寫，不必追蹤就不寫**。\n\n## 輸出規格\n\n1. 先寫一行「反應式如下：」（可省略「步驟1」等標題）\n2. 緊接**一個** `$$…$$`，內含 `\\begin{array}{…}\\end{array}`\n3. **第 1 列**：配平反應式，須含 `\\rightleftharpoons` 或 `\\rightarrow`；欄位對齊各物種與 `+`\n4. **第 2～4 列**（共 3～4 行資料，依題需要）：\n   - 可用 `\\text{起始}`、`\\text{變化}`、`\\text{結果}` 標在**第一欄**，或省略標籤、直接寫數值\n   - **每一列欄數須與反應式列相同**（含 `+`、箭頭欄）\n   - 變化量帶正負號；不變的離子／溶劑欄寫 `—` 或空白\n5. **最後一列資料前**加 `\\hline`（分離結果／平衡列）\n6. 數值依本題重算；禁止反應式下方裸寫數字、禁止拆成多個小 array\n\n## 範例骨架（符號，勿抄數字）\n\n$$\n\\begin{array}{lccccc}\n & A & + & B & \\rightleftharpoons & C \\\\\n\\text{起始} & a_0 & & b_0 & & 0 \\\\\n\\text{變化} & -x & & -y & & +z \\\\\n\\hline\n\\text{結果} & a & & b & & c\n\\end{array}\n$$\n\n## 禁止\n\n- 禁止只有反應式沒有 3～4 行對齊表\n- 禁止資料列欄數少於反應式列\n- 禁止在表外用純文字堆疊「0.24  -0.22  0.02」\n"
  },
  "methods": {
    "electrolysis-parallel": {
      "label": "電解並聯",
      "steps": [
        "先看導線：並聯＝正極共接、負極共接；串聯＝依序首尾相連",
        "Q總 = I × t（法拉第）",
        "依各支路氣體體積／電極反應求該支路 ne⁻",
        "分配各槽／各支路電量（並聯各支路電量不相等）",
        "代入電極反應求質量、體積或濃度"
      ],
      "pitfalls": [
        "並聯時禁止假設各槽 Q 相同",
        "不同支路 ne⁻ 不可直接相加混用",
        "須先畫支路再分配電量"
      ]
    },
    "weak-acid-multi": {
      "label": "弱酸多步解離",
      "steps": [
        "判斷背景：解離度高但 [H⁺] 極小 → 常為酸鹼中和背景，非純酸解離",
        "第一步解離：H₂A ⇌ H⁺ + HA⁻（array 表）",
        "第二步解離：HA⁻ ⇌ H⁺ + A²⁻（array 表）",
        "利用 pH 恆定、濃度比例求 x 與 Ka",
        "判定選項並寫 **答：**"
      ],
      "pitfalls": [
        "勿把高解離度直接當純酸解離",
        "pH 恆定時 [H⁺] 以題目值代入",
        "弱酸二步解離不可只做一步"
      ]
    },
    "equilibrium-table": {
      "label": "化學平衡表",
      "steps": [
        "寫平衡反應式（含 → 或 ⇌）",
        "array 四行：反應式／起始／變化／hline／結果（hline 僅在變化與結果列之間；禁止缺結果列）",
        "以分壓或濃度表示 K",
        "代入求 α 或未知量",
        "必要時求平均分子量 M_avg"
      ],
      "pitfalls": [
        "變化表第一列必須含箭頭欄",
        "禁止用 c|cc 垂直線格式",
        "α 近似 1/3 時可簡化並註明"
      ]
    },
    "reaction-stoichiometry": {
      "label": "反應計量",
      "steps": [
        "寫完整反應式並配平",
        "array 表：起始／變化／結果",
        "找出限量試劑",
        "依莫耳比求產物或剩餘量",
        "寫 **答：**"
      ],
      "pitfalls": [
        "限量試劑決定最大產量",
        "係數比即莫耳比",
        "同一反應式不可重複連寫兩次"
      ]
    },
    "general-exam": {
      "label": "段考混合題",
      "steps": [
        "依指定題號只解該題",
        "先判斷題型再選擇對應方法",
        "關鍵數據加 htmlData 註解",
        "以 **答：** 收尾"
      ],
      "pitfalls": [
        "段考卷不可一次輸出全部題號",
        "附圖題須先讀圖再列式"
      ]
    },
    "general-chem": {
      "label": "一般化學",
      "steps": [
        "讀題提取條件",
        "選擇適當模型（計量／平衡／酸鹼／氧化還原）",
        "列式計算",
        "寫 **答：**"
      ],
      "pitfalls": [
        "禁止沒有 **答：** 就結束",
        "分數一律 \\dfrac 直式"
      ]
    }
  },
  "formats": {
    "formats/format-cases.md": "---\nid: format-cases\nkind: format\nlabel: 聯立方程式\nlayout_id: cases\ninject: always\npriority: 80\n---\n\n## 用途\n\n多個方程式聯立求解（體積、莫耳、濃度關係等）。\n\n## 輸出規格\n\n1. 整段放在**一個** `$$…$$` 內\n2. 使用 `\\begin{cases}…\\end{cases}`；解與題意相鄰時可用 `\\quad\\Rightarrow\\quad` 連接第二個 cases\n3. 中文說明可寫在 cases 外、或每行方程前的文字於 `$` 外\n\n## 範例骨架\n\n$$\n\\begin{cases}\n\\text{條件一} \\\\\n\\text{條件二}\n\\end{cases}\n\\quad\\Rightarrow\\quad\n\\begin{cases}\nx=\\cdots \\\\\ny=\\cdots\n\\end{cases}\n$$\n",
    "formats/format-choice-line.md": "---\nid: format-choice-line\nkind: format\nlabel: 選項逐項評析\nlayout_id: choice-line\ninject: always\npriority: 70\n---\n\n## 模式 A｜(A)～(E) 敘述多選（須全寫）\n\n1. 先 1～3 句點本題重點或實驗意涵\n2. 須追蹤物種濃度／莫耳數／平衡時，**先寫配平反應式**，再「各選項分析如下：」\n3. **(A)～(E) 每項獨立一行**，行首 `(A)`～`(E)`，含完整理由或計算，不可只寫對錯\n4. 關鍵數 NOTE；需對齊物種量時接 rxn-grid\n5. 「故答案為 …」與 @@ANSWER@@ 一致\n\n## 模式 B｜純數字選項（精簡）\n\n選項僅 1～5 且只問哪個對 → 只詳解答案項，其餘省略。\n\n## 禁止\n\n- 禁止多選只寫部分選項或只報結論\n- 禁止用 `* (A)` bullet\n",
    "formats/format-eq-block.md": "---\nid: format-eq-block\nkind: format\nlabel: 等號推導列\nlayout_id: eq-block\ninject: always\npriority: 90\n---\n\n## 用途\n\n一般計算推導、代入、約分、求未知數。與反應表可並用。\n\n## 輸出規格\n\n1. 關鍵式寫在 `$…$` 內；巢狀分式用 `\\dfrac`\n2. 多個等號式同一行時，以 `；`、`，`、`故` 分隔\n3. 結論：`=\\dfrac{…}{…}\\text{，}\\quad\\text{故 }…`（全形逗號）\n4. 關鍵數字須 `\\htmlData{note=…}{…}`（見 NOTE 附錄）\n5. 式內不寫單位；答案句與 @@ANSWER@@ 須附單位\n\n## 禁止\n\n- 禁止裸數字開場\n- 禁止多個 `$…$` 無標點緊貼\n",
    "formats/format-rxn-grid.md": "---\nid: format-rxn-grid\nkind: format\nlabel: 反應變化表（通用）\nlayout_id: rxn-grid\ninject: always\npriority: 100\n---\n\n## 用途\n\n推導須**追蹤各反應物種的量**（莫耳數、濃度、平衡量、解離量、限量消耗等）時使用。與單元、實驗種類無關；**該追蹤就寫，不必追蹤就不寫**。\n\n## 輸出規格\n\n1. 先寫一行「反應式如下：」（可省略「步驟1」等標題）\n2. 緊接**一個** `$$…$$`，內含 `\\begin{array}{…}\\end{array}`\n3. **第 1 列**：配平反應式，須含 `\\rightleftharpoons` 或 `\\rightarrow`；欄位對齊各物種與 `+`\n4. **第 2～4 列**（共 3～4 行資料，依題需要）：\n   - 可用 `\\text{起始}`、`\\text{變化}`、`\\text{結果}` 標在**第一欄**，或省略標籤、直接寫數值\n   - **每一列欄數須與反應式列相同**（含 `+`、箭頭欄）\n   - 變化量帶正負號；不變的離子／溶劑欄寫 `—` 或空白\n5. **最後一列資料前**加 `\\hline`（分離結果／平衡列）\n6. 數值依本題重算；禁止反應式下方裸寫數字、禁止拆成多個小 array\n\n## 範例骨架（符號，勿抄數字）\n\n$$\n\\begin{array}{lccccc}\n & A & + & B & \\rightleftharpoons & C \\\\\n\\text{起始} & a_0 & & b_0 & & 0 \\\\\n\\text{變化} & -x & & -y & & +z \\\\\n\\hline\n\\text{結果} & a & & b & & c\n\\end{array}\n$$\n\n## 禁止\n\n- 禁止只有反應式沒有 3～4 行對齊表\n- 禁止資料列欄數少於反應式列\n- 禁止在表外用純文字堆疊「0.24  -0.22  0.02」\n"
  }
};
