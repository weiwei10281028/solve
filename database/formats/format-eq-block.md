---
id: format-eq-block
kind: format
label: 等號推導列
layout_id: eq-block
inject: always
priority: 90
---

## 用途

一般計算推導、代入、約分、求未知數。與反應表可並用。

## 輸出規格

1. 關鍵式寫在 `$…$` 內；巢狀分式用 `\dfrac`
2. 多個等號式同一行時，以 `；`、`，`、`\text{，}\quad` 分隔（例：$…=…\text{，}\quad x=…$）
3. 結論：`=\dfrac{…}{…}\text{，}\quad\text{故 }…`（全形逗號）
4. 關鍵數字須 `\htmlData{note=…}{…}`（見 NOTE 附錄）；**平方項須整段包住**，如 `\htmlData{note=Cu⁺濃度平方}{(2x)^{2}}`，禁止 `\htmlData{…}{2x}^2` 或分母寫 `2x^2`
5. **表後 $K_c$ 代入行**：只用**一行** `$…$`（勿用 `$$…$$`）；**2 個** `\htmlData`（分子、分母）即可，勿再寫 `[Cu^{2+}]` 通式後又嵌套分式
6. 科學記號：`\times 10^{-4}`（指數必須 `{}`）；乘號用 `\times`，禁止 `\setminus times`
7. 式內不寫單位；答案句與 @@ANSWER@@ 須附單位

## 禁止

- 禁止裸數字開場
- 禁止多個 `$…$` 無標點緊貼
