# -*- coding: utf-8 -*-
"""Catch fake fix: E wrong because 533s not 800s (still assumes blue)."""
from __future__ import annotations

import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", 0), SimpleHTTPRequestHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        page.goto(f"{base}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.ChemRuleCards && ChemRuleCards.claimsBlueTimeWithoutNoBlue === undefined || true")
        page.wait_for_function("() => typeof ChemRuleCards.auditDocument === 'function'")

        # 使用者截圖那種「假修正」
        fake = {
            "blocks": [
                {"type": "heading", "text": "依據"},
                {"type": "paragraph", "text": "甲溶液由 0.428 g KIO3（214）配成 100 mL，乙為 0.004 M NaHSO3。"},
                {"type": "heading", "text": "選項分析"},
                {"type": "choice", "text": "（A）對 IO3- 為二級反應，正確。"},
                {"type": "choice", "text": "（E）經計算預測時間約為 533 秒，非 800 秒，錯誤。"},
            ],
            "answer": "A,C",
        }
        audit = page.evaluate("(doc) => ChemRuleCards.auditDocument(doc, {card:null})", fake)
        print("FAKE_ISSUES", audit.get("issues"))
        print("RATIO", audit.get("ratioInfo"))
        assert audit.get("ratioInfo") and audit["ratioInfo"]["ratio"] <= 1 / 3 + 1e-9, audit
        assert any("不變藍" in x or "預測秒數" in x or "533" in x or "秒數" in x for x in audit["issues"]), audit
        assert page.evaluate("(a) => ChemRuleCards.hasNoBlueTimeViolation(a)", audit)

        good = {
            "blocks": [
                {"type": "heading", "text": "選項分析"},
                {"type": "choice", "text": "（E）甲 1 mL、乙 15 mL 時 n(IO3)/n(HSO3)=1/3，不變藍、時間不適用，敘述錯誤。"},
            ],
            "answer": "A,C",
        }
        audit_ok = page.evaluate(
            "(doc) => ChemRuleCards.auditDocument(doc, {card: ChemRuleCards.getById('iodine-clock')})",
            good,
        )
        print("GOOD_ISSUES", audit_ok.get("issues"))
        assert not page.evaluate("(a) => ChemRuleCards.hasNoBlueTimeViolation(a)", audit_ok), audit_ok

        print("PASS")
        page.context.browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
