# -*- coding: utf-8 -*-
"""語法檢查：修改 js 後請執行 python tools/check-js-syntax.py"""
import sys
from pathlib import Path

try:
    import esprima
except ImportError:
    print('請先安裝：pip install esprima')
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / 'js'
FILES = [
    'prompts.js',
    'app.js',
    'plain-reaction-table.js',
    'board-formats.js',
    'db-parse.js',
    'render.js',
]
REQUIRED = {
    'prompts.js': [
        'window.buildSolveUserText',
        'window.getSystemPromptForSolve',
        'window.checkSolutionBoardStyle',
    ],
}


def main() -> int:
    ok = True
    for name in FILES:
        fp = JS / name
        src = fp.read_text(encoding='utf-8')
        try:
            esprima.parseScript(src)
        except Exception as err:
            print(f'PARSE_FAIL\t{name}\t{err}')
            ok = False
            continue
        print(f'PARSE_OK\t{name}')
        for sym in REQUIRED.get(name, []):
            if sym not in src:
                print(f'MISSING\t{name}\t{sym}')
                ok = False
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
