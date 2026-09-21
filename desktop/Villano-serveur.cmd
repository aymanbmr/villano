@echo off
:: Starts only the Villano server (no app window), minimized.
:: Used by the Startup shortcut so the server is up as soon as Windows starts.
set "ROOT=%~dp0.."
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3000/ | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 exit /b 0
start "Villano - serveur" /min cmd /c "cd /d "%ROOT%\backend" && node dist/main.js"
