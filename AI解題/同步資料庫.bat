@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在把 database 同步到內建檔案...
python -c "import json,os,glob; p=r'%~dp0'; db=os.path.join(p,'database'); files={};
methods_path=os.path.join(db,'methods.json');
methods=json.load(open(methods_path,encoding='utf-8')) if os.path.isfile(methods_path) else {'methods':{}};
names=[];
for fp in sorted(glob.glob(os.path.join(db,'*.md'))):
  fn=os.path.basename(fp);
  if fn.startswith('_') or fn.lower()=='readme.md': continue
  names.append(fn);
  files[fn]=open(fp,encoding='utf-8').read();
idx={'files':names,'updated':__import__('datetime').datetime.now().isoformat(timespec='seconds')};
open(os.path.join(db,'index.json'),'w',encoding='utf-8').write(json.dumps(idx,ensure_ascii=False,indent=2)+'\n');
bundle={'files':files,'methods':methods.get('methods',{})};
open(os.path.join(p,'js','database-bundle.js'),'w',encoding='utf-8').write('/* 內建題庫：由同步資料庫.bat 自動產生 */\nconst EMBEDDED_DATABASE = '+json.dumps(bundle,ensure_ascii=False,indent=2)+';\n');
print('已同步',len(names),'個 .md')"
if errorlevel 1 (
  echo 失敗：請確認已安裝 Python
  pause
  exit /b 1
)
echo 完成。現在可直接雙擊 index.html 測試。
pause
