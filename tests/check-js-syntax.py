# -*- coding: utf-8 -*-
"""用途：檢查核心 JavaScript 語法與必要符號。

安全提醒：本程式只讀取 JavaScript 檔案，不會寫入或格式化任何原始碼。

使用 Node.js 的現代 parser，支援 optional chaining、spread 等目前專案已使用的語法。
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js"
FILES = [
    "solve-spec.js", "chem-rule-cards.js", "prompts.js", "app.js",
    "ascii-solution-render.js", "solution-core.js", "chem-structure.js",
]
REQUIRED = {
    "solve-spec.js": ["global.SolveSpec", "function buildUserBlock"],
    "chem-rule-cards.js": ["global.ChemRuleCards", "buildReferenceBlock", "auditDocument", "buildDecisionRuleBlock", "iodine-clock"],
    "prompts.js": [
        "window.buildSolveUserText",
        "window.getSystemPromptForSolve",
    ],
    "ascii-solution-render.js": ["global.AsciiSolutionRender", "function renderInto", "function ensureMathJax"],
    "app.js": ["window.SolutionCore.prepare", "responseFormat:"],
    "solution-core.js": ["global.SolutionCore", "function prepare", "const SCHEMA", "function stripHtmlData"],
    "chem-structure.js": ["global.MolResolver", "global.MolfileDraw", "global.StructureLayout", "global.SmilesDraw"],
}


def find_node() -> str | None:
    if node := shutil.which("node"):
        return node
    # Codex desktop bundled runtime：讓 Windows 本機也可直接執行檢查。
    local = Path(os.environ.get("USERPROFILE", "")) / ".cache" / "codex-runtimes"
    candidates = sorted(local.glob("*/dependencies/node/bin/node.exe"), reverse=True)
    return str(candidates[0]) if candidates else None


def main() -> int:
    node = find_node()
    if not node:
        print("找不到 Node.js；請安裝 Node.js 18+ 後再執行。")
        return 2
    ok = True
    for name in FILES:
        fp = JS / name
        if not fp.is_file():
            print(f"MISSING\t{name}")
            ok = False
            continue
        result = subprocess.run([node, "--check", str(fp)], text=True, capture_output=True)
        if result.returncode:
            print(f"PARSE_FAIL\t{name}\t{(result.stderr or result.stdout).strip()}")
            ok = False
            continue
        print(f"PARSE_OK\t{name}")
        src = fp.read_text(encoding="utf-8")
        for symbol in REQUIRED.get(name, []):
            if symbol not in src:
                print(f"MISSING\t{name}\t{symbol}")
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
