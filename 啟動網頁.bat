@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ?飛閫??撌亙 ???祆?隡箸???
echo  ================================
echo  ??敺????汗?剁?
echo  http://localhost:18080/index.html
echo.
echo  ??甇方?蝒?迫隡箸???
echo  ================================
echo.
python dev-server.py
pause
