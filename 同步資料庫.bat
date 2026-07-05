@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo Syncing database...
python sync-database.py
if errorlevel 1 goto fail
echo Done. Open index.html to test.
exit /b 0

:fail
echo FAILED. Install Python or check sync-database.py exists.
pause
exit /b 1
