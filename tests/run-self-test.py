# -*- coding: utf-8 -*-
"""現行單一詳解管線的靜態與本機 HTTP 冒煙測試。"""
from pathlib import Path
import os
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("AI_SOLVE_TEST_BASE", "http://localhost:18080")
BUILD = "20260719-flash-crosscheck"
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
note = read("css/math-note/math-note.css")

check("單一 Markdown 渲染器", "function renderMarkdownSolution" in render and "renderCompiledSolution" not in app)
schema_source = core.split("const SYSTEM", 1)[0]
check("扁平穩定詳解 schema", "type: { type: 'string'" in schema_source and "text: { type: 'string'" in schema_source and "rows:" not in schema_source)
check("每個實際選項都要分析", "最後逐項分析題目實際出現的每個選項" in core)
check("選項數量與標籤不限", "不預設選項數量、標籤形式或順序" in core and "A～E" not in core)
check("進階功能未包含逐項分析開關", "solveTypeChoice" not in index and "optionMode" not in prompts)
check("停用的格式入口已移除", "solution-format.js" not in index and "SolutionDocument" not in app and "BoardDoc" not in render)
check("舊 ai-plain 排版已移除", "ai-plain" not in board and "ai-plain" not in note)
check("選項標籤與文字固定對齊", "grid-template-columns: 2rem minmax(0, 1fr)" in board and ".markdown-choice-label" in board)
check("一般文字自然換行", ".markdown-choice-body" in board and "white-space: normal" in board)
check("只有公式主導行橫滑", "function isFormulaDominantLine" in render and "if (!isFormulaDominantLine(content))" in render)
check("橫滑箭頭已移除", "plain-line-inner--xscroll::after" not in board and 'content: "↔"' not in board)
check("現行版本已載入", f"render.js?v={BUILD}" in index and f"board.css?v={BUILD}" in index)
check("唯一 system prompt", "const systemText = window.SolutionCore.buildSystem();" in app)
check("主流程直接使用結構化回覆", "schema: responseSchema" in app and "window.SolutionCore.prepare(reply)" in app)
check("進階路由無自動舊格式", "autoFormatId" not in spec and "buildRouteUserBlock" not in spec)
check("免費 Flash 模型清單", all(model in app for model in ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3-flash-preview"]) and "gemini-pro" not in app)
check("預設使用 3.5 Flash", "loadSetting('aim', 'gemini-3.5-flash')" in app)
check("參考答案未鎖入 schema", "enum: [answer]" not in app and "JSON.parse(JSON.stringify(window.SolutionCore.SCHEMA))" in app)
check("另一個 Flash 獨立驗證", "verificationModelFor(cfg.model)" in app and "不預設參考答案正確" in prompts)
check("缺少明確驗證不放行", "parsed?.consistent === true" in app)
check("本機算式驗算與一次修正", "auditCalculationDocument(prepared.document)" in app and "const corrected = await callAPI" in app)
check("畫面不再宣稱答案鎖定", "參考答案（選填）" in index and "答案欄會被鎖定" not in index)
check("舊 Pro 提示已移除", "Gemini 3.1 Pro" not in read("js/api.js"))

for path in ["/index.html", f"/js/render.js?v={BUILD}", "/tests/verify-build.html", "/tests/test-pipeline.html"]:
    try:
        payload = fetch(path)
        check(f"HTTP {path}", bool(payload), f"{len(payload)} bytes")
    except Exception as exc:
        check(f"HTTP {path}", False, str(exc))

print("=== 現行詳解管線測試 ===")
for name, passed, detail in results:
    suffix = f" | {detail}" if detail else ""
    print(f"[{'PASS' if passed else 'FAIL'}] {name}{suffix}")
passed_count = sum(passed for _, passed, _ in results)
print(f"\n合計 {passed_count}/{len(results)} 通過")
sys.exit(0 if passed_count == len(results) else 1)
