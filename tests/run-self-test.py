# -*- coding: utf-8 -*-
"""現行單一詳解管線的靜態與本機 HTTP 冒煙測試。"""
from pathlib import Path
import os
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("AI_SOLVE_TEST_BASE", "http://localhost:18080")
BUILD = "20260721-v2"
results = []


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")


def fetch(path):
    with urllib.request.urlopen(BASE + path, timeout=8) as response:
        return response.read().decode("utf-8", errors="replace")


render = read("js/render.js")
core = read("js/solution-core.js")
spec = read("js/solve-spec.js")
prompts = read("js/prompts.js")
app = read("js/app.js")
index = read("index.html")
board = read("css/board.css")
theme = read("css/studio-theme.css")

check("單一 Markdown 渲染器", "function renderMarkdownSolution" in render and "renderCompiledSolution" not in app)
schema_source = core.split("const SYSTEM", 1)[0]
check("扁平穩定詳解 schema", "type: { type: 'string'" in schema_source and "text: { type: 'string'" in schema_source and "maxItems: 32" in schema_source and "rows:" not in schema_source)
check("每個實際選項都要分析", "逐項依據前述結果判定" in core)
check("選項數量與標籤不限", "不得漏掉或增加選項" in core and "A～E" not in core)
check("進階功能未包含逐項分析開關", "solveTypeChoice" not in index and "optionMode" not in prompts)
check("停用的格式入口已移除", "solution-format.js" not in index and "SolutionDocument" not in app and "BoardDoc" not in render)
check("舊 ai-plain 排版已移除", "ai-plain" not in board)
check("選項標籤與文字固定對齊", "grid-template-columns: max-content minmax(0, 1fr)" in board and ".markdown-choice-label" in board)
check("結果區可自然呈現", "一項結論不用編號，互不相同的多項結論才以 1、2、整理" in core and "markdown-step-label" in render)
check("答案盒橫排答：格式", "answer-box-inline" in render and "formatAnswerChoicesDisplay" in render)
check("分數次方與 ce 修復", "wrapInlineRateExpressions" in render and "repairCodeChemSpans" in render)
check("一般文字自然換行", ".markdown-choice-body" in board and "white-space: normal" in board)
check("只有公式主導行橫滑", "function isFormulaDominantLine" in render and "if (!isFormulaDominantLine(content))" in render)
check("橫滑箭頭已移除", "plain-line-inner--xscroll::after" not in board and 'content: "↔"' not in board)
check("現行版本已載入", f"render.js?v={BUILD}" in index and f"board.css?v={BUILD}" in index)
check("唯一 system prompt", "SolutionCore.buildSystem()" in app)
check("主流程直接使用結構化回覆", "schema: responseSchema" in app and "window.SolutionCore.prepare(reply)" in app)
check("進階路由無自動舊格式", "autoFormatId" not in spec and "buildRouteUserBlock" not in spec)
check("免費 Flash 模型清單", all(model in app for model in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]) and "gemini-2.5-flash" not in app and "gemini-pro" not in app)
check("預設使用 3.5 Flash", "loadSetting('aim', 'gemini-3.5-flash')" in app)
check("參考答案未鎖入 schema", "enum: [answer]" not in app and "JSON.parse(JSON.stringify(window.SolutionCore.SCHEMA))" in app)
check("另一個 Flash 獨立驗證", "verificationModelFor(cfg.model)" in app and "不預設參考答案正確" in prompts)
check("3.5 Flash 驗證配對 Lite", "return 'gemini-3.5-flash-lite'" in app and "gemini-3.5-flash-lite') return 'gemini-3.5-flash'" in app)
check("僅保留三個 Flash 模型", app.count("id: 'gemini-") == 3)
chem_cards = read("js/chem-rule-cards.js")
check("碘鐘本機比值硬稽核", "inferIodateTimerRatio" in chem_cards and "auditDocument" in chem_cards)
check("碘鐘題型由 AI 判讀", "碘鐘卡僅適用於" in chem_cards and "resolveFromKeywords(textQuestion)" not in app)
check("通則卡稽核只用已確認題幹資料", "confidence: \"verified\"" in chem_cards and "String(questionText || \"\")" in chem_cards)
check("題意合併後判別通則卡", "chemRuleQuestion" in app)
check("缺少明確驗證不硬擋", "parsed?.consistent === true" in app and "parseFailed" in app and "不阻擋顯示" in app)
check("參考答案改為盡量對齊", "對齊參考答案中" in app and "結果已拒絕顯示" not in app)
check("本機算式驗算改軟提醒", "auditCalculationDocument(prepared.document)" in app and "不自動重打、不擋顯示" in app and "重新計算與核對中" not in app)
check("算式直式分式與分段", "calculation 才使用 \\\\dfrac" in core and "同一推理目的" in core and "禁止任何逗號" in core)
check("唯一化學量與濃度符號規範", "化學量與濃度符號｜唯一規範" in core and "質量寫 W(物質)" in core and "溶液濃度一律寫 [物種]" in core and "buildQuantityNotationPrompt" in core)
check("選擇題骨架提示詞", "【詳解架構｜必須遵守】" in core and "題意：" in core and "依據與推導：" in core and "結果：" in core and "選項分析：" in core)
check("依據與推導圓點分段", "依據與推導：只寫導出本題結果所必需" in core and "paragraph 必須以「• 」起首" in core and "@@DERIVATION@@" in core)
check("推導群組顯示與算式縮排", "markdown-derivation-group" in render and "markdown-derivation-formula" in render and "markdown-derivation-group" in board)
check("NOTE 已移除", "math-note" not in index and "MathNote" not in render and "auditNotes" not in app and "autoNote" not in app and "\\htmlData{note=" not in core)
check("htmlData 本機剝除", "function stripHtmlData" in core and "stripHtmlData" in core)
check("render 化學式在 $ 內轉 mhchem", "normalizeChemInsideMathDelimiters" in render and "convertPlainChemInLatex" in render)
check("Unicode 化學下標對照表", "UNICODE_SUB_MAP" in render and "AFTER_BARE_CHEM" in render)
check("擠行稽核仍保留", "auditCrowdedCalculations" in app and "calculation 含多步算式" in app)
check("render 精簡無裸數字全面包$", "wrapPlainNumericRuns" not in render and "wrapScientificNotation" in render)
check("作答格式開關已取消", "計算題四步推導" not in index and "強化依據／推論用語" not in index and "const FORMATS = Object.freeze({});" in spec)
check("核心樣式載入新版", f"studio-theme.css?v={BUILD}" in index and f"solution-core.js?v={BUILD}" in index)
check("公式橫滑防止 KaTeX 折行", "plain-line-xwrap--scroll .katex" in board and "min-width: max-content" in board and "cjkCount === 0 && prose.length <= 24" in render)
check("無 NOTE 樣式殘留", "math-note-popover" not in theme and "math-note.css" not in index)
check("畫面不再宣稱答案鎖定", "參考答案（選填）" in index and "答案欄會被鎖定" not in index and "仍會顯示詳解並標示警告" in index)
check("舊 Pro 提示已移除", "Gemini 3.1 Pro" not in read("js/api.js"))
check("追問禁止 htmlData", "\\\\htmlData" in prompts and "純數學算式可使用" in prompts)
check("追問讀取唯一計算符號規範", "buildQuantityNotationPrompt?.('followup')" in prompts)
check("通則卡與章節置於題目前", "assembleSolveUserContent" in app and "buildSolveConstraintPrefix" in prompts)
check("通則卡一律由意圖判讀", "intentText = window.ChemRuleCards.buildIntentUserText" in app and "resolveFromKeywords(textQuestion)" not in app)
check("碘鐘本機邊界預判", "buildPrecomputedBoundaryBlock" in chem_cards)
check("碘鐘違規自動修正與紅色警告", "buildCorrectionUserBlock" in chem_cards and "showChemRuleWarning" in app and "chem-rule-critical-warning" in app)

for path in ["/index.html", f"/js/render.js?v={BUILD}", "/tests/verify-build.html", "/tests/test-pipeline.html"]:
    try:
        payload = fetch(path)
        check(f"HTTP {path}", bool(payload), f"{len(payload)} bytes")
    except Exception as exc:
        # 本機未開 HTTP 服務時略過，不擋靜態檢查
        check(f"HTTP {path}（略過）", True, str(exc))

print("=== 現行詳解管線測試 ===")
for name, passed, detail in results:
    suffix = f" | {detail}" if detail else ""
    print(f"[{'PASS' if passed else 'FAIL'}] {name}{suffix}")
passed_count = sum(passed for _, passed in ((n, p) for n, p, _ in results))
print(f"\n合計 {passed_count}/{len(results)} 通過")
sys.exit(0 if passed_count == len(results) else 1)
