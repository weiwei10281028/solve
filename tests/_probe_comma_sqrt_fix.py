# -*- coding: utf-8 -*-
"""驗證：逗號單位、根號顯示、marked 不吃 \\,。"""
from __future__ import annotations

import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:18084"
OUT = ROOT / "tests" / "_web_api_out"
OUT.mkdir(parents=True, exist_ok=True)

DOC = {
    "blocks": [
        {"type": "heading", "text": "推導"},
        {
            "type": "paragraph",
            "text": "起始醋酸體積20.0, mL，NaOH濃度0.10, M，滴定終點消耗20.0, mL NaOH，可知醋酸濃度亦為0.10, M。總莫耳數為0.002, mol。",
        },
        {
            "type": "paragraph",
            "text": "（甲）加入5.0, mL NaOH時，形成緩衝溶液。CH3COOH剩餘0.0015, mol，CH3COO-生成0.0005, mol。",
        },
        {
            "type": "calculation",
            "text": "[H+]=1.8\\times10^{-5}\\times\\dfrac{0.0015}{0.0005}=5.4\\times10^{-5}",
        },
        {
            "type": "paragraph",
            "text": "（乙）達終點時，溶液為0.05, M的CH3COONa溶液。",
        },
        {
            "type": "calculation",
            "text": "[OH-]=\\sqrt{Kh\\times C}=\\sqrt{5.56\\times10^{-10}\\times0.05}\\approx5.27\\times10^{-6}",
        },
        {
            "type": "calculation",
            "text": "[OH-]=\\dfrac{5.56\\times10^{-10}\\times0.05}{=}",
        },
        {
            "type": "calculation",
            "text": "pOH=-\\log(5.27\\times10^{-6})\\approx5.28",
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
        page = browser.new_page(viewport={"width": 1100, "height": 1200})
        page.goto(f"{BASE}/index.html", wait_until="networkidle")
        page.evaluate(
            """() => {
              document.getElementById('overlay')?.classList.remove('show');
              localStorage.setItem('aik', 'probe-no-key');
            }"""
        )
        page.reload(wait_until="networkidle")
        page.evaluate("""() => { document.getElementById('overlay')?.classList.remove('show'); }""")

        # marked \\, check
        marked_check = page.evaluate(
            r"""() => {
              const sample = '體積$20.0\\,\\mathrm{mL}$，濃度$0.10\\,\\mathrm{M}$。';
              const html = renderMarkdownSolution('【推導】\n' + sample);
              const div = document.createElement('div');
              div.innerHTML = html;
              doKaTeX(div);
              return {
                build: window.__RENDER_BUILD,
                html: div.innerHTML,
                text: div.innerText,
                hasCommaUnit: /20\.0\s*,\s*mL|0\.10\s*,\s*M/i.test(div.innerText),
                hasThinSpace: /20\.0\s*mL|20\.0 mL/.test(div.innerText),
              };
            }"""
        )

        result = page.evaluate(
            """(raw) => {
              const prepared = window.SolutionCore.prepare(raw);
              document.getElementById('resultCard')?.classList.add('show');
              if (typeof setMainSolution === 'function') setMainSolution(prepared.text);
              const board = document.getElementById('mainSolution');
              return {
                ok: prepared.ok,
                text: prepared.text,
                visible: board ? board.innerText : '',
                html: board ? board.innerHTML : '',
                build: window.__RENDER_BUILD,
              };
            }""",
            json.dumps(DOC, ensure_ascii=False),
        )
        page.locator("#mainSolution").screenshot(path=str(OUT / "comma-sqrt-fix.png"))
        browser.close()

    issues = []
    if marked_check.get("hasCommaUnit"):
        issues.append("marked 路徑仍有數字逗號單位")
    if not re.search(r"sqrt-fix|derive-eq|math-protect", str(marked_check.get("build", ""))):
        issues.append(f"build 未更新: {marked_check.get('build')}")

    visible = result["visible"]
    src = result["text"]
    if re.search(r"20\.0\s*[,，]\s*mL|0\.10\s*[,，]\s*M|0\.002\s*[,，]\s*mol", visible, re.I):
        issues.append("畫面仍有數字逗號單位")
    if re.search(r"20\.0\s*[,，]\s*mL|0\.10\s*[,，]\s*M", src, re.I):
        issues.append("compile 仍有數字逗號單位")
    if "\\sqrt" not in src and "√" not in src:
        issues.append("compile 缺少根號")
    if re.search(r"\\dfrac\{[^}]+\}\{\s*=\s*\}", src):
        issues.append("compile 仍有分母為 = 的假分式")
    # 畫面不應再出現「分母只有 =」的怪排版（用 html 檢查）
    if re.search(r"dfrac\{[^}]+\}\{\s*=", result["html"]):
        issues.append("HTML 仍含分母為 = 的 dfrac")

    summary = {
        "ok": not issues,
        "issues": issues,
        "marked_check": {
            "build": marked_check.get("build"),
            "hasCommaUnit": marked_check.get("hasCommaUnit"),
            "text_head": (marked_check.get("text") or "")[:200],
        },
        "visible_head": visible[:400],
        "src_head": src[:500],
    }
    (OUT / "comma-sqrt-fix-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"ok": not issues, "issues": issues, "build": marked_check.get("build")}, ensure_ascii=False))
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
