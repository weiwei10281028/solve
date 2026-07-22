# -*- coding: utf-8 -*-
"""重現推導區：dfrac/{=}、步驟等號消失、根號鏈。"""
from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "js" / "solution-core.js").read_text(encoding="utf-8")

SAMPLES = [
    r"K_b=\dfrac{K_w}{K_a}=\dfrac{10^{-14}}{1.8\times10^{-5}}=\dfrac{1}{1.8}\times10^{-9}",
    r"K_b=\dfrac{K_w}{K_a}=\dfrac{10^{-14}}{1.8\times10^{-5}}\dfrac{1}{1.8}\times10^{-9}",
    r"[OH-]=\dfrac{\dfrac{10^{-14}}{1.8\times10^{-5}}\times0.05}{=}=\dfrac{5\times10^{-16}}{1.8\times10^{-5}}=\dfrac{5}{18}\times10^{-11}",
    r"[OH-]=\sqrt{\dfrac{10^{-14}}{1.8\times10^{-5}}\times0.05}=\sqrt{\dfrac{5\times10^{-16}}{1.8\times10^{-5}}}=\sqrt{\dfrac{5}{18}\times10^{-11}}",
    r"[OH-]=\sqrt{Kb\times C}=\sqrt{5.56\times10^{-10}\times0.05}\approx5.27\times10^{-6}",
    r"[OH-]=\dfrac{5.56\times10^{-10}\times0.05}{=}",
]


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content("<html><body></body></html>")
        page.add_script_tag(content=CORE)
        page.evaluate(
            """() => { window.ChemistryLatex = { toCe: (s) => '\\\\ce{' + String(s||'') + '}' }; }"""
        )
        result = page.evaluate(
            """(samples) => samples.map((s) => {
              const out = SolutionCore.calculation(s);
              return {
                in: s,
                out,
                hasDenomEq: /\\\\dfrac\{[\s\S]*\}\{\s*=\s*\}/.test(out) || /dfrac\{[^]*\}\{\s*=/.test(out),
                hasSqrt: out.includes('\\\\sqrt') || out.includes('\\sqrt'),
                approxCount: (out.match(/\\\\approx|=/g) || []).length,
              };
            })""",
            SAMPLES,
        )
        browser.close()

    out_path = ROOT / "tests" / "_probe_derive_fix_out.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for row in result:
        print("---")
        print("IN ", row["in"][:100])
        print("OUT", row["out"][:160])
        print("flags", {k: row[k] for k in ("hasDenomEq", "hasSqrt", "approxCount")})
    bad = [r for r in result if r["hasDenomEq"]]
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
