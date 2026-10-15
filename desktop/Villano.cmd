@echo off
setlocal
:: Launches Villano as a desktop app: starts the server if it is not already
:: running (production build, one process on port 3000), then opens the app in
:: a borderless browser window.

:: --kiosk-printing : le ticket part sur l'imprimante par defaut de Windows
:: sans ouvrir de fenetre. Ne sert que si aucune imprimante reseau n'est
:: configuree dans Admin -> Imprimantes ; dans ce cas c'est le serveur qui
:: imprime et le navigateur n'est pas sollicite.
set "ROOT=%~dp0.."
set "PROFIL=%LocalAppData%\Villano-caisse"
set "URL=http://localhost:3000/#/caisse"

:: Is the server already up?
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3000/api/auth/me) | Out-Null } catch { if ($_.Exception.Response.StatusCode.value__ -eq 401) { exit 0 } else { exit 1 } }; exit 0" >nul 2>&1
if %errorlevel%==0 goto open

:: Build once if the production build is missing
if not exist "%ROOT%\backend\dist\main.js" (
  echo Premiere installation : compilation en cours, patientez...
  pushd "%ROOT%"
  call npm run build
  popd
)
if not exist "%ROOT%\frontend\dist\index.html" (
  pushd "%ROOT%"
  call npm run build --prefix frontend
  popd
)

:: Start the server minimized in its own window (close it to stop Villano)
start "Villano - serveur" /min cmd /c "cd /d "%ROOT%\backend" && node dist/main.js"

:: Wait until it answers (max ~30 s)
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3000/) | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto open
if %tries% geq 30 (
  echo Le serveur ne repond pas. Verifiez la fenetre "Villano - serveur".
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait

:open
:: --app = standalone window without tabs / address bar. Edge first, Chrome as fallback.
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%URL% --window-size=1400,900 --kiosk-printing --user-data-dir="%PROFIL%"
  exit /b 0
)
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app=%URL% --window-size=1400,900 --kiosk-printing --user-data-dir="%PROFIL%"
  exit /b 0
)
start "" %URL%
