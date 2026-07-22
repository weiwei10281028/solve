# -*- coding: utf-8 -*-
"""針對截圖問題：逗號單位、rem/prod 下標擠壓。"""
from __future__ import annotations

import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:18084'
OUT = ROOT / 'tests' / '_web_api_out'
OUT.mkdir(parents=True, exist_ok=True)

DOC = {
    'blocks': [
        {
            'type': 'paragraph',
            'text': '（甲）加入 5.0, mL NaOH 時，形成緩衝溶液。'
        },
        {
            'type': 'calculation',
            'text': r'CH3COOH_{rem}=\htmlData{note=醋酸起始莫耳數（mol）}{0.002}-\htmlData{note=加入 NaOH 莫耳數（mol）}{0.005}\times\htmlData{note=NaOH 濃度（M）}{0.10}=0.0015'
        },
        {
            'type': 'calculation',
            'text': r'\ce{CH3COO-}_{prod}=\htmlData{note=加入 NaOH 莫耳數（mol）}{0.005}\times\htmlData{note=NaOH 濃度（M）}{0.10}=0.0005'
        },
        {
            'type': 'paragraph',
            'text': '（乙）達滴定終點時，溶液中含有 0.002, mol 醋酸鈉，總體積為 40.0, mL。'
        },
        {
            'type': 'calculation',
            'text': r'\ce{CH3COO-}_{conc}=\dfrac{\htmlData{note=醋酸鈉莫耳數（mol）}{0.002}}{\htmlData{note=總體積（L）}{0.040}}=0.05'
        },
        {
            'type': 'calculation',
            'text': r'pOH=-\log(5.27\times10^{-6})\approx6-0.72=5.28 pH=14-5.28=8.72'
        },
    ],
    'answer': 'D'
}


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1100, 'height': 900})
        page.goto(f'{BASE}/index.html', wait_until='networkidle')
        page.evaluate("""() => {
          document.getElementById('overlay')?.classList.remove('show');
          localStorage.setItem('aik', 'probe-no-key');
        }""")
        page.reload(wait_until='networkidle')
        page.evaluate("""() => {
          document.getElementById('overlay')?.classList.remove('show');
        }""")
        result = page.evaluate(
            """(raw) => {
              const prepared = window.SolutionCore.prepare(raw);
              document.getElementById('overlay')?.classList.remove('show');
              document.getElementById('resultCard')?.classList.add('show');
              if (typeof setMainSolution === 'function') {
                setMainSolution(prepared.text);
              }
              const board = document.getElementById('mainSolution');
              return {
                ok: prepared.ok,
                text: prepared.text,
                visible: board ? board.innerText : '',
                html: board ? board.innerHTML : ''
              };
            }""",
            json.dumps(DOC, ensure_ascii=False),
        )
        page.locator('#mainSolution').screenshot(path=str(OUT / 'display-fix-probe.png'))
        (OUT / 'display-fix-probe.txt').write_text(result['visible'], encoding='utf-8')
        (OUT / 'display-fix-probe-src.txt').write_text(result['text'], encoding='utf-8')
        browser.close()

    visible = result['visible']
    src = result['text']
    issues = []
    if re.search(r'5\.0\s*[，,]\s*mL|0\.002\s*[，,]\s*mol|40\.0\s*[，,]\s*mL', src, re.I):
        issues.append('compile 仍有數字逗號單位')
    if re.search(r'_\{?(?:rem|prod|conc)\}?', src):
        issues.append('compile 結果仍含 _{rem/prod/conc}')
    if '（剩餘）' not in src:
        issues.append('未轉成剩餘標籤')
    if '（生成）' not in src:
        issues.append('未轉成生成標籤')
    if '（濃度）' not in src:
        issues.append('未轉成濃度標籤')
    if not re.search(r'5\.0\\,\\mathrm\{mL\}|5\.0 mL', src):
        # paragraph 可能尚未包 $，但不可再有逗號
        if '5.0' in src and 'mL' in src and re.search(r'5\.0\s*[，,]', src):
            issues.append('段落 5.0 mL 仍有逗號')

    summary = {
        'issues': issues,
        'has_rem_label': '（剩餘）' in src,
        'has_prod_label': '（生成）' in src,
        'has_conc_label': '（濃度）' in src,
        'src_head': src[:500],
    }
    (OUT / 'display-fix-probe-summary.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print(json.dumps({'ok': not issues, 'issues': issues}, ensure_ascii=False))
    return 1 if issues else 0


if __name__ == '__main__':
    raise SystemExit(main())
