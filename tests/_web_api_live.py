# -*- coding: utf-8 -*-
"""網頁端 live API 解題顯示檢查（臨時腳本，勿提交金鑰）。"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / '_web_api_out'
OUT.mkdir(parents=True, exist_ok=True)

API_KEY = os.environ.get('GEMINI_API_KEY', '').strip()
BASE = os.environ.get('SOLVE_BASE', 'http://127.0.0.1:18080')
TIMEOUT_MS = int(os.environ.get('SOLVE_TIMEOUT_MS', '300000'))
MODEL = os.environ.get('SOLVE_MODEL', 'gemini-3.5-flash').strip()
RETRIES = int(os.environ.get('SOLVE_RETRIES', '3'))
RETRY_WAIT_S = int(os.environ.get('SOLVE_RETRY_WAIT_S', '45'))

QUESTIONS = {
    'titration': """【題目】
4. 有一未知濃度的醋酸溶液 20.0 毫升，今以 0.10 M 的 NaOH 標準溶液滴定，當加入 20.0 毫升的 NaOH 溶液時，可達滴定終點。下列有關其滴定過程與滴定終點的敘述，何者正確？（醋酸的 Ka = 1.8 × 10^{-5} ，√(500/18) = 5.27，10/5.27 ≈ 1.90）
(甲) 在加入 5.0 毫升的 NaOH 溶液後，醋酸溶液的氫離子濃度約為 5.4 × 10^{-5} M
(乙) 達滴定終點時，溶液的 pH 值應介於 8 和 9 之間
(丙) 已知溴瑞香草酚藍變色範圍約在 pH 6.0 ~ 8.0 之間，適用於判斷此滴定終點
(A) 只有甲 (B) 只有乙 (C) 只有丙 (D) 甲與乙 (E) 甲與丙""",
    'acid-strength': """【題目】
下列各酸鹼反應均有利於產物：
(1) CH3COOH + HS- → H2S + CH3COO-
(2) H3O+ + H2PO4- → H3PO4 + H2O
(3) H2S + OH- → H2O + HS-
(4) H3PO4 + CH3COO- → CH3COOH + H2PO4-
下列各布－洛酸的強度順序，何者正確？
(A) H3PO4 > CH3COOH > H3O+ > H2O > H2S
(B) CH3COOH > H3O+ > H3PO4 > H2S > H2O
(C) H3O+ > H3PO4 > CH3COOH > H2S > H2O
(D) H2S > H3O+ > H3PO4 > CH3COOH > H2O""",
}


def scan_display(text: str, html: str) -> list[str]:
    issues = []
    if re.search(r'H\$\d|\$\dPO|H_\{?3\}?PO_\{?4', text):
        issues.append('化學式破碎顯示（H$數字 類）')
    if 'H$3PO$4' in text or 'H$3O' in text:
        issues.append('出現 H$3PO$4 / H$3O 類破碎字串')
    if re.search(r'\$\$\\?mathrm\{M\}|\$\$\\mathrm', text) or '$$\\mathrm{M}' in text:
        issues.append('雙數學島（數字與單位分開）')
    if re.search(r'5\.4\s*,\s*M|10\^\{?-5\}?\s*,\s*M', text):
        issues.append('科學記號與單位間出現逗號怪字')
    # 裸 LaTeX 漏出
    if re.search(r'\\htmlData|\\dfrac|\\times|\\mathrm\{', text):
        issues.append('頁面可見裸 LaTeX 指令')
    if re.search(r'(?<![\d.])\^\s*\{?-?\d', text) and '10^' in text.replace(' ', ''):
        # 粗略：純文字區出現未渲染 ^
        if re.search(r'10\^\{?-?\d', text):
            issues.append('科學記號疑似未渲染（10^）')
    # NOTE 品質：tooltip / data-note
    notes = re.findall(r'data-note="([^"]*)"', html)
    notes += re.findall(r'title="([^"]*)"', html)
    bad_notes = []
    for n in notes:
        n2 = n.strip()
        if not n2:
            continue
        if re.fullmatch(r'[\d.\s×xX\^*\-−]+', n2):
            bad_notes.append(n2)
        if re.search(r'\\[a-zA-Z]|\$', n2):
            bad_notes.append(n2)
        if len(n2) > 80:
            bad_notes.append(n2[:60] + '…')
    if bad_notes:
        issues.append('不合理 NOTE: ' + '; '.join(bad_notes[:5]))
    # 連續奇怪標點
    if re.search(r'[，,]\s*[，,]|\$\s*\$', text):
        issues.append('連續標點或空數學島')
    return issues


def run_one(page, name: str, question: str) -> dict:
    console_logs: list[str] = []
    page.on('console', lambda msg: console_logs.append(f'{msg.type}: {msg.text}'[:500]))

    last: dict | None = None
    for attempt in range(1, RETRIES + 1):
        page.goto(f'{BASE}/index.html', wait_until='domcontentloaded', timeout=60000)
        page.evaluate(
            """({key, model}) => {
              localStorage.setItem('aip', 'gemini');
              localStorage.setItem('aik', key);
              localStorage.setItem('aim', model);
              sessionStorage.setItem('aip', 'gemini');
              sessionStorage.setItem('aik', key);
              sessionStorage.setItem('aim', model);
            }""",
            {'key': API_KEY, 'model': MODEL},
        )
        page.reload(wait_until='networkidle', timeout=60000)
        page.fill('#textQuestionInput', question)
        page.evaluate(
            """({key, model}) => {
              if (typeof cfg !== 'undefined') {
                cfg.key = key;
                cfg.provider = 'gemini';
                cfg.model = model;
              }
              const inp = document.getElementById('keyInput');
              if (inp) inp.value = key;
              const sel = document.getElementById('modelSel');
              if (sel) sel.value = model;
              const btn = document.getElementById('solveBtn');
              if (btn) btn.disabled = false;
            }""",
            {'key': API_KEY, 'model': MODEL},
        )
        console_logs.clear()
        page.click('#solveBtn')
        page.wait_for_function(
            """() => {
              const b = document.getElementById('badge');
              const t = (b && b.textContent || '').trim();
              return t === '詳解完成' || t === '錯誤' || t === '追問完成';
            }""",
            timeout=TIMEOUT_MS,
        )
        badge = page.locator('#badge').inner_text().strip()
        html = page.locator('#mainSolution').inner_html()
        text = page.locator('#mainSolution').inner_text()
        shot = OUT / f'{name}.png'
        page.screenshot(path=str(shot), full_page=True)
        (OUT / f'{name}.html').write_text(html, encoding='utf-8')
        (OUT / f'{name}.txt').write_text(text, encoding='utf-8')

        note_info = page.evaluate(
            """() => {
              const nodes = [...document.querySelectorAll(
                '#mainSolution [data-note], #mainSolution .math-note, #mainSolution .noteable, #mainSolution .katex [title], #mainSolution [data-tooltip]'
              )];
              return nodes.slice(0, 120).map(el => ({
                tag: el.tagName,
                cls: el.className,
                note: el.getAttribute('data-note') || el.getAttribute('title') || el.getAttribute('data-tooltip') || '',
                text: (el.textContent || '').slice(0, 40)
              })).filter(x => x.note || /note/i.test(String(x.cls)));
            }"""
        )
        (OUT / f'{name}-notes.json').write_text(json.dumps(note_info, ensure_ascii=False, indent=2), encoding='utf-8')
        (OUT / f'{name}-console.json').write_text(json.dumps(console_logs[-40:], ensure_ascii=False, indent=2), encoding='utf-8')

        issues = []
        rate_limited = '請求過多' in text or '額度' in text or 'rate' in text.lower()
        if badge == '錯誤':
            issues.append('解題狀態為錯誤: ' + text.replace('\n', ' ')[:240])
        issues += scan_display(text, html)

        samples = []
        for pat in [r'.{0,20}5\.4.{0,30}', r'.{0,15}H3PO4.{0,20}', r'.{0,15}H₃PO₄.{0,20}', r'.{0,10}10\s*[×xX].{0,25}']:
            m = re.search(pat, text)
            if m:
                samples.append(m.group(0).replace('\n', ' '))

        last = {
            'name': name,
            'badge': badge,
            'model': MODEL,
            'attempt': attempt,
            'issues': issues,
            'samples': samples,
            'note_count': len(note_info),
            'notes': note_info[:20],
            'text_len': len(text),
            'screenshot': str(shot),
            'console_tail': console_logs[-8:],
        }
        if badge == '詳解完成' and not rate_limited:
            return last
        if attempt < RETRIES and (rate_limited or badge == '錯誤'):
            print(f'  attempt {attempt} failed ({badge}); wait {RETRY_WAIT_S}s…', flush=True)
            time.sleep(RETRY_WAIT_S)
            continue
        return last
    return last or {'name': name, 'badge': 'EXCEPTION', 'issues': ['no result'], 'samples': [], 'note_count': 0, 'notes': [], 'text_len': 0}


def main() -> int:
    if not API_KEY:
        print('缺少 GEMINI_API_KEY')
        return 2
    names = sys.argv[1:] or ['titration', 'acid-strength']
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 900})
        page = context.new_page()
        page.set_default_timeout(60000)
        for name in names:
            if name not in QUESTIONS:
                print(f'未知題目: {name}')
                continue
            print(f'=== 開始網頁解題: {name} ===', flush=True)
            t0 = time.time()
            try:
                r = run_one(page, name, QUESTIONS[name])
            except Exception as e:
                r = {'name': name, 'badge': 'EXCEPTION', 'issues': [str(e)[:400]], 'samples': [], 'note_count': 0, 'notes': [], 'text_len': 0}
            r['elapsed_s'] = round(time.time() - t0, 1)
            results.append(r)
            print(json.dumps({k: v for k, v in r.items() if k != 'notes'}, ensure_ascii=False, indent=2), flush=True)
        browser.close()
    (OUT / 'summary.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    failed = [r for r in results if r.get('issues') or r.get('badge') != '詳解完成']
    print('\n=== SUMMARY ===')
    for r in results:
        status = 'PASS' if (not r.get('issues') and r.get('badge') == '詳解完成') else 'FAIL'
        print(f"{status} {r['name']} badge={r.get('badge')} issues={len(r.get('issues') or [])} elapsed={r.get('elapsed_s')}s")
        for i in r.get('issues') or []:
            print('  -', i)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
