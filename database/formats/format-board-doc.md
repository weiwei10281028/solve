---
id: format-board-doc
kind: format
label: BoardDoc 結構化板書（選用）
layout_id: board-doc
inject: false
priority: 110
---

## 選用

前端**優先**解析 `@@BOARD@@ … @@END@@` JSON；無 BoardDoc 時走傳統 LaTeX 詳解（預設）。

## blocks 型別

| type | 用途 |
|------|------|
| `section` | `{ "title": "詳解" }` |
| `paragraph` | `{ "parts": [{ "kind":"text" }, { "kind":"math","latex" }] }` |
| `math` | `{ "display": true/false, "latex": "…" }` |
| `rxn-table` | 結構化反應表（見 rxn-grid） |
| `choice-group` | `{ "items": [{ "letter":"A", "parts":[…] }] }` |
| `mol` | `{ "query":"苯" }` |

## answer

JSON 內 `"answer"` + `@@END@@` 後 `@@ANSWER@@` 一行。
