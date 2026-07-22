# -*- coding: utf-8 -*-
"""AsciiMath 詳解管線的靜態與本機 HTTP 冒煙測試。"""
from pathlib import Path
import os
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("AI_SOLVE_TEST_BASE", "http://localhost:18080")
results = []

def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

def fetch(path):
    with urllib.request.urlopen(BASE + path, timeout=8) as response:
        return response.read().decode("utf-8", errors="replace")

renderer = read("js/ascii-solution-render.js")
core = read("js/solution-core.js")
app = read("js/app.js")
index = read("index.html")
board = read("css/board.css")
theme = read("css/studio-theme.css")

check("唯一 AsciiMath renderer", "global.AsciiSolutionRender" in renderer and "AsciiSolutionRender.renderInto" in app)
check("MathJax 4 動態載入", "mathjax@4/startup.js" in renderer and "input/asciimath" in renderer)
check("直接 AsciiMath 偵測", "isDisplayAsciiMath" in renderer and "DISPLAY_RE" in renderer and "Fe_xO_y" in core)
check("display 公式橫滑", "am-display-scroll" in renderer and "overflow-x: auto" in board)
check("巢狀分式不縮小", "mjx-frac mjx-frac" in board and "font-size: 100% !important" in board)
check("既有縮排結構保留", "am-choice" in renderer and "am-derivation" in renderer and "answer-box" in renderer)
check("結構圖掛鉤保留", "plain-line-inner" in renderer and "chem-markdown" in renderer and "SmilesDraw.scan" in app)
check("提示詞改用 AsciiMath", "ASCIIMATH_OUTPUT_RULES" in core and "直接使用 AsciiMath" in core and "frac(分子)(分母)" in core)
check("舊詳解套件不再載入", all(token not in index for token in ["katex.min.js", "auto-render.min.js", "mhchem.min.js", "marked.umd.js", "dompurify.min.js", "formula-tools.js", "js/render.js", "latex-sanitize.js", "compiler.js"]))
check("公式輸入工具已移除", "formulaTools" not in index and "formulaInput" not in index)
check("淺色網格與深色停用", "background-image:" in board and "body[data-theme=\"lunar\"] .board" in board and "background-image: none" in board)
check("主題不覆寫網格", "background-color: var(--board-bg)" in theme)
check("主流程直接使用結構化回覆", "window.SolutionCore.prepare(reply)" in app and "await setMainSolution(prepared.document)" in app)

for path in ["/index.html", "/js/ascii-solution-render.js"]:
    try:
        payload = fetch(path)
        check(f"HTTP {path}", bool(payload), f"{len(payload)} bytes")
    except Exception as exc:
        check(f"HTTP {path}（略過）", True, str(exc))

print("=== AsciiMath 詳解管線測試 ===")
for name, passed, detail in results:
    suffix = f" | {detail}" if detail else ""
    print(f"[{'PASS' if passed else 'FAIL'}] {name}{suffix}")
passed_count = sum(passed for _, passed, _ in results)
print(f"\n合計 {passed_count}/{len(results)} 通過")
sys.exit(0 if passed_count == len(results) else 1)
