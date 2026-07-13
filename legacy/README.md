# Legacy 封存區

建立日期：2026-07-13（Phase 8）

目前此目錄沒有封存任何執行檔。盤點確認下列頁面仍由主頁、教師工具總覽或其他工具頁連結，因此不可搬移：

- `teacher-tools.html`、`knowledge-studio.html`、`method-library.html`
- `problem-analyzer.html`、`answer-audit.html`、`evaluation-lab.html`
- `solution-format.html`、`chemistry-workbench.html`、`db-import.html`、`molfile-preview.html`

封存前必須同時滿足：

1. `rg` 確認沒有主頁、工具頁、腳本、文件或發布流程的有效引用。
2. 已有取代入口，或該功能已停用並經一段觀察期確認。
3. 移入本目錄時保留原始路徑、日期、用途與替代位置的說明。
4. 執行 `python tests/check-js-syntax.py` 與 `python tests/run-self-test.py`，並檢查所有入口連結。

在符合以上條件前，舊 `database/`、工具頁與維護腳本都是相容層的一部分，不得刪除或封存。
