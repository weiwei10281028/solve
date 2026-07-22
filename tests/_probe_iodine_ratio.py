# -*- coding: utf-8 -*-
"""Verify local iodate ratio audit catches 800s when ≤1/3."""
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
        page.wait_for_function("() => window.ChemRuleCards && ChemRuleCards.inferIodateTimerRatio")

        ratio = page.evaluate(
            """() => ChemRuleCards.inferIodateTimerRatio(
              '混合後 [IO3-]=0.001 M，[HSO3-]=0.003 M。速率比 1/16，t=800 秒。'
            )"""
        )
        print("RATIO", ratio)
        assert ratio and abs(ratio["ratio"] - 1 / 3) < 1e-6, ratio

        vol = page.evaluate(
            """() => ChemRuleCards.inferIodateTimerRatio(
              '取 IO3 1 mL、HSO3 15 mL，總體積 20 mL；原液 0.02 M 與 0.004 M。'
            )"""
        )
        print("VOL", vol)
        assert vol and abs(vol["ratio"] - 1 / 3) < 1e-6, vol

        bad = {
            "blocks": [
                {"type": "heading", "text": "推導"},
                {"type": "paragraph", "text": "混合後 [IO3-]=0.001 M，[HSO3-]=0.003 M。"},
                {"type": "calculation", "text": "t=50*16=800"},
                {"type": "heading", "text": "選項分析"},
                {"type": "choice", "text": "（E）約 800 秒後變藍，敘述正確。"},
            ],
            "answer": "A,E",
        }
        # 故意不給 hit.card，測詳解回補
        audit = page.evaluate(
            """(doc) => ChemRuleCards.auditDocument(doc, { card: null })""",
            bad,
        )
        print("ISSUES", audit.get("issues"))
        assert audit.get("ratioInfo") and audit["ratioInfo"]["ratio"] <= 1 / 3 + 1e-9
        assert audit.get("issues"), audit
        has_viol = page.evaluate("(a) => ChemRuleCards.hasNoBlueTimeViolation(a)", audit)
        assert has_viol

        # 僅時間鏈、無濃度：體積經典仍應抓到
        bad2 = {
            "blocks": [
                {"type": "choice", "text": "（E）甲取 1 mL IO3、乙取 15 mL HSO3（總 20 mL），約 800 秒，正確。"},
            ],
            "answer": "E",
        }
        audit2 = page.evaluate(
            """(doc) => ChemRuleCards.auditDocument(doc, { card: ChemRuleCards.getById('iodine-clock') })""",
            bad2,
        )
        print("ISSUES2", audit2.get("issues"), audit2.get("ratioInfo"))
        assert audit2.get("issues"), audit2

        print("PASS")
        page.context.browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
