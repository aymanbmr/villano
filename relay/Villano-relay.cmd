@echo off
:: Lance le relais d'impression. Garde cette fenetre reduite en permanence
:: (ou installez-la au demarrage de Windows avec install-startup.ps1).
::
:: Deux versions existent, et ce script choisit tout seul :
::   - relay.js         : rapide, mais exige Node.js 18 ou plus recent
::   - Villano-relay.ps1 : PowerShell, rien a installer, marche sur Windows 7
set "ROOT=%~dp0"
cd /d "%ROOT%"

where node >nul 2>&1
if errorlevel 1 goto powershell

:: Node present : encore faut-il qu'il soit assez recent pour « fetch »
for /f "tokens=1 delims=." %%v in ('node --version') do set "NODEMAJOR=%%v"
set "NODEMAJOR=%NODEMAJOR:v=%"
if %NODEMAJOR% GEQ 18 (
  echo Relais via Node.js %NODEMAJOR%.
  node relay.js
  pause
  exit /b 0
)
echo Node.js %NODEMAJOR% est trop ancien pour le relais ^(18 minimum^) : bascule sur PowerShell.

:powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%Villano-relay.ps1"
pause
