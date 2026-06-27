@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  化學解題工具 — 本機伺服器
echo  ================================
echo  啟動後請開啟瀏覽器：
echo  http://localhost:8080/index.html
echo  http://localhost:8080/molfile-preview.html
echo.
echo  關閉此視窗即停止伺服器
echo  ================================
echo.
python -m http.server 8080
pause
