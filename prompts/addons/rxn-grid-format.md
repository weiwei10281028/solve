【反應變化表｜array 格式規範（列標逐字照抄，數值依題重算）】

## 列數（依題二選一，禁止只寫兩列）

### A｜三列（一般 ICE）
第 1 列：配平反應式 → 第 2 列 `\text{起始}` → 第 3 列 `\text{變化}` → `\hline` → 第 4 列 `\text{結果}` 或 `\text{平衡}`

### B｜四列（$K$ 很大／很小：先完全反應再回推）
第 1 列：配平反應式 → `\text{起始}` → `\text{完全向右}`（或 `\text{右}`）→ `\text{再向左}`（或 `\text{左}`）→ `\hline` → `\text{平衡}`

## 三列模板（欄數須與反應式相同）

反應式如下：
$$\begin{array}{ccccc}
2\text{Cu}^+ & \rightleftharpoons & \text{Cu} & + & \text{Cu}^{2+} \\
\hline
\text{起始 (M)} & 0.4 & & \text{—} & & 0 \\
\text{變化 (M)} & -2x & & \text{—} & & +x \\
\hline
\text{平衡 (M)} & 0.4-2x & & \text{—} & & x \\
\end{array}$$

## 四列模板（$K_c$ 極大，如 $2\text{Cu}^+\rightleftharpoons\text{Cu}+\text{Cu}^{2+}$）

反應式如下：
$$\begin{array}{lccccc}
 & 2\text{Cu}^+ & \rightleftharpoons & \text{Cu} & + & \text{Cu}^{2+} \\
\text{起始 (M)} & 0.4 & & \text{—} & & 0 \\
\text{完全向右} & 0 & & \text{—} & & 0.2 \\
\text{再向左} & +2x & & \text{—} & & -x \\
\hline
\text{平衡 (M)} & 2x & & \text{—} & & 0.2-x \\
\end{array}$$

## 平衡常數與近似（$K_c$ 極大）

- 四列表代入（一行、兩個 NOTE）：$K_c=\dfrac{\htmlData{note=平衡時 Cu^{2+}}{0.2-x}}{\htmlData{note=Cu^+ 濃度平方}{(2x)^{2}}}=2\times10^{7}$（**禁止** $$…$$ 再寫通式）
- 因 $K_c$ 極大，$x$ 極小，故 $0.2-x\approx 0.2$（**不是** $0.4-2x\approx 2x$）
- 分母 $[\text{Cu}^+]=2x$ 很小時可寫 $0.4-2x\approx 0$，**禁止**把分母近似成 $2x$ 再平方成 $(2x)^2$ 卻仍用三列 ICE 硬代

## 禁止

- 禁止只寫「變化濃度」+「平衡濃度」而**缺起始列**
- 禁止結果／平衡列再寫 $-2x$（變化量）；須寫 $0.4-2x$、$x$ 等**最終量**
- 禁止 $K$ 極大題略過「完全向右／再向左」直接用 $0.4-2x$ 或 $(2x)^2$ 代入
- 禁止表外裸寫對齊數字；表內每一資料列欄數須與反應式列相同
