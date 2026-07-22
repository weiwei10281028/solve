# -*- coding: utf-8 -*-
"""Verify iodine-clock audit catches no-blue + timed-correct."""
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
        page.wait_for_function("() => window.ChemRuleCards && ChemRuleCards.auditDocument")

        bad = {
            "blocks": [
                {"type": "heading", "text": "依據"},
                {"type": "paragraph", "text": "混合後 [IO3-]=0.001 M，[HSO3-]=0.003 M，比值為 1/3。"},
                {"type": "heading", "text": "推導"},
                {"type": "calculation", "text": "f=0.001/0.004=1/4"},
                {"type": "calculation", "text": "t=50*16=800"},
                {"type": "heading", "text": "選項分析"},
                {"type": "choice", "text": "（E）約 800 秒後變藍，敘述正確。"},
            ],
            "answer": "A,C,E",
        }
        hit = page.evaluate(
            """() => ChemRuleCards.resolveFromKeywords('秒錶反應 IO3- HSO3- 變藍時間')"""
        )
        assert hit and hit.get("card") and hit["card"]["id"] == "iodine-clock", hit

        audit = page.evaluate(
            """([doc, cardId]) => {
              const hit = { card: ChemRuleCards.getById(cardId) };
              return ChemRuleCards.auditDocument(doc, hit);
            }""",
            [bad, "iodine-clock"],
        )
        print("ISSUES:", audit.get("issues"))
        assert audit.get("issues"), audit
        assert any("不變藍" in x or "≤1/3" in x or "1/3" in x for x in audit["issues"]), audit

        good_kw = page.evaluate("() => ChemRuleCards.resolveFromKeywords('普通酸鹼滴定')")
        assert not good_kw or not good_kw.get("card"), good_kw
        print("PASS")
        page.context.browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
