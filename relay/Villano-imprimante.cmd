@echo off
:: Lance l'agent d'impression de la caisse.
::
:: A laisser tourner pendant le service : c'est lui qui pousse les tickets vers
:: les imprimantes du reseau local. La caisse les lui remet directement, sans
:: passer par internet -- l'impression fonctionne donc coupure ou pas.
::
:: Pour qu'il demarre tout seul avec Windows, mettez un raccourci vers ce
:: fichier dans :
::   C:\Users\<vous>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
:: (ou tapez shell:startup dans la barre d'adresse de l'Explorateur)
cd /d "%~dp0"
echo Agent d'impression Villano. Laissez cette fenetre ouverte.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Villano-imprimante.ps1"
echo.
echo L'agent s'est arrete.
pause
