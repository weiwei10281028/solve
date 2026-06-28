# -*- coding: utf-8 -*-
"""由 structures/index.json + *.mol 重建 js/structures-bundle.js（不重新下載 PubChem）"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STRUCT_DIR = ROOT / "structures"
INDEX_PATH = STRUCT_DIR / "index.json"
BUNDLE_PATH = ROOT / "js" / "structures-bundle.js"


def js_escape_template(s):
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def main():
    index_data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    files_map = {}
    for entry in index_data.get("entries", []):
        fname = entry.get("file")
        if not fname:
            continue
        fp = STRUCT_DIR / fname
        if fp.is_file():
            files_map[fname] = fp.read_text(encoding="utf-8").rstrip("\n") + "\n"

    lines = [
        "/** 內建結構備援（由 rebuild-structures-bundle.py 產生） */",
        "window.STRUCTURES_BUNDLE = {",
        "  index: " + json.dumps(index_data, ensure_ascii=False, indent=2).replace("\n", "\n  ") + ",",
        "  files: {",
    ]
    for fname, content in sorted(files_map.items()):
        lines.append(f"    '{fname}': `{js_escape_template(content)}`,")
    lines.append("  }")
    lines.append("};")
    lines.append("")
    BUNDLE_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK: {len(files_map)} mol files -> {BUNDLE_PATH}")


if __name__ == "__main__":
    main()
