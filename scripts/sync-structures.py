# -*- coding: utf-8 -*-
"""用途：從 PubChem 下載 Molfile，依 data_substances.js 建立 structures/ 資料庫。

安全提醒：會寫入 structures/、index.json 與 structures bundle，且需要網路；請先確認來源與變更範圍。
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STRUCT_DIR = ROOT / "structures"
INDEX_PATH = STRUCT_DIR / "index.json"
BUNDLE_PATH = ROOT / "js" / "structures-bundle.js"
SOURCE_JS = Path(r"d:\化學\教學網頁\ChemistryLab\測試\data_substances.js")

SKIP_CATEGORIES = {
    "離子晶體", "金屬晶體", "元素 / 網狀固體", "碳簇", "共振結構",
}
SKIP_NAME_PARTS = ("晶體堆積", "基本單元", "MyMol", "共振", "次要共振", "不穩定共振")
SYMMETRY_TAGS = {
    "Cs", "Td", "C2v", "D3h", "Oh", "Cinfv", "Dinfh", "C1", "C2", "C3v",
    "D2h", "D6h", "C2h", "C6h", "D5h", "D4d", "反應",
}
PUBCHEM_DELAY = 0.25

# 中文名 → PubChem 搜尋用（優先）
NAME_LOOKUP = {
    "水": "water",
    "氨": "ammonia",
    "氨氣": "ammonia",
    "甲烷": "methane",
    "乙烷": "ethane",
    "乙烯": "ethylene",
    "乙炔": "acetylene",
    "苯": "benzene",
    "乙醇": "ethanol",
    "酒精": "ethanol",
    "甲醇": "methanol",
    "乙酸": "acetic acid",
    "醋酸": "acetic acid",
    "丙酮": "acetone",
    "葡萄糖": "glucose",
    "果糖": "fructose",
    "半乳糖": "galactose",
    "二氧化碳": "carbon dioxide",
    "一氧化碳": "carbon monoxide",
    "阿斯匹靈": "aspirin",
    "乙醯水楊酸": "aspirin",
    "普拿疼": "acetaminophen",
    "食鹽": "sodium chloride",
    "氯化鈉": "sodium chloride",
    "硫酸": "sulfuric acid",
    "硝酸": "nitric acid",
    "鹽酸": "hydrogen chloride",
    "氯化氫": "hydrogen chloride",
    "雙氧水": "hydrogen peroxide",
    "過氧化氫": "hydrogen peroxide",
    "臭氧": "ozone",
    "二氧化硫": "sulfur dioxide",
    "三氧化硫": "sulfur trioxide",
    "氮氣": "nitrogen",
    "氧氣": "oxygen",
    "氫氣": "hydrogen",
    "氯氣": "chlorine",
    "溴": "bromine",
    "碘": "iodine",
    "氟化氫": "hydrogen fluoride",
    "硫化氫": "hydrogen sulfide",
    "氰化氫": "hydrogen cyanide",
    "尿素": "urea",
    "甘油": "glycerol",
    "乙二醇": "ethylene glycol",
    "萘": "naphthalene",
    "甲苯": "toluene",
    "苯酚": "phenol",
    "石炭酸": "phenol",
    "苯胺": "aniline",
    "TNT": "2,4,6-trinitrotoluene",
    "三硝基甲苯": "2,4,6-trinitrotoluene",
    "三氧化硫": "sulfur trioxide",
    "苯甲酸": "benzoic acid",
    "安息香酸": "benzoic acid",
    "硝基苯": "nitrobenzene",
    "苯磺酸": "benzenesulfonic acid",
    "水楊酸": "salicylic acid",
    "柳酸": "salicylic acid",
    "鄰羥基苯甲酸": "salicylic acid",
    "二甲胺": "dimethylamine",
    "乙二醇": "ethylene glycol",
    "1,2-乙二醇": "ethylene glycol",
    "丙三醇": "glycerol",
    "甲醚": "dimethyl ether",
    "二甲醚": "dimethyl ether",
    "乙二醛": "glyoxal",
    "順丁烯二酸": "maleic acid",
    "反丁烯二酸": "fumaric acid",
    "1-丙醇": "1-propanol",
    "2-丙醇": "2-propanol",
    "甲乙醚": "ethyl methyl ether",
    "正戊烷": "n-pentane",
    "環丙烷": "cyclopropane",
    "環丁烷": "cyclobutane",
    "環戊烷": "cyclopentane",
    "環己烷": "cyclohexane",
    "1-丁烯": "1-butene",
    "2-丁烯": "2-butene",
    "1-戊烯": "1-pentene",
    "環戊烯": "cyclopentene",
    "1,3-丁二烯": "1,3-butadiene",
    "乙苯": "ethylbenzene",
    "鄰二甲苯": "o-xylene",
    "間二甲苯": "m-xylene",
    "對二甲苯": "p-xylene",
    "桶烯": "barrelene",
    "芘": "pyrene",
    "稠五苯": "pentacene",
    "鄰二氯苯": "1,2-dichlorobenzene",
    "間二氯苯": "1,3-dichlorobenzene",
    "對二氯苯": "1,4-dichlorobenzene",
    "六甲氧基苯": "hexamethoxybenzene",
    "甲基苯丙胺": "methamphetamine",
    "安非他命": "amphetamine",
    "氯化苄": "benzyl chloride",
    "苄基氯": "benzyl chloride",
    "鄰氯甲苯": "2-chlorotoluene",
    "間氯甲苯": "3-chlorotoluene",
    "對氯甲苯": "4-chlorotoluene",
    "六氯環己烷": "lindane",
    "六氯化苯": "lindane",
    "過氧化鈉": "sodium peroxide",
    "過氧化鈉": "sodium peroxide",
    "氫氧根離子": "hydroxide",
    "氫氧根": "hydroxide",
    "過氧化氫根": "hydroperoxide",
    "硫氫根": "hydrogen sulfide ion",
    "氰根": "cyanide",
    "氰根離子": "cyanide",
    "過氧根離子": "peroxide",
    "乙炔根離子": "acetylide",
    "銨根": "ammonium",
    "碳醯根": "carbonate",
    "碳酸根": "carbonate",
    "碳酸氫根": "bicarbonate",
    "硫酸根": "sulfate",
    "硫酸氫根": "bisulfate",
    "亞硫酸根": "sulfite",
    "亞硫酸氫根": "bisulfite",
    "硝酸根": "nitrate",
    "亞硝酸根": "nitrite",
    "磷酸根": "phosphate",
    "磷酸二氫根": "dihydrogen phosphate",
    "磷酸氫根": "hydrogen phosphate",
    "過氯酸根": "perchlorate",
    "氯酸根": "chlorate",
    "亞氯酸根": "chlorite",
    "次氯酸根": "hypochlorite",
    "溴酸根": "bromate",
    "碘酸根": "iodate",
    "草酸": "oxalic acid",
    "草酸根": "oxalate",
    "草酸氫根": "hydrogen oxalate",
}


def parse_substances_js(text):
    """簡易解析 SUBSTANCE_LIST 陣列"""
    items = []
    blocks = re.findall(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.S)
    for block in blocks:
        if "formula:" not in block or "name:" not in block:
            continue
        def grab(key):
            m = re.search(rf'{key}:\s*"([^"]*)"', block)
            return m.group(1) if m else ""
        def grab_tags():
            m = re.search(r"tags:\s*\[(.*?)\]", block, re.S)
            if not m:
                return []
            return re.findall(r'"([^"]+)"', m.group(1))
        key_raw = grab("key")
        key_parts = [p.strip() for p in key_raw.split("|") if p.strip()] if key_raw else []
        entry = {
            "formula": grab("formula"),
            "name": grab("name"),
            "common": grab("common"),
            "category": grab("category"),
            "key": key_raw,
            "key_parts": key_parts,
            "tags": grab_tags(),
        }
        if entry["name"]:
            items.append(entry)
    return items


def slug_id(name, formula):
    base = name.strip()
    base = re.sub(r"\s*\([^)]*\)\s*", "_", base)
    base = re.sub(r"[^\w\u4e00-\u9fff\-]+", "_", base)
    base = re.sub(r"_+", "_", base).strip("_").lower()
    if not base or base == "mymol":
        return ""
    # 限制長度
    if len(base) > 48:
        base = base[:48].rstrip("_")
    return base


def is_stoichi_formula(s):
    s = (s or "").strip()
    if not s or len(s) > 40:
        return False
    if s in SYMMETRY_TAGS:
        return False
    return bool(re.match(r"^[A-Z0-9][A-Za-z0-9\(\)\+\-\.\']*$", s)) and any(ch.isdigit() for ch in s)


def is_english_name(s):
    s = (s or "").strip()
    return bool(re.match(r"^[A-Za-z][A-Za-z0-9\s,\-\(\)\']+$", s)) and len(s) > 2


def english_query(entry):
    name = entry.get("name") or ""
    common = (entry.get("common") or "").strip()

    if name in NAME_LOOKUP:
        return NAME_LOOKUP[name]
    if common in NAME_LOOKUP:
        return NAME_LOOKUP[common]

    for part in entry.get("key_parts") or []:
        if part in NAME_LOOKUP:
            return NAME_LOOKUP[part]
        if is_english_name(part) and part not in SYMMETRY_TAGS:
            return part

    if common and is_english_name(common):
        return common

    for t in entry.get("tags") or []:
        if t in SYMMETRY_TAGS or is_stoichi_formula(t):
            continue
        if t in NAME_LOOKUP:
            return NAME_LOOKUP[t]
        if is_english_name(t):
            return t

    for k, v in NAME_LOOKUP.items():
        if k in name or (common and k in common):
            return v

    return ""


def collect_aliases(item, sid, query):
    aliases = {sid, item.get("name") or ""}
    if item.get("common"):
        aliases.add(item["common"])
    for part in item.get("key_parts") or []:
        if part and not is_stoichi_formula(part) and part not in SYMMETRY_TAGS:
            aliases.add(part)
    if query:
        aliases.add(query)
        aliases.add(query.lower())
        slug = re.sub(r"[^a-z0-9]+", "_", query.lower()).strip("_")
        if slug:
            aliases.add(slug)
    aliases.discard("")
    return sorted(aliases, key=lambda x: (x != sid, x))


def should_skip(entry):
    cat = entry.get("category") or ""
    if cat in SKIP_CATEGORIES:
        return True
    name = entry.get("name") or ""
    for p in SKIP_NAME_PARTS:
        if p in name:
            return True
    f = entry.get("formula") or ""
    # 純金屬元素
    if cat == "金屬晶體" or re.match(r"^[A-Z][a-z]?$", f.strip()):
        return True
    if "MyMol" in f or "MyMol" in name:
        return True
    return False


def pubchem_fetch_sdf(query):
    q = urllib.parse.quote(query, safe="")
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{q}/record/SDF?record_type=2d"
    req = urllib.request.Request(url, headers={"User-Agent": "ai-solve-structures/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status != 200:
                return None
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None


def extract_mol_block(sdf):
    if not sdf:
        return None
    end = sdf.find("M  END")
    if end >= 0:
        return sdf[: end + 6]
    return sdf.strip()


def js_escape_template(s):
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def build_bundle(index_data, files_map):
    lines = [
        "/** 內建結構備援（由 sync-structures.py 產生） */",
        "window.STRUCTURES_BUNDLE = {",
        "  index: " + json.dumps(index_data, ensure_ascii=False, indent=2).replace("\n", "\n  ") + ",",
        "  files: {",
    ]
    for fname, content in sorted(files_map.items()):
        lines.append(f"    '{fname}': `{js_escape_template(content)}`,")
    lines.append("  }")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main():
    if not SOURCE_JS.exists():
        print(f"找不到來源：{SOURCE_JS}")
        return 1
    text = SOURCE_JS.read_text(encoding="utf-8")
    raw = parse_substances_js(text)
    print(f"解析到 {len(raw)} 筆")

    STRUCT_DIR.mkdir(exist_ok=True)
    seen_ids = set()
    entries = []
    failed = []
    query_cache = {}

    for item in raw:
        if should_skip(item):
            continue
        sid = slug_id(item["name"], item["formula"])
        if not sid or sid in seen_ids:
            # 同名異構：加 formula 後綴
            if sid in seen_ids:
                extra = re.sub(r"[^a-z0-9]", "", item["formula"].lower())[:12]
                sid = f"{sid}_{extra}" if sid else extra
            if not sid or sid in seen_ids:
                continue
        seen_ids.add(sid)

        query = english_query(item)
        if not query:
            failed.append((sid, item["name"], "無搜尋名"))
            continue
        if query not in query_cache:
            time.sleep(PUBCHEM_DELAY)
            sdf = pubchem_fetch_sdf(query)
            query_cache[query] = extract_mol_block(sdf)
            if query_cache[query]:
                print(f"  OK  {query}")
            else:
                print(f"  FAIL {query}")
        mol = query_cache[query]
        if not mol:
            failed.append((sid, item["name"], query))
            continue

        fname = f"{sid}.mol"
        (STRUCT_DIR / fname).write_text(mol + "\n", encoding="utf-8")
        entries.append({
            "id": sid,
            "file": fname,
            "label": item["name"],
            "name_en": query,
            "formula": item["formula"],
            "category": item.get("category") or "",
            "common": item.get("common") or "",
            "aliases": collect_aliases(item, sid, query),
            "source": f"PubChem 2D（{query}）",
        })

    index_data = {
        "version": 1,
        "description": "高中／國中常見分子 2D 結構（來源：data_substances.js + PubChem）",
        "entries": entries,
    }
    INDEX_PATH.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding="utf-8")

    files_map = {}
    for e in entries:
        p = STRUCT_DIR / e["file"]
        if p.exists():
            files_map[e["file"]] = p.read_text(encoding="utf-8").strip()

    BUNDLE_PATH.write_text(build_bundle(index_data, files_map), encoding="utf-8")

    print(f"\n完成：成功 {len(entries)} 筆，失敗 {len(failed)} 筆")
    print(f"  index: {INDEX_PATH}")
    print(f"  bundle: {BUNDLE_PATH}")
    if failed[:15]:
        print("失敗範例（前 15）：")
        for x in failed[:15]:
            print(f"  - {x[0]} ({x[1]}) query={x[2]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
