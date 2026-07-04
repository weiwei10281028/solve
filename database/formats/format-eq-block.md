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
2. 多個等號式同一行時，以 `；`、`，`、`故` 分隔
3. 結論：`=\dfrac{…}{…}\text{，}\quad\text{故 }…`（全形逗號）
4. 關鍵數字須 `\htmlData{note=…}{…}`（見 NOTE 附錄）
5. 式內不寫單位；答案句與 @@ANSWER@@ 須附單位

## 禁止

- 禁止裸數字開場
- 禁止多個 `$…$` 無標點緊貼
