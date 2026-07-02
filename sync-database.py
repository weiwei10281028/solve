# -*- coding: utf-8 -*-
"""同步 database/ 與 database/rules/ 到 index.json 與 js/database-bundle.js"""

import json
import os
import glob
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, 'database')
RULES_DIR = os.path.join(DB, 'rules')
METHODS_PATH = os.path.join(DB, 'methods.json')
INDEX_PATH = os.path.join(DB, 'index.json')
RULES_INDEX_PATH = os.path.join(RULES_DIR, 'index.json')
BUNDLE_PATH = os.path.join(ROOT, 'js', 'database-bundle.js')


CHAPTERS_DIR = os.path.join(DB, 'chapters')
CHAPTERS_INDEX_PATH = os.path.join(CHAPTERS_DIR, 'index.json')


def read_md_files(folder, skip_prefix='_', skip_names=None, key_prefix=''):
    skip_names = {n.lower() for n in (skip_names or ['lm-convert-prompt.md'])}
    files = {}
    names = []
    for fp in sorted(glob.glob(os.path.join(folder, '*.md'))):
        fn = os.path.basename(fp)
        if fn.startswith(skip_prefix) or fn.lower() in skip_names:
            continue
        key = f'{key_prefix}{fn}' if key_prefix else fn
        names.append(key)
        with open(fp, encoding='utf-8') as f:
            files[key] = f.read()
    return names, files


def main():
    names, files = read_md_files(DB, skip_names=['readme.md'])
    if os.path.isdir(CHAPTERS_DIR):
        ch_names, ch_files = read_md_files(CHAPTERS_DIR, key_prefix='chapters/')
        names.extend(ch_names)
        files.update(ch_files)
    rule_names, rules = read_md_files(RULES_DIR) if os.path.isdir(RULES_DIR) else ([], {})

    methods = {'methods': {}}
    if os.path.isfile(METHODS_PATH):
        with open(METHODS_PATH, encoding='utf-8') as f:
            methods = json.load(f)

    updated = datetime.now().isoformat(timespec='seconds')

    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump({'files': names, 'updated': updated}, f, ensure_ascii=False, indent=2)
        f.write('\n')

    os.makedirs(RULES_DIR, exist_ok=True)
    with open(RULES_INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump({'files': rule_names, 'updated': updated}, f, ensure_ascii=False, indent=2)
        f.write('\n')

    bundle = {
        'files': files,
        'methods': methods.get('methods', {}),
        'rules': rules,
    }
    with open(BUNDLE_PATH, 'w', encoding='utf-8') as f:
        f.write('/* 內建題庫：由同步資料庫.bat 自動產生 */\n')
        f.write('const EMBEDDED_DATABASE = ')
        json.dump(bundle, f, ensure_ascii=False, indent=2)
        f.write(';\n')

    print(f'已同步 {len(names)} 個題庫 .md（含章節）、{len(rule_names)} 個教學規定')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
