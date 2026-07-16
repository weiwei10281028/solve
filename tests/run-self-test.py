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
RENDER_BUILD = "20260716-clean"
APP_BUILD = "20260716-clean2"
SOLVE_SPEC_BUILD = "20260716-clean"
SOLUTION_CORE_BUILD = "20260717-acid1"
results = []


def ok(name, cond, detail=""):
    results.append({"name": name, "pass": bool(cond), "detail": detail})


def fetch(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return r.read().decode("utf-8", errors="replace")


for path in ["/index.html", f"/js/render.js?v={RENDER_BUILD}", "/tests/verify-build.html", f"/js/solve-spec.js?v={SOLVE_SPEC_BUILD}", f"/js/solution-core.js?v={SOLUTION_CORE_BUILD}"]:
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
output_gate = open(os.path.join(ROOT, "js", "solution-output-gate.js"), encoding="utf-8").read()
api_js = open(os.path.join(ROOT, "js", "api.js"), encoding="utf-8").read()
ok("SolutionDocument schema／編譯器", "global.SolutionDocument" in solution_format and "function validateDocument" in solution_format and "function compileDocument" in solution_format)
ok("詳解輸出閘門", "global.SolutionOutputGate" in output_gate and "function chemicalIssues" in output_gate and "function check" in output_gate and "缺少大括號" in output_gate and "任何 NOTE 提示都不得阻擋" in output_gate)
ok("渲染前格式／化學式阻擋", "詳解格式檢查未通過" in app and "chemicalIssues" in app)
ok("DOM 插入前再次檢查", "DOM 插入前再次阻擋" in app and "skipOutputGate" in app)
solution_core = open(os.path.join(ROOT, "js", "solution-core.js"), encoding="utf-8").read()
solve_spec = open(os.path.join(ROOT, "js", "solve-spec.js"), encoding="utf-8").read()
ok("NOTE 單一路徑", "function annotateQuantities" in solution_core and "function annotateBareNumbers" in solution_core and "window.NoteRules" in app and "NoteEnsure" not in app)
ok("Gemini 使用結構化 schema", "responseFormat:" in app and "mimeType: 'APPLICATION_JSON'" in app and "schema: window.SolutionCore.SCHEMA" in app and "species" in solution_core and "rows" in solution_core)
ok("未勾選不啟用進階功能", "return { id: 'plain', origin: 'auto'" in solve_spec and "forceStoichiometry: false" in solve_spec)
ok("已勾選功能進入 system prompt", "function buildActiveBlock" in solve_spec and "buildSystem(teachingRules.systemAddon, advancedBlock)" in app)
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
ok("雙反斜線 mhchem 在驗證前正規化", r"replace(/\\\\ce(?=\{)/g, '\\ce')" in sanitizer)

app_css = open(os.path.join(ROOT, "css", "app.css"), encoding="utf-8").read()
ok("方程式顯示間距", ".msg-body .katex-display { margin: 12px 0;" in app_css and ".board-scroll .math-block" in app_css)

note_css = open(os.path.join(ROOT, "css", "math-note", "math-note.css"), encoding="utf-8").read()
ok("選項 NOTE 無虛線", ".ai-plain .choice-body .katex" in note_css and "border-bottom: 0 !important" in note_css and "border-bottom: 1px dotted" not in note_css)
studio_theme = open(os.path.join(ROOT, "css", "studio-theme.css"), encoding="utf-8").read()
ok("深色 NOTE 與 hero 淺金色", 'body[data-theme="lunar"] .katex :is(.math-note, [data-note], [note])' in studio_theme and "--hero-accent: #ead49a" in studio_theme)
board_css = open(os.path.join(ROOT, "css", "board.css"), encoding="utf-8").read()
ok("手機選項固定 grid 欄位", "grid-template-columns: var(--choice-label-column) minmax(0, 1fr)" in board_css and "@media (max-width: 430px)" in board_css)
ok("公式列只保留單一透明橫軸捲動", "scrollbar-color: #aeb4ba transparent" in board_css and "::-webkit-scrollbar-track" in board_css and "background: transparent;" in board_css and ".ai-plain .katex-display" in board_css)
math_note_js = open(os.path.join(ROOT, "js", "math-note", "math-note.js"), encoding="utf-8").read()
ok("NOTE popover 保持可視", "window.innerHeight - pop.offsetHeight - 8" in math_note_js and "document.addEventListener('keydown'" in math_note_js)
ok("NOTE 上下標沿用科學 token 管線", "window.normalizeScientificTokens" in math_note_js and "renderMathInElement(pop" in math_note_js)

ok("語意 token 統一走 KaTeX", "function normalizeScientificTokens" in render and "function wrapSemanticMathTokens" in render)
ok("化學 token 統一交給 mhchem", "function wrapChemFormula" in render and "function wrapBareMhchemTokens" in render and "\\\\ce{" in render)
ok("化學式只走 KaTeX mhchem", "return `\\\\ce{${chemistry}}`;" in render and "function fallbackMhchemLatex" not in render)
ok("長公式依實際溢出橫滑", "function measureAtomicFormulaOverflow" in render and "function isFormulaScrollCandidate" in render and "可左右滑動查看完整公式" in render)
ok("不再移除算式中的單位或 NOTE", "text = stripAllCalcUnitsAndEmptyNotes(text);" not in render and "text = stripRawCalcUnitsInInlineMath(text);" not in render)

ok("Board JSON 相容解析", "function parseBoardJson" in render and "function escapeLatexBackslashesInJson" in render)

chem_structure = open(os.path.join(ROOT, "js", "chem-structure.js"), encoding="utf-8").read()
ok("非結構子項不建立卡片", "const hasDrawBlock = group.slice(1).some(isDrawBlock);" in chem_structure and "group.length >= 2 && hasDrawBlock" in chem_structure)

app = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
ok("主解題採單次 Gemini＋本機編譯", app[app.find("async function startSolve()"):app.find("async function sendFollowUp")].count("callAPI(") == 1 and "SolutionCore.prepare(reply);" in app and "setMainSolution(reply" in app)
ok("結構化詳解略過舊重寫閘門", "skipOutputGate: true, skipLegacyGate: true" in app and "renderCompiledSolution(body)" in app)
ok("選項完整性最終閘門", "ensureChoiceCompletenessReply" in app and "選項完整性錯誤" in app and "checkChoiceAnalysisCompleteness" in prompts)
ok("NOTE 不再因算式少而略過", "算式行數少，略過 NOTE 密度檢查" not in nc and "觀念／選項判斷" in nc)

bundle = open(os.path.join(ROOT, "js", "database-bundle.js"), encoding="utf-8").read()
ok("bundle format-board-doc inject:false", "format-board-doc" in bundle and "inject: false" in bundle)

try:
    idx = fetch(BASE + "/index.html")
    ok("index → render current build", f"render.js?v={RENDER_BUILD}" in idx)
    ok("index → app current build", f"app.js?v={APP_BUILD}" in idx)
    ok("index → SolutionDocument current build", "solution-format.js?v=20260716-clean" in idx)
    ok("index → output gate current build", "solution-output-gate.js?v=20260716-clean" in idx)
    ok("index → API current build", "api.js?v=20260716-clean" in idx)
    ok("index → mhchem", "contrib/mhchem.min.js" in idx)
    ok("index → solveSpec current build", f"solve-spec.js?v={SOLVE_SPEC_BUILD}" in idx)
    ok("index → solution core current build", f"solution-core.js?v={SOLUTION_CORE_BUILD}" in idx)
    ok("index → option NOTE current style", "math-note/math-note.css?v=20260716-clean" in idx)
    ok("index → option grid current style", "board.css?v=20260716-clean" in idx and "plain-choice-options.css" not in idx)
    ok("index → structure layout current build", "chem-structure.js?v=20260716-clean" in idx and "chem-structure.css?v=20260716-clean" in idx and "structure-layout.js" not in idx)
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
