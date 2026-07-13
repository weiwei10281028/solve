# -*- coding: utf-8 -*-
"""用途：將舊 database/formats/*.md 轉成可追溯的 data/reference 記錄。

安全提醒：預設只預覽；加上 --apply 才會覆寫 data/reference/index.json 與 records/，不會修改舊 database/。
"""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "database" / "formats"
TARGET = ROOT / "data" / "reference"
RECORDS = TARGET / "records"
INDEX = TARGET / "index.json"


def title_of(text: str, fallback: str) -> str:
    match = re.search(r"^#{1,3}\s+(.+)$", text, re.M)
    return match.group(1).strip() if match else fallback


def build_records() -> list[dict]:
    imported_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    records = []
    for path in sorted(LEGACY.glob("*.md")):
        if path.name.startswith("_"):
            continue
        content = path.read_text(encoding="utf-8").strip()
        records.append({
            "id": "legacy-format-" + path.stem,
            "kind": "format",
            "title": title_of(content, path.stem),
            "type_tags": ["format", "legacy"],
            "content": content,
            "source": {"legacy_path": path.relative_to(ROOT).as_posix(), "imported_at": imported_at},
            "verification": "pending"
        })
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="匯入舊 database 版型到新 reference 資料格式")
    parser.add_argument("--apply", action="store_true", help="寫入 data/reference；未指定時僅預覽")
    args = parser.parse_args()
    records = build_records()
    print(f"找到 {len(records)} 筆可匯入版型。")
    for record in records:
        print(f"- {record['id']} <- {record['source']['legacy_path']} [{record['verification']}]")
    if not args.apply:
        print("預覽完成；確認後執行 python scripts/import-legacy-database.py --apply")
        return 0
    RECORDS.mkdir(parents=True, exist_ok=True)
    for record in records:
        (RECORDS / f"{record['id']}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    index = {"version": 1, "records": [{"id": r["id"], "kind": r["kind"], "title": r["title"], "type_tags": r["type_tags"], "verification": r["verification"], "source": r["source"]} for r in records]}
    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已寫入 {len(records)} 筆到 {TARGET.relative_to(ROOT)}（皆為 pending，舊資料保留）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
