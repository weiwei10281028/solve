# -*- coding: utf-8 -*-
"""?券?撠?database/*.md ??@@SMILES 頧?臬???structures/index.json ??@@MOL??
摰??嚗??孵神憿澈 Markdown嚗??炎閬榆?唬蒂靽??臬?敺拍????"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'structures', 'index.json')
DB = os.path.join(ROOT, 'database')

SMILES_RE = re.compile(r'^@@SMILES:([^|\n]+)(?:\|([^\n]+))?@@\s*$', re.M)

# ??js/chem-structure.js LABEL_HINTS 撠?
LABEL_HINTS = [
    (re.compile(r'SO[??]簡[?蓋-]|SO3\s*2-|鈭‵?豢'), '鈭‵?豢'),
    (re.compile(r'SO[??]簡?[?蓋-]?|蝖恍??), '蝖恍??),
    (re.compile(r'SO[??](?![簡2])|銝飢?‵'), '銝飢?‵'),
    (re.compile(r'SO[??]'), '鈭飢?‵'),
    (re.compile(r'BF[??]'), '銝??□'),
    (re.compile(r'PCl[??]'), '銝偺?ㄦ'),
    (re.compile(r'PF[??]'), '鈭??ㄦ'),
    (re.compile(r'SF[??]'), '?剜??‵'),
    (re.compile(r'NF[??]'), '銝??乾'),
    (re.compile(r'NCl[??]'), '銝偺?乾'),
    (re.compile(r'CF[??]'), '???４'),
    (re.compile(r'CO[??]'), '鈭飢?４'),
    (re.compile(r'(?<![A-Za-z])CO(?![??O]|??'), '銝瘞批?蝣?),
    (re.compile(r'O[??]'), '?剜飢'),
    (re.compile(r'H[??]O[??]|?飢?鬥'), '?飢?鬥'),
    (re.compile(r'OF[??]'), '鈭??飢'),
    (re.compile(r'N[??]O[??]'), '?飢??瘞?),
    (re.compile(r'N[??]H[??]|?慝?舀馬'), '?舀馬'),
    (re.compile(r'NH[??]|?冽'), '?冽?Ｗ?'),
    (re.compile(r'NH[??]'), '瘞?),
    (re.compile(r'H[??]O|瘞游?瘞?), '瘞游?瘞恍摮?),
    (re.compile(r'HCN|瘞啣?瘞?), '瘞啣?瘞?),
    (re.compile(r'HCl|瘞臬?瘞?), '瘞臬?瘞?),
    (re.compile(r'HF|瘞?瘞?), '瘞?瘞?),
    (re.compile(r'HBr|皞游?瘞?), '皞游?瘞?),
    (re.compile(r'H[??]O(?!??'), '瘞?),
    (re.compile(r'NaF|瘞???), '瘞???),
    (re.compile(r'KBr|皞游??'), '皞游??'),
    (re.compile(r'BeCl'), '鈭偺?'),
    (re.compile(r'CCO|銋?'), '銋?'),
    (re.compile(r'c1ccccc1|??), '??),
    (re.compile(r'C#C|銋?'), '銋?'),
    (re.compile(r'C=C|銋'), '銋'),
    (re.compile(r'銋'), '銋'),
    (re.compile(r'CH[??]|?脩'), '?脩'),
    (re.compile(r'Cl[??]|瘞舀除'), '瘞舀除'),
    (re.compile(r'F[??]|瘞?), '瘞?),
    (re.compile(r'O[??]'), '瘞扳除'),
    (re.compile(r'N[??]'), '瘞格除'),
    (re.compile(r'瘞怠?摮瘞急除|\[H\]\[H\]'), '瘞急除'),
    (re.compile(r'ClOCl|OCl'), '鈭偺?‵'),
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
    for c in [text, text.split('嚗?)[0].split('(')[0].strip(), smi]:
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
    out = out.replace('@@SMILES:?共@', '@@MOL:?拍車id|璅惜@@')
    out = out.replace('頛詨 `@@SMILES:?共@`', '頛詨 `@@MOL:?拍車id|璅惜@@`')
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
            print(f'{fn}: MOL {stats["converted"]}, 靽? SMILES {stats["kept"]}')

    print(f'\n摰?嚗total["files"]} 瑼?頧? {total["converted"]} 銵??芸???{total["kept"]} 銵?)
    if all_unmapped:
        print('?芸???靘???15嚗?')
        for line in all_unmapped[:15]:
            print(' ', line)


if __name__ == '__main__':
    main()

