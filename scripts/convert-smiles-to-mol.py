# -*- coding: utf-8 -*-
"""用途：將 database/*.md 的 @@SMILES 轉為可對照 structures/index.json 的 @@MOL。

安全提醒：會改寫題庫 Markdown；請先檢視差異並保留可回復的版本。
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'structures', 'index.json')
DB = os.path.join(ROOT, 'database')

SMILES_RE = re.compile(r'^@@SMILES:([^|\n]+)(?:\|([^\n]+))?@@\s*$', re.M)

# 與 js/mol-resolver.js LABEL_HINTS 對齊
LABEL_HINTS = [
    (re.compile(r'SO[₃3]²[⁻\-]|SO3\s*2-|亞硫酸根'), '亞硫酸根'),
    (re.compile(r'SO[₄4]²?[⁻\-]?|硫酸根'), '硫酸根'),
    (re.compile(r'SO[₃3](?![²2])|三氧化硫'), '三氧化硫'),
    (re.compile(r'SO[₂2]'), '二氧化硫'),
    (re.compile(r'BF[₃3]'), '三氟化硼'),
    (re.compile(r'PCl[₃3]'), '三氯化磷'),
    (re.compile(r'PF[₅5]'), '五氟化磷'),
    (re.compile(r'SF[₆6]'), '六氟化硫'),
    (re.compile(r'NF[₃3]'), '三氟化氮'),
    (re.compile(r'NCl[₃3]'), '三氯化氮'),
    (re.compile(r'CF[₄4]'), '四氟化碳'),
    (re.compile(r'CO[₂2]'), '二氧化碳'),
    (re.compile(r'(?<![A-Za-z])CO(?![₂2O]|₃)'), '一氧化碳'),
    (re.compile(r'O[₃3]'), '臭氧'),
    (re.compile(r'H[₂2]O[₂2]|過氧化氫'), '過氧化氫'),
    (re.compile(r'OF[₂2]'), '二氟化氧'),
    (re.compile(r'N[₂2]O[₄4]'), '四氧化二氮'),
    (re.compile(r'N[₂2]H[₄4]|肼|聯氨'), '聯氨'),
    (re.compile(r'NH[₄4]|銨根'), '銨根離子'),
    (re.compile(r'NH[₃3]'), '氨'),
    (re.compile(r'H[₃3]O|水合氫'), '水合氫離子'),
    (re.compile(r'HCN|氰化氫'), '氰化氫'),
    (re.compile(r'HCl|氯化氫'), '氯化氫'),
    (re.compile(r'HF|氟化氫'), '氟化氫'),
    (re.compile(r'HBr|溴化氫'), '溴化氫'),
    (re.compile(r'H[₂2]O(?!₂)'), '水'),
    (re.compile(r'NaF|氟化鈉'), '氟化鈉'),
    (re.compile(r'KBr|溴化鉀'), '溴化鉀'),
    (re.compile(r'BeCl'), '二氯化鈹'),
    (re.compile(r'CCO|乙醇'), '乙醇'),
    (re.compile(r'c1ccccc1|苯'), '苯'),
    (re.compile(r'C#C|乙炔'), '乙炔'),
    (re.compile(r'C=C|乙烯'), '乙烯'),
    (re.compile(r'乙烷'), '乙烷'),
    (re.compile(r'CH[₄4]|甲烷'), '甲烷'),
    (re.compile(r'Cl[₂2]|氯氣'), '氯氣'),
    (re.compile(r'F[₂2]|氟'), '氟'),
    (re.compile(r'O[₂2]'), '氧氣'),
    (re.compile(r'N[₂2]'), '氮氣'),
    (re.compile(r'氫分子|氫氣|\[H\]\[H\]'), '氫氣'),
    (re.compile(r'ClOCl|OCl'), '二氯化硫'),
]


def norm(s):
    return re.sub(r'\s+', '', str(s or '')).lower()


def build_lookup(entries):
    m = {}
    ids = set()
    for e in entries:
        eid = e.get('id')
        if not eid:
            continue
        ids.add(eid)
        for key in [eid, e.get('label'), e.get('formula'), e.get('name_en'), e.get('common'), *(e.get('aliases') or [])]:
            if key:
                m[key] = eid
                m[norm(key)] = eid
    return m, ids


def resolve_id(label, smiles, lookup, valid_ids):
    text = (label or smiles or '').strip()
    smi = (smiles or '').strip()
    for pat, eid in LABEL_HINTS:
        if eid not in valid_ids:
            continue
        if pat.search(text) or (smi and pat.search(smi)):
            return eid
    for c in [text, text.split('（')[0].split('(')[0].strip(), smi]:
        if not c:
            continue
        hit = lookup.get(c) or lookup.get(norm(c))
        if hit:
            return hit
    return None


def convert_text(text, lookup, valid_ids):
    stats = {'converted': 0, 'kept': 0, 'unmapped': []}

    def repl(m):
        smi, label = m.group(1).strip(), (m.group(2) or '').strip()
        eid = resolve_id(label, smi, lookup, valid_ids)
        if eid:
            stats['converted'] += 1
            cap = f'|{label}' if label else ''
            return f'@@MOL:{eid}{cap}@@'
        stats['kept'] += 1
        stats['unmapped'].append(m.group(0).strip())
        return m.group(0)

    out = SMILES_RE.sub(repl, text)
    out = out.replace('@@SMILES:…@@', '@@MOL:物種id|標籤@@')
    out = out.replace('輸出 `@@SMILES:…@@`', '輸出 `@@MOL:物種id|標籤@@`')
    return out, stats


def main():
    with open(INDEX, encoding='utf-8') as f:
        entries = json.load(f).get('entries', [])
    lookup, valid_ids = build_lookup(entries)

    total = {'converted': 0, 'kept': 0, 'files': 0}
    all_unmapped = []

    for fn in sorted(os.listdir(DB)):
        if not fn.endswith('.md') or fn.lower() == 'readme.md':
            continue
        path = os.path.join(DB, fn)
        with open(path, encoding='utf-8') as f:
            raw = f.read()
        if '@@SMILES' not in raw:
            continue
        new_text, stats = convert_text(raw, lookup, valid_ids)
        if new_text != raw:
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(new_text)
            total['files'] += 1
            total['converted'] += stats['converted']
            total['kept'] += stats['kept']
            all_unmapped.extend(stats['unmapped'])
            print(f'{fn}: MOL {stats["converted"]}, 保留 SMILES {stats["kept"]}')

    print(f'\n完成：{total["files"]} 檔，轉換 {total["converted"]} 行，未對應 {total["kept"]} 行')
    if all_unmapped:
        print('未對應範例（前 15）：')
        for line in all_unmapped[:15]:
            print(' ', line)


if __name__ == '__main__':
    main()
