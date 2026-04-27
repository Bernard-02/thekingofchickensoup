@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   雞湯王展演啟動器
echo ========================================
echo.

echo [1/3] 拉取最新版本...
git pull
echo.

echo [2/3] 啟動本機 HTTP 伺服器於 http://localhost:5500
echo       （這個視窗請保持開著；展演結束關掉視窗即可）
echo.

echo [3/3] 開啟瀏覽器...
timeout /t 1 /nobreak >nul
start http://localhost:5500/index.html

REM 用 Python 內建 HTTP server。沒裝 Python 的話請改用 VS Code 的 Live Server。
python -m http.server 5500

REM 如果 python 指令不存在會看到 "python is not recognized"，那就：
REM   方案 A：去 python.org 下載 Python（一次性安裝）
REM   方案 B：手動用 VS Code 開資料夾，右鍵 index.html → Open with Live Server
pause
