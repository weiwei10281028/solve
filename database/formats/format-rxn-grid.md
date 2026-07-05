---
id: format-rxn-grid
kind: format
label: 反應變化表（通用）
layout_id: rxn-grid
inject: always
priority: 100
---

## 用途

推導須**追蹤各反應物種的量**（莫耳數、濃度、平衡量、解離量、限量消耗等）時使用。

## 列數（依題選一，禁止只寫變化+平衡）

### A｜三列（一般 ICE）

1. 先寫「反應式如下：」
2. 第 1 列：配平反應式（含 `\rightleftharpoons` 或 `\rightarrow`）
3. 第 2～4 列：`\text{起始}` → `\text{變化}` → `\hline` → `\text{結果}`（或 `\text{平衡}`）
4. 結果列寫**最終量**（如 $0.4-2x$、$x$），不是再寫 $-2x$

### B｜四列（$K$ 很大／很小：先完全反應再回推）

`\text{起始}` → `\text{完全向右}`（或 `\text{右}`）→ `\text{再向左}`（或 `\text{左}`）→ `\hline` → `\text{平衡}`

例（$2\text{Cu}^+\rightleftharpoons\text{Cu}+\text{Cu}^{2+}$，$K_c$ 很大）：

$$
\begin{array}{lccccc}
 & 2\text{Cu}^+ & \rightleftharpoons & \text{Cu} & + & \text{Cu}^{2+} \\
\text{起始 (M)} & 0.4 & & \text{—} & & 0 \\
\text{完全向右} & 0 & & \text{—} & & 0.2 \\
\text{再向左} & +2x & & \text{—} & & -x \\
\hline
\text{平衡 (M)} & 2x & & \text{—} & & 0.2-x \\
\end{array}
$$

代入（**一行、兩個 NOTE，勿用 $$**）：

$K_c=\dfrac{\htmlData{note=平衡時 Cu^{2+}}{0.2-x}}{\htmlData{note=Cu^+ 濃度平方}{(2x)^{2}}}=2\times10^{7}$

$K_c$ 極大時 $0.2-x\approx 0.2$，**禁止** $0.4-2x\approx 2x$ 或略過四列表。

## 共通規格

- 每一資料列欄數須與反應式列相同（含 `+`、箭頭欄）
- 變化量帶正負；固相／純液體欄寫 `—`
- 數值依本題重算；禁止表外裸寫數字

## 禁止

- 禁止只有「變化濃度／變化」+「平衡濃度／平衡」、**缺起始列**
- 禁止只有起始+變化、缺結果／平衡列
- 禁止資料列欄數少於反應式列
- 禁止 $K$ 極大題用三列 ICE 硬代 $0.4-2x$ 或錯誤近似 $0.4-2x\approx 2x$
