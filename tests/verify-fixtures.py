# -*- coding: utf-8 -*-
"""以 fixture JSON 驗證 compile + render token 管線（需本機 HTTP + Edge headless）。"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://localhost:18080'
URL = f'{BASE}/tests/verify-fixtures.html'
BUILD = '20260721-no-note'


def fetch(url: str, timeout: float = 12.0) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8', errors='replace')


def server_alive() -> bool:
    try:
        fetch(f'{BASE}/index.html', timeout=2.0)
        return True
    except Exception:
        return False


def find_edge() -> Path | None:
    candidates = [
        Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
        Path(r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'),
    ]
    for path in candidates:
        if path.is_file():
            return path
    found = shutil.which('msedge')
    return Path(found) if found else None


def run_headless(url: str, budget_ms: int = 15000) -> str:
    edge = find_edge()
    if not edge:
        raise RuntimeError('找不到 Microsoft Edge，無法執行瀏覽器端 fixture 驗證')
    proc = subprocess.run(
        [
            str(edge),
            '--headless=new',
            '--disable-gpu',
            f'--virtual-time-budget={budget_ms}',
            '--dump-dom',
            url,
        ],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=budget_ms / 1000 + 10,
    )
    return proc.stdout or proc.stderr or ''


def main() -> int:
    proc = None
    owned_server = False
    if not server_alive():
        proc = subprocess.Popen(
            [sys.executable, str(ROOT / 'dev-server.py')],
            cwd=str(ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        owned_server = True
        for _ in range(40):
            if server_alive():
                break
            time.sleep(0.25)
        else:
            print('[FAIL] 無法啟動 dev-server.py')
            proc.kill()
            return 1

    try:
        html = run_headless(URL)
    except Exception as exc:
        print(f'[FAIL] 瀏覽器驗證失敗: {exc}')
        return 1
    finally:
        if owned_server and proc:
            proc.terminate()

    title = re.search(r'<title>([^<]+)</title>', html, re.I)
    status = title.group(1).strip() if title else 'UNKNOWN'
    log_match = re.search(r'<pre id="log">([\s\S]*?)</pre>', html, re.I)
    log_body = log_match.group(1).strip() if log_match else ''

    print('=== Fixture 管線驗證 ===')
    print(f'頁面標題: {status}')
    for line in log_body.splitlines():
        line = line.strip()
        if line.startswith('PASS:') or line.startswith('FAIL:'):
            print(f'  {line}')
    if status != 'PASS':
        print(f'\n合計 FAIL（BUILD={BUILD}）')
        return 1
    print('\n合計 PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
