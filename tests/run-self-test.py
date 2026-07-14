# -*- coding: utf-8 -*-
"""用途：執行本機 HTTP 冒煙驗收（無需瀏覽器 F12）。

安全提醒：本程式只讀取專案檔案與本機 18080 伺服器，不會修改網站或資料庫內容。
"""
import os
import re
import sys
import urllib.request

# 與「啟動網頁.bat」一致；18080 較不易與常見開發服務衝突。
BASE = "http://localhost:18080"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RENDER_BUILD = "20260713k"
APP_BUILD = "20260714h"
results = []


def ok(name, cond, detail=""):
    results.append({"name": name, "pass": bool(cond), "detail": detail})


def fetch(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return r.read().decode("utf-8", errors="replace")


for path in ["/index.html", f"/js/render.js?v={RENDER_BUILD}", "/tests/verify-build.html", "/js/solve-spec.js?v=20260714d"]:
    try:
        body = fetch(BASE + path)
        ok(f"HTTP {path}", True, f"{len(body)} bytes")
    except Exception as e:
        ok(f"HTTP {path}", False, str(e))

js_path = os.path.join(ROOT, "js", "render.js")
js = open(js_path, encoding="utf-8").read()
ok(f"RENDER BUILD {RENDER_BUILD}", f"__RENDER_BUILD = '{RENDER_BUILD}'" in js)
ok("preprocessBoardCompiledText", "function preprocessBoardCompiledText" in js)
ok("preprocessLegacyPlainText", "function preprocessLegacyPlainText" in js)
ok("legacy default", "__RENDER_PIPELINE_DEFAULT = 'legacy'" in js)
ok("circC repair", "\\\\circC" in js and "circC" in js and "mathrm{C}" in js)
ok("tryRenderBoardDoc", "function tryRenderBoardDoc" in js)

app = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
ok("__LAST_RENDER_PIPELINE", "__LAST_RENDER_PIPELINE" in app)
ok("solveSpec integration", "solveSpec" in app and "getSolveSpec" in app and "formatRoute" in app)
ok("setting validation", "function renderSolveValidation" in app and "getCalcCompactValidation" in app)
ok("reference mismatch review only", "保留原詳解供人工複核" in app and "依參考答案重寫" not in app)

prompts = open(os.path.join(ROOT, "js", "prompts.js"), encoding="utf-8").read()
prompt_compose = open(os.path.join(ROOT, "js", "prompt-compose.js"), encoding="utf-8").read()
ok("checkBoardDoc", "window.checkBoardDoc = function" in prompts)
solution_format = open(os.path.join(ROOT, "js", "solution-format.js"), encoding="utf-8").read()
api_js = open(os.path.join(ROOT, "js", "api.js"), encoding="utf-8").read()
ok("SolutionDocument schema／編譯器", "global.SolutionDocument" in solution_format and "function validateDocument" in solution_format and "function compileDocument" in solution_format)
ok("主流程直接呼叫 Gemini", "function callGemini" in api_js and "generativelanguage.googleapis.com" in api_js)
ok("未指定範圍不全解", "mode: 'default'" in prompts and "return numbers.length ? { mode: 'partial', numbers: numbers } : { mode: 'default', numbers: [] };" in prompts)
ok("單題不開分題標題", "window.__solveMultiQuestion = scope.mode === 'all' || numbers.length > 1;" in js)
ok("分題標題限指定題號", "function isSolveQuestionHeadingAllowed" in js and "window.__solveQuestionNumbers" in js)

nc = open(os.path.join(ROOT, "js", "math-note", "note-check.js"), encoding="utf-8").read()
ok("note-check K_c 排除", "function isEquilibriumKcSubstLine" in nc)
ok("note-check htmlData、單位與速率 NOTE 驗證", "function readHtmlData" in nc and "NOTE 語法不完整" in nc and "unitOnlyCount" in nc and "findPhysicalNotesWithoutUnit" in nc and "findUnderNotedRateTimeSteps" in nc)

render = open(js_path, encoding="utf-8").read()
ok("LaTeX 安全隔離", "function quarantineInvalidLatexSegments" in render and "\\propto" in render)

sanitizer = open(os.path.join(ROOT, "js", "latex-sanitize.js"), encoding="utf-8").read()
ok("LaTeX sanitizer", "function sanitizeText" in sanitizer and "function repairMath" in sanitizer)

app_css = open(os.path.join(ROOT, "css", "app.css"), encoding="utf-8").read()
ok("方程式顯示間距", ".msg-body .katex-display { margin: 12px 0;" in app_css and ".board-scroll .math-block" in app_css)

note_css = open(os.path.join(ROOT, "css", "math-note", "math-note.css"), encoding="utf-8").read()
ok("選項 NOTE 不顯示方塊", ".ai-plain .choice-body .katex" in note_css and "border-bottom: 1px dotted" in note_css)
choice_css = open(os.path.join(ROOT, "css", "plain-choice-options.css"), encoding="utf-8").read()
ok("手機選項固定 grid 欄位", "grid-template-columns: var(--choice-label-column) minmax(0, 1fr)" in choice_css and "@media (max-width: 430px)" in choice_css)
math_note_js = open(os.path.join(ROOT, "js", "math-note", "math-note.js"), encoding="utf-8").read()
ok("NOTE popover 保持可視", "window.innerHeight - pop.offsetHeight - 8" in math_note_js and "document.addEventListener('keydown'" in math_note_js)

ok("中間單位精簡、末結果保留", "function stripRawCalcUnitsInInlineMath" in render and "function isTerminalCalcResultUnit" in render)
ok("NOTE 不包單位本體", "function stripAllCalcUnitsAndEmptyNotes" in render)

ok("Board JSON 相容解析", "function parseBoardJson" in render and "function escapeLatexBackslashesInJson" in render)

structure_layout = open(os.path.join(ROOT, "js", "structure-layout.js"), encoding="utf-8").read()
ok("非結構子項不建立卡片", "const hasDrawBlock = group.slice(1).some(isDrawBlock);" in structure_layout and "group.length >= 2 && hasDrawBlock" in structure_layout)

app = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
ok("主解題採既有 Gemini 流程", "callAPI(cfg, apiMessages, systemText" in app and "setMainSolution(reply)" in app)
ok("NOTE 不再因算式少而略過", "算式行數少，略過 NOTE 密度檢查" not in nc and "觀念／選項判斷" in nc)

bundle = open(os.path.join(ROOT, "js", "database-bundle.js"), encoding="utf-8").read()
ok("bundle format-board-doc inject:false", "format-board-doc" in bundle and "inject: false" in bundle)

try:
    idx = fetch(BASE + "/index.html")
    ok("index → render current build", f"render.js?v={RENDER_BUILD}" in idx)
    ok("index → app current build", f"app.js?v={APP_BUILD}" in idx)
    ok("index → SolutionDocument current build", "solution-format.js?v=20260714a" in idx)
    ok("index → API current build", "api.js?v=20260714d" in idx)
    ok("index → mhchem", "contrib/mhchem.min.js" in idx)
    ok("index → solveSpec current build", "solve-spec.js?v=20260714d" in idx)
    ok("index → option NOTE current style", "math-note/math-note.css?v=20260714a" in idx)
    ok("index → option grid current style", "plain-choice-options.css?v=20260714a" in idx)
    ok("index → structure layout current build", "structure-layout.js?v=20260713b" in idx)
    ok("index → 移除一般入口", "teacher-tools.html\">教師工具" not in idx and "solution-format.html\">排版" not in idx)
except Exception as e:
    ok("index", False, str(e))

print("=== 自動測試（AI解題 Phase 4）===")
passed = 0
for r in results:
    mark = "PASS" if r["pass"] else "FAIL"
    if r["pass"]:
        passed += 1
    d = f" | {r['detail']}" if r["detail"] else ""
    print(f"[{mark}] {r['name']}{d}")
print(f"\n合計 {passed}/{len(results)} 通過")
sys.exit(0 if passed == len(results) else 1)
