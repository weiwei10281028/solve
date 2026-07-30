import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    data = json.load(handle)

for result in data.get("results", []):
    print()
    print("MODE", result.get("mode"), "ID", result.get("id"), "OK", result.get("ok"), "ACTUAL", result.get("actual"))
    raw = result.get("raw", "")
    print("RAW_HEAD_REPR", repr(raw[:600]))
    try:
        doc = json.loads(raw)
    except Exception as exc:
        print("parse err", exc)
    else:
        print("ANSWER", doc.get("answer"))
        for block in doc.get("blocks", []):
            print(block.get("type"), repr(str(block.get("text", ""))[:240]))
    print("MEMO_HEAD_REPR", repr(str(result.get("memo", ""))[:800]))
