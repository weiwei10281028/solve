@echo off
chcp 65001 >nul
set "DB=%~dp0database"
echo 清理舊版題庫 MD（保留 formats\、README、methods.json）...
for %%f in ("%DB%\*.md") do (
  if /I not "%%~nxf"=="README.md" del /f "%%f" 2>nul
)
if exist "%DB%\chapters" rd /s /q "%DB%\chapters"
if exist "%DB%\rules" rd /s /q "%DB%\rules"
if exist "%DB%\types" rd /s /q "%DB%\types"
if exist "%DB%\traps" rd /s /q "%DB%\traps"
del /f "%DB%\index.json" 2>nul
echo 完成。請執行「同步資料庫.bat」重新打包。
pause
