# 板書版型庫（database/formats）

舊版「題型題眼 / 難題 trap」已廢止。此資料夾只放 **板書版型**（layout），由 `同步資料庫.bat` 打包進 `js/database-bundle.js`，解題時由 `board-formats.js` 注入 User 提示。

## 資料夾結構

```
database/
├── formats/        板書版型（rxn-grid、eq-block、cases…）
├── methods.json    保留（可空）
├── _template-*.md  範本（底線開頭不會被打包）
└── README.md
```

## 檔名規則

| 前綴 | 意義 | 範例 |
|------|------|------|
| `format-` | 通用輸出版型 | `format-rxn-grid.md` |

命名：`format-{版型代號}.md`，用連字號。

## YAML 檔頭（必備）

見 `formats/_template-版型.md`。

關鍵欄位：

- `kind`: 固定 `format`
- `layout_id`: 程式／樣式對應代號（如 `rxn-grid`）
- `inject`: `always` 表示每次解題都注入版型說明
- `priority`: 數字越大越靠前

## 版型 vs 題眼

| | 版型 `formats/` | 舊題眼（已刪） |
|--|-----------------|----------------|
| **目的** | 規定**怎麼排版** | 規定**這題怎麼算** |
| **觸發** | `inject: always` 或日後擴充 | 關鍵字 trap |
| **內容** | array 列數、hline、對齊 | 特定數值、if-then |

數字與推導交給 AI（建議 Gemini Pro）；版型只約束外觀。

## 工作流程

1. 新增或修改 `formats/*.md`（用符號，勿抄整題答案）。
2. 執行 **同步資料庫.bat**
3. 重新整理網頁（Ctrl+Shift+R）

## 現有版型

- `format-rxn-grid` — 反應式 + 3～4 行對齊表（通用）
- `format-eq-block` — 等號推導塊
- `format-cases` — 分情況討論
- `format-choice-line` — 選項逐項一行
