# -*- coding: utf-8 -*-
"""用途：同步 database/formats/ 到 index.json 與 js/database-bundle.js（板書版型）。

安全提醒：會覆寫 database/index.json 與 js/database-bundle.js；請先確認來源資料已備份或納入版本控制。
"""

import json
import os
import glob
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'database')
FORMATS_DIR = os.path.join(DB, 'formats')
METHODS_PATH = os.path.join(DB, 'methods.json')
INDEX_PATH = os.path.join(DB, 'index.json')
BUNDLE_PATH = os.path.join(ROOT, 'js', 'database-bundle.js')


def read_md_files(folder, skip_prefix='_', skip_names=None, key_prefix=''):
    skip_names = {n.lower() for n in (skip_names or [])}
    files = {}
    names = []
    if not os.path.isdir(folder):
        return names, files
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
    names, format_files = read_md_files(FORMATS_DIR, key_prefix='formats/')

    methods = {'methods': {}}
    if os.path.isfile(METHODS_PATH):
        with open(METHODS_PATH, encoding='utf-8') as f:
            methods = json.load(f)

    updated = datetime.now().isoformat(timespec='seconds')

    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump({'files': names, 'updated': updated}, f, ensure_ascii=False, indent=2)
        f.write('\n')

    bundle = {
        'files': format_files,
        'methods': methods.get('methods', {}),
        'formats': format_files,
    }
    with open(BUNDLE_PATH, 'w', encoding='utf-8') as f:
        f.write('/* 內建版型庫：由同步資料庫.bat 自動產生 */\n')
        f.write('const EMBEDDED_DATABASE = ')
        json.dump(bundle, f, ensure_ascii=False, indent=2)
        f.write(';\n')

    print(f'已同步版型 {len(names)} 個 → database-bundle.js')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
