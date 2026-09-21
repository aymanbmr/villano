@echo off
setlocal
:: One-shot installation on a new PC (the café's caisse):
::   1. checks Node.js, 2. installs dependencies, 3. creates backend\.env,
::   4. builds the app, 5. puts the "Villano" shortcut on the Desktop.
:: Requires: Node.js LTS installed (https://nodejs.org) and this folder copied
:: or cloned on the PC.

set "ROOT=%~dp0.."
pushd "%ROOT%"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js est introuvable. Installez-le depuis https://nodejs.org ^(version LTS^), puis relancez install.cmd.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo Node.js %%v detecte.

echo.
echo [1/4] Installation des dependances (quelques minutes)...
call npm run install:all
if errorlevel 1 goto fail

echo.
echo [2/4] Configuration...
if not exist "backend\.env" (
  copy /y "backend\.env.example" "backend\.env" >nul
  echo   backend\.env cree. Pensez a y changer ADMIN_PASSWORD et JWT_SECRET.
) else (
  echo   backend\.env deja present.
)

echo.
echo [3/4] Compilation de l'application...
call npm run build
if errorlevel 1 goto fail

echo.
echo [4/4] Raccourci sur le Bureau...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"

echo.
echo Installation terminee. Double-cliquez sur "Villano" sur le Bureau.
echo Mot de passe admin par defaut : admin1234 (a changer dans backend\.env).
popd
pause
exit /b 0

:fail
echo.
echo L'installation a echoue. Verifiez les messages ci-dessus.
popd
pause
exit /b 1
