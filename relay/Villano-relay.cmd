@echo off
:: Lance le relais d'impression. Garde cette fenetre reduite en permanence
:: (ou installez-la au demarrage de Windows avec install-startup.ps1).
set "ROOT=%~dp0"
cd /d "%ROOT%"
node relay.js
pause
