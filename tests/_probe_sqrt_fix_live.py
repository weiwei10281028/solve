# -*- coding: utf-8 -*-
"""重現截圖：$$ 裸露、allingdotseq、\\sqrt( 根號。"""
from __future__ import annotations

import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:18084"
OUT = ROOT / "tests" / "_web_api_out"
OUT.mkdir(parents=True, exist_ok=True)

# 模擬 JSON 把 \f 吃掉後的字串（form feed + allingdotseq）
FF = "\x0c"
DOC = {
    "blocks": [
        {"type": "heading", "text": "推導"},
        {
            "type": "paragraph",
            "text": "（甲）加入5.0 mL NaOH後形成緩衝溶液。CH3COOH剩餘莫耳數為0.10 \\times (20.0-5.0)=1.5 mmol。",
        },
        {
            "type": "calculation",
            "text": f"K_b=\\dfrac{{K_w}}{{K_a}}=\\dfrac{{1.0\\times10^{{-14}}}}{{1.8\\times10^{{-5}}}}{FF}allingdotseq5.56\\times10^{{-10}}",
        },
        {
            "type": "calculation",
            "text": "[OH-]=\\dfrac{\\sqrt{(K_b\\times C)}=\\sqrt{(5.56\\times10^{-10}\\times0.05)}=\\sqrt{(2.78\\times10^{-11})}"
            + f"{FF}allingdotseq5.27\\times10^{{-6}}",
        },
        {
            "type": "calculation",
            "text": "pH=14-5.28=8.72",
        },
    ],
    "answer": "D",
}


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1100, "height": 900})
        page.goto(f"{BASE}/index.html", wait_until="networkidle")
        page.evaluate(
            """() => {
              document.getElementById('overlay')?.classList.remove('show');
              localStorage.setItem('aik', 'probe-no-key');
            }"""
        )
        page.reload(wait_until="networkidle")
        page.evaluate("""() => { document.getElementById('overlay')?.classList.remove('show'); }""")
        result = page.evaluate(
            """(raw) => {
              const prepared = window.SolutionCore.prepare(raw);
              document.getElementById('resultCard')?.classList.add('show');
              setMainSolution(prepared.text);
              const board = document.getElementById('mainSolution');
              return {
                build: window.__RENDER_BUILD,
                text: prepared.text,
                visible: board ? board.innerText : '',
                html: board ? board.innerHTML : '',
              };
            }""",
            json.dumps(DOC, ensure_ascii=False),
        )
        page.locator("#mainSolution").screenshot(path=str(OUT / "sqrt-fix-live.png"))
        browser.close()

    issues = []
    vis = result["visible"]
    src = result["text"]
    html = result["html"]
    if not re.search(r"sqrt-fix|derive-eq|math-protect", str(result.get("build", ""))):
        issues.append(f"build 未更新: {result.get('build')}")
    # 畫面不應留下未渲染的 $...$ 整段（KaTeX 失敗時的特徵）
    if re.search(r"\$\[\\ce\{OH|\\dfrac\{\\sqrt", vis):
        issues.append("畫面仍有未渲染的根號算式")
    if "$$" in src:
        issues.append("compile 仍產出 $$")
    if "$$" in vis:
        issues.append("畫面仍露出 $$")
    if re.search(r"allingdotseq", vis, re.I) or re.search(r"allingdotseq", src, re.I):
        issues.append("仍有 allingdotseq")
    if re.search(r"\\sqrt\s*\(", src):
        issues.append("compile 仍有 \\sqrt(")
    if "\\dfrac{\\sqrt" in src.replace(" ", ""):
        issues.append("根號鏈仍被誤包在 dfrac 裡")

    summary = {
        "ok": not issues,
        "issues": issues,
        "build": result.get("build"),
        "src": src,
        "visible_head": vis[:500],
    }
    (OUT / "sqrt-fix-live-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"ok": not issues, "issues": issues, "build": result.get("build")}, ensure_ascii=False))
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
