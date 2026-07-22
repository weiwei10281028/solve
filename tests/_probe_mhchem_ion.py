# -*- coding: utf-8 -*-
"""驗證裸離子式（ASCII／Unicode）進 mhchem。"""
from __future__ import annotations

import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), SimpleHTTPRequestHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"

    samples = [
        ("HSO3^- 與 IO3^-", [r"\\ce\{HSO3\^-\}", r"\\ce\{IO3\^-\}"]),
        ("HSO3- 總體積", [r"\\ce\{HSO3-\}"]),
        ("由表，HSO₃⁻ 與 IO₃⁻ 濃度", [r"\\ce\{HSO3\^-\}", r"\\ce\{IO3\^-\}"]),
        ("[HSO3^-]=0.002", [r"\\ce\{HSO3\^-\}"]),
        ("甲溶液中 IO3^- 的濃度", [r"\\ce\{IO3\^-\}"]),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{base}/index.html", wait_until="networkidle")
        page.wait_for_function("() => typeof normalizeScientificTokens === 'function' && window.SolutionCore")

        prepared = page.evaluate(
            """() => window.SolutionCore.prepare(JSON.stringify({
              blocks:[{type:'paragraph',text:'由表 2，HSO3^- 與 IO3^- 濃度加倍，可知對 IO3^- 為二級反應。'}],
              answer:'x'
            })).text"""
        )
        print("PREPARE:", prepared)
        assert r"\ce{HSO3^-}" in prepared or r"\ce{HSO3-}" in prepared, prepared
        assert r"\ce{IO3^-}" in prepared or r"\ce{IO3-}" in prepared, prepared

        for sample, patterns in samples:
            out = page.evaluate("(s) => normalizeScientificTokens(s)", sample)
            print("IN :", sample)
            print("OUT:", out)
            for pat in patterns:
                assert re.search(pat, out), f"{sample} missing {pat} in {out}"
            if sample.startswith("["):
                assert re.search(r"\$\[\\ce\{", out), f"concentration brackets should stay outside ce: {out}"

        html = page.evaluate(
            """() => {
              const t = normalizeScientificTokens('由表，HSO₃⁻ 與 IO₃⁻，HSO3^-。');
              const el = document.createElement('div');
              el.className = 'chem-markdown';
              el.innerHTML = renderMarkdownSolution(t);
              doKaTeX(el);
              return el.innerHTML;
            }"""
        )
        assert "katex" in html
        assert "HSO" in html
        print("KATEX_OK")
        browser.close()
    server.shutdown()
    print("PASS")


if __name__ == "__main__":
    import os

    os.chdir(ROOT)
    main()
