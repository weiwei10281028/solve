/* 內建版型庫：由同步資料庫.bat 自動產生 */
const EMBEDDED_DATABASE = {
  "files": {
    "formats/format-board-doc.md": "---\nid: format-board-doc\nkind: format\nlabel: BoardDoc 結構化板書（選用）\nlayout_id: board-doc\ninject: false\npriority: 110\n---\n\n## 強制\n\n詳解正文**只**能放在 `@@BOARD@@ … @@END@@` 內的 JSON（`version: 1`）。JSON 外禁止寫算式或推導。\n\n## blocks 型別（依題選用，勿全塞）\n\n| type | 用途 |\n|------|------|\n| `section` | `{ \"title\": \"詳解\" }` → 【詳解】 |\n| `paragraph` | `{ \"parts\": [{ \"kind\":\"text\",\"text\":\"…\" }, { \"kind\":\"math\",\"latex\":\"…\" }] }` |\n| `math` | `{ \"display\": true/false, \"latex\": \"…\" }`（display 式獨 block，勿與中文同行） |\n| `rxn-table` | 結構化反應表（見 rxn-grid）；**勿**手寫 array 字串 |\n| `choice-group` | `{ \"items\": [{ \"letter\":\"A\", \"parts\":[…] }] }`；結尾寫「敘述正確／錯誤」 |\n| `mol` | `{ \"query\":\"苯\", \"label\":\"苯\" }` → @@MOL:…@@ |\n\n## answer\n\nJSON 內 `\"answer\": { \"parts\": [{ \"kind\":\"math\", \"latex\":\"2.0\\\\times10^{-4}\" }], \"unit\": \"M\" }`  \n並在 `@@END@@` 後另起一行 `@@ANSWER@@`（選項或數值含單位）。\n\n## 範例骨架\n\n```\n@@BOARD@@\n{\n  \"version\": 1,\n  \"blocks\": [\n    { \"type\": \"section\", \"title\": \"詳解\" },\n    {\n      \"type\": \"paragraph\",\n      \"parts\": [\n        { \"kind\": \"text\", \"text\": \"由題意得 \" },\n        { \"kind\": \"math\", \"latex\": \"x=0.01\" }\n      ]\n    }\n  ],\n  \"answer\": {\n    \"parts\": [{ \"kind\": \"math\", \"latex\": \"2.0\\\\times10^{-4}\" }],\n    \"unit\": \"M\"\n  }\n}\n@@END@@\n@@ANSWER@@ 2.0×10⁻⁴ M\n```\n\n## 禁止\n\n- 禁止 JSON 外寫 `$…$` 或 `$$…$$`\n- 禁止在 paragraph 內用 `$$…$$`（改 math block）\n- NOTE 寫在 `latex` 內：`\\htmlData{note=…}{…}`\n",
    "formats/format-cases.md": "---\nid: format-cases\nkind: format\nlabel: 聯立方程式\nlayout_id: cases\ninject: always\npriority: 80\n---\n\n## 用途\n\n多個方程式聯立求解（體積、莫耳、濃度關係等）。\n\n## 輸出規格\n\n1. 整段放在**一個** `$$…$$` 內\n2. 使用 `\\begin{cases}…\\end{cases}`；解與題意相鄰時可用 `\\quad\\Rightarrow\\quad` 連接第二個 cases\n3. 中文說明可寫在 cases 外、或每行方程前的文字於 `$` 外\n\n## 範例骨架\n\n$$\n\\begin{cases}\n\\text{條件一} \\\\\n\\text{條件二}\n\\end{cases}\n\\quad\\Rightarrow\\quad\n\\begin{cases}\nx=\\cdots \\\\\ny=\\cdots\n\\end{cases}\n$$\n",
    "formats/format-choice-line.md": "---\nid: format-choice-line\nkind: format\nlabel: 選項逐項評析\nlayout_id: choice-line\ninject: always\npriority: 70\n---\n\n## 模式 A｜(A)～(E) 敘述多選（須全寫）\n\n1. 先 1～3 句點本題重點或實驗意涵\n2. 須追蹤物種濃度／莫耳數／平衡時，**先寫配平反應式**，再「各選項分析如下：」\n3. **(A)～(E) 每項獨立一行**，行首 `(A)`～`(E)`，含完整理由或計算，結尾寫「敘述正確」或「敘述錯誤」，不可只寫對錯\n4. 關鍵數 NOTE；需對齊物種量時接 rxn-grid\n5. 「故答案為 …」與 @@ANSWER@@ 一致；**標「敘述正確」的選項集合須與答案完全一致**\n\n## 模式 B｜純數字選項（精簡）\n\n選項僅 1～5 且只問哪個對 → 只詳解答案項，其餘省略。\n\n## 禁止\n\n- 禁止多選只寫部分選項或只報結論\n- 禁止用 `* (A)` bullet\n- 禁止寫「依參考答案選…」而各選項分析與 @@ANSWER@@ 矛盾\n",
    "formats/format-eq-block.md": "---\nid: format-eq-block\nkind: format\nlabel: 等號推導列\nlayout_id: eq-block\ninject: always\npriority: 90\n---\n\n## 用途\n\n一般計算推導、代入、約分、求未知數。與反應表可並用。\n\n## 輸出規格\n\n1. 關鍵式寫在 `$…$` 內；巢狀分式用 `\\dfrac`\n2. 多個等號式同一行時，以 `；`、`，`、`\\text{，}\\quad` 分隔（例：$…=…\\text{，}\\quad x=…$）\n3. 結論：`=\\dfrac{…}{…}\\text{，}\\quad\\text{故 }…`（全形逗號）\n4. 關鍵數字須 `\\htmlData{note=…}{…}`（見 NOTE 附錄）；平方項整段包住，如 `\\htmlData{note=Cu⁺濃度平方}{(2x)^{2}}`，禁止 `\\htmlData{…}{2x}^2`\n5. **表後 $K_c$ 代入行**：只用一行 `$…$`（勿 `$$…$$`）；**2 個** `\\htmlData`（分子、分母）即可\n6. 科學記號：`\\times 10^{-4}`（指數必須 `{}`）；乘號用 `\\times`，禁止 `\\setminus times`\n7. 式內不寫單位；答案句與 @@ANSWER@@ 須附單位\n\n## 禁止\n\n- 禁止裸數字開場\n- 禁止多個 `$…$` 無標點緊貼\n",
    "formats/format-rxn-grid.md": "---\nid: format-rxn-grid\nkind: format\nlabel: 反應變化表（通用）\nlayout_id: rxn-grid\ninject: always\npriority: 100\n---\n\n## 用途\n\n推導須**追蹤各反應物種的量**（莫耳數、濃度、平衡量、解離量、限量消耗等）時使用。\n\n## 列數（依題選一，禁止只寫變化+平衡）\n\n### A｜三列（一般 ICE）\n\n1. 先寫「反應式如下：」\n2. 第 1 列：配平反應式（含 `\\rightleftharpoons` 或 `\\rightarrow`）\n3. 第 2～4 列：`\\text{起始}` → `\\text{變化}` → `\\hline` → `\\text{結果}`（或 `\\text{平衡}`）\n4. 結果列寫**最終量**（如 $0.4-2x$、$x$），不是再寫 $-2x$\n\n### B｜四列（$K$ 很大／很小：先完全反應再回推）\n\n`\\text{起始}` → `\\text{完全向右}`（或 `\\text{右}`）→ `\\text{再向左}`（或 `\\text{左}`）→ `\\hline` → `\\text{平衡}`\n\n例（$2\\text{Cu}^+\\rightleftharpoons\\text{Cu}+\\text{Cu}^{2+}$，$K_c$ 很大）：\n\n$$\n\\begin{array}{lccccc}\n & 2\\text{Cu}^+ & \\rightleftharpoons & \\text{Cu} & + & \\text{Cu}^{2+} \\\\\n\\text{起始 (M)} & 0.4 & & \\text{—} & & 0 \\\\\n\\text{完全向右} & 0 & & \\text{—} & & 0.2 \\\\\n\\text{再向左} & +2x & & \\text{—} & & -x \\\\\n\\hline\n\\text{平衡 (M)} & 2x & & \\text{—} & & 0.2-x \\\\\n\\end{array}\n$$\n\n代入：$K_c=\\dfrac{0.2-x}{(2x)^2}$；$K_c$ 極大時 $0.2-x\\approx 0.2$，**禁止** $0.4-2x\\approx 2x$ 或略過四列表直接用 $(2x)^2$。\n\n## 共通規格\n\n- 每一資料列欄數須與反應式列相同（含 `+`、箭頭欄）\n- 變化量帶正負；固相／純液體欄寫 `—`\n- 數值依本題重算；禁止表外裸寫數字\n\n## 禁止\n\n- 禁止只有「變化濃度／變化」+「平衡濃度／平衡」、**缺起始列**\n- 禁止只有起始+變化、缺結果／平衡列\n- 禁止資料列欄數少於反應式列\n- 禁止 $K$ 極大題用三列 ICE 硬代 $0.4-2x$ 或錯誤近似 $0.4-2x\\approx 2x$\n"
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
    "formats/format-board-doc.md": "---\nid: format-board-doc\nkind: format\nlabel: BoardDoc 結構化板書（選用）\nlayout_id: board-doc\ninject: false\npriority: 110\n---\n\n## 強制\n\n詳解正文**只**能放在 `@@BOARD@@ … @@END@@` 內的 JSON（`version: 1`）。JSON 外禁止寫算式或推導。\n\n## blocks 型別（依題選用，勿全塞）\n\n| type | 用途 |\n|------|------|\n| `section` | `{ \"title\": \"詳解\" }` → 【詳解】 |\n| `paragraph` | `{ \"parts\": [{ \"kind\":\"text\",\"text\":\"…\" }, { \"kind\":\"math\",\"latex\":\"…\" }] }` |\n| `math` | `{ \"display\": true/false, \"latex\": \"…\" }`（display 式獨 block，勿與中文同行） |\n| `rxn-table` | 結構化反應表（見 rxn-grid）；**勿**手寫 array 字串 |\n| `choice-group` | `{ \"items\": [{ \"letter\":\"A\", \"parts\":[…] }] }`；結尾寫「敘述正確／錯誤」 |\n| `mol` | `{ \"query\":\"苯\", \"label\":\"苯\" }` → @@MOL:…@@ |\n\n## answer\n\nJSON 內 `\"answer\": { \"parts\": [{ \"kind\":\"math\", \"latex\":\"2.0\\\\times10^{-4}\" }], \"unit\": \"M\" }`  \n並在 `@@END@@` 後另起一行 `@@ANSWER@@`（選項或數值含單位）。\n\n## 範例骨架\n\n```\n@@BOARD@@\n{\n  \"version\": 1,\n  \"blocks\": [\n    { \"type\": \"section\", \"title\": \"詳解\" },\n    {\n      \"type\": \"paragraph\",\n      \"parts\": [\n        { \"kind\": \"text\", \"text\": \"由題意得 \" },\n        { \"kind\": \"math\", \"latex\": \"x=0.01\" }\n      ]\n    }\n  ],\n  \"answer\": {\n    \"parts\": [{ \"kind\": \"math\", \"latex\": \"2.0\\\\times10^{-4}\" }],\n    \"unit\": \"M\"\n  }\n}\n@@END@@\n@@ANSWER@@ 2.0×10⁻⁴ M\n```\n\n## 禁止\n\n- 禁止 JSON 外寫 `$…$` 或 `$$…$$`\n- 禁止在 paragraph 內用 `$$…$$`（改 math block）\n- NOTE 寫在 `latex` 內：`\\htmlData{note=…}{…}`\n",
    "formats/format-cases.md": "---\nid: format-cases\nkind: format\nlabel: 聯立方程式\nlayout_id: cases\ninject: always\npriority: 80\n---\n\n## 用途\n\n多個方程式聯立求解（體積、莫耳、濃度關係等）。\n\n## 輸出規格\n\n1. 整段放在**一個** `$$…$$` 內\n2. 使用 `\\begin{cases}…\\end{cases}`；解與題意相鄰時可用 `\\quad\\Rightarrow\\quad` 連接第二個 cases\n3. 中文說明可寫在 cases 外、或每行方程前的文字於 `$` 外\n\n## 範例骨架\n\n$$\n\\begin{cases}\n\\text{條件一} \\\\\n\\text{條件二}\n\\end{cases}\n\\quad\\Rightarrow\\quad\n\\begin{cases}\nx=\\cdots \\\\\ny=\\cdots\n\\end{cases}\n$$\n",
    "formats/format-choice-line.md": "---\nid: format-choice-line\nkind: format\nlabel: 選項逐項評析\nlayout_id: choice-line\ninject: always\npriority: 70\n---\n\n## 模式 A｜(A)～(E) 敘述多選（須全寫）\n\n1. 先 1～3 句點本題重點或實驗意涵\n2. 須追蹤物種濃度／莫耳數／平衡時，**先寫配平反應式**，再「各選項分析如下：」\n3. **(A)～(E) 每項獨立一行**，行首 `(A)`～`(E)`，含完整理由或計算，結尾寫「敘述正確」或「敘述錯誤」，不可只寫對錯\n4. 關鍵數 NOTE；需對齊物種量時接 rxn-grid\n5. 「故答案為 …」與 @@ANSWER@@ 一致；**標「敘述正確」的選項集合須與答案完全一致**\n\n## 模式 B｜純數字選項（精簡）\n\n選項僅 1～5 且只問哪個對 → 只詳解答案項，其餘省略。\n\n## 禁止\n\n- 禁止多選只寫部分選項或只報結論\n- 禁止用 `* (A)` bullet\n- 禁止寫「依參考答案選…」而各選項分析與 @@ANSWER@@ 矛盾\n",
    "formats/format-eq-block.md": "---\nid: format-eq-block\nkind: format\nlabel: 等號推導列\nlayout_id: eq-block\ninject: always\npriority: 90\n---\n\n## 用途\n\n一般計算推導、代入、約分、求未知數。與反應表可並用。\n\n## 輸出規格\n\n1. 關鍵式寫在 `$…$` 內；巢狀分式用 `\\dfrac`\n2. 多個等號式同一行時，以 `；`、`，`、`\\text{，}\\quad` 分隔（例：$…=…\\text{，}\\quad x=…$）\n3. 結論：`=\\dfrac{…}{…}\\text{，}\\quad\\text{故 }…`（全形逗號）\n4. 關鍵數字須 `\\htmlData{note=…}{…}`（見 NOTE 附錄）；平方項整段包住，如 `\\htmlData{note=Cu⁺濃度平方}{(2x)^{2}}`，禁止 `\\htmlData{…}{2x}^2`\n5. **表後 $K_c$ 代入行**：只用一行 `$…$`（勿 `$$…$$`）；**2 個** `\\htmlData`（分子、分母）即可\n6. 科學記號：`\\times 10^{-4}`（指數必須 `{}`）；乘號用 `\\times`，禁止 `\\setminus times`\n7. 式內不寫單位；答案句與 @@ANSWER@@ 須附單位\n\n## 禁止\n\n- 禁止裸數字開場\n- 禁止多個 `$…$` 無標點緊貼\n",
    "formats/format-rxn-grid.md": "---\nid: format-rxn-grid\nkind: format\nlabel: 反應變化表（通用）\nlayout_id: rxn-grid\ninject: always\npriority: 100\n---\n\n## 用途\n\n推導須**追蹤各反應物種的量**（莫耳數、濃度、平衡量、解離量、限量消耗等）時使用。\n\n## 列數（依題選一，禁止只寫變化+平衡）\n\n### A｜三列（一般 ICE）\n\n1. 先寫「反應式如下：」\n2. 第 1 列：配平反應式（含 `\\rightleftharpoons` 或 `\\rightarrow`）\n3. 第 2～4 列：`\\text{起始}` → `\\text{變化}` → `\\hline` → `\\text{結果}`（或 `\\text{平衡}`）\n4. 結果列寫**最終量**（如 $0.4-2x$、$x$），不是再寫 $-2x$\n\n### B｜四列（$K$ 很大／很小：先完全反應再回推）\n\n`\\text{起始}` → `\\text{完全向右}`（或 `\\text{右}`）→ `\\text{再向左}`（或 `\\text{左}`）→ `\\hline` → `\\text{平衡}`\n\n例（$2\\text{Cu}^+\\rightleftharpoons\\text{Cu}+\\text{Cu}^{2+}$，$K_c$ 很大）：\n\n$$\n\\begin{array}{lccccc}\n & 2\\text{Cu}^+ & \\rightleftharpoons & \\text{Cu} & + & \\text{Cu}^{2+} \\\\\n\\text{起始 (M)} & 0.4 & & \\text{—} & & 0 \\\\\n\\text{完全向右} & 0 & & \\text{—} & & 0.2 \\\\\n\\text{再向左} & +2x & & \\text{—} & & -x \\\\\n\\hline\n\\text{平衡 (M)} & 2x & & \\text{—} & & 0.2-x \\\\\n\\end{array}\n$$\n\n代入：$K_c=\\dfrac{0.2-x}{(2x)^2}$；$K_c$ 極大時 $0.2-x\\approx 0.2$，**禁止** $0.4-2x\\approx 2x$ 或略過四列表直接用 $(2x)^2$。\n\n## 共通規格\n\n- 每一資料列欄數須與反應式列相同（含 `+`、箭頭欄）\n- 變化量帶正負；固相／純液體欄寫 `—`\n- 數值依本題重算；禁止表外裸寫數字\n\n## 禁止\n\n- 禁止只有「變化濃度／變化」+「平衡濃度／平衡」、**缺起始列**\n- 禁止只有起始+變化、缺結果／平衡列\n- 禁止資料列欄數少於反應式列\n- 禁止 $K$ 極大題用三列 ICE 硬代 $0.4-2x$ 或錯誤近似 $0.4-2x\\approx 2x$\n"
  }
};
