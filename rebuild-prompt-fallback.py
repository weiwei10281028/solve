# -*- coding: utf-8 -*-
"""修改 prompts/*.md 後執行，同步 js/prompt-compose.js 內 FALLBACK 備援"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMPOSE = ROOT / "js" / "prompt-compose.js"
MAP = {
    "base-system": ROOT / "prompts/base/system-chem.md",
    "stoichiometry-system": ROOT / "prompts/addons/stoichiometry-system.md",
    "rxn-grid-format": ROOT / "prompts/addons/rxn-grid-format.md",
    "stoichiometry-user": ROOT / "prompts/addons/stoichiometry-user.md",
    "calc-compact-system": ROOT / "prompts/addons/calc-compact-system.md",
    "calc-compact-user": ROOT / "prompts/addons/calc-compact-user.md",
}


def js_template(s):
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def main():
    layers = {k: p.read_text(encoding="utf-8").strip() for k, p in MAP.items()}
    fb_lines = ["  const FALLBACK = {"]
    for key, val in layers.items():
        fb_lines.append(f"    '{key}': `{js_template(val)}`,")
    fb_lines.append("  };")
    fb = "\n".join(fb_lines)
    text = COMPOSE.read_text(encoding="utf-8")
    text = re.sub(r"  const FALLBACK = \{[\s\S]*?\n  \};", fb, text, count=1)
    COMPOSE.write_text(text, encoding="utf-8")
    print("OK: FALLBACK synced (template literals)")


if __name__ == "__main__":
    main()
