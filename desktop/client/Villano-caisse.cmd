@echo off
:: CLIENT shortcut for another PC (works on Windows 7 with Chrome 109+):
:: opens the caisse served by the server PC in an app window (no browser bars).
:: Change SERVER to the server PC's address.
set "SERVER=http://192.168.1.32:3000"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app=%SERVER%/#/caisse --window-size=1400,900
  exit /b 0
)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%SERVER%/#/caisse --window-size=1400,900
  exit /b 0
)
echo Chrome ou Edge introuvable. Ouvrez %SERVER% dans un navigateur.
pause
