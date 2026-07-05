# -*- coding: utf-8 -*-
"""本機自動驗收（無需瀏覽器 F12）"""
import os
import re
import sys
import urllib.request

BASE = "http://localhost:8765"
ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = "20250705p4b"
results = []


def ok(name, cond, detail=""):
    results.append({"name": name, "pass": bool(cond), "detail": detail})


def fetch(url):
    with urllib.request.urlopen(url, timeout=8) as r:
        return r.read().decode("utf-8", errors="replace")


for path in ["/index.html", f"/js/render.js?v={BUILD}", "/verify-build.html"]:
    try:
        body = fetch(BASE + path)
        ok(f"HTTP {path}", True, f"{len(body)} bytes")
    except Exception as e:
        ok(f"HTTP {path}", False, str(e))

js_path = os.path.join(ROOT, "js", "render.js")
js = open(js_path, encoding="utf-8").read()
ok(f"BUILD {BUILD}", f"__RENDER_BUILD = '{BUILD}'" in js)
ok("preprocessBoardCompiledText", "function preprocessBoardCompiledText" in js)
ok("preprocessLegacyPlainText", "function preprocessLegacyPlainText" in js)
ok("board-first default", "__RENDER_PIPELINE_DEFAULT = 'board-first'" in js)
ok("circC repair", "\\\\circC" in js and "circC" in js and "mathrm{C}" in js)
ok("tryRenderBoardDoc", "function tryRenderBoardDoc" in js)

app = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
ok("__LAST_RENDER_PIPELINE", "__LAST_RENDER_PIPELINE" in app)

prompts = open(os.path.join(ROOT, "js", "prompts.js"), encoding="utf-8").read()
ok("checkBoardDoc", "window.checkBoardDoc = function" in prompts)

nc = open(os.path.join(ROOT, "js", "math-note", "note-check.js"), encoding="utf-8").read()
ok("note-check K_c 排除", "function isEquilibriumKcSubstLine" in nc)

bundle = open(os.path.join(ROOT, "js", "database-bundle.js"), encoding="utf-8").read()
ok("bundle format-board-doc inject:false", "format-board-doc" in bundle and "inject: false" in bundle)

try:
    idx = fetch(BASE + "/index.html")
    ok("index → render p4", f"render.js?v={BUILD}" in idx)
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
