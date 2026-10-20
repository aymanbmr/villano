@echo off
:: CLIENT shortcut for another PC (works on Windows 7 with Chrome 109+):
:: opens the caisse served by the server PC in an app window (no browser bars).
:: Change SERVER to the server PC's address.
:: Les tickets ne passent normalement PAS par le navigateur : l'agent
:: d'impression (relay\Villano-imprimante.cmd) tourne sur cette machine, et la
:: caisse lui remet directement les octets de chaque ticket. C'est ce qui rend
:: l'impression independante d'internet, et ce qui permet d'envoyer le bon de
:: cuisine sur son imprimante -- le navigateur, lui, n'a qu'une destination.
::
:: --kiosk-printing : filet de secours. Si l'agent n'est pas lance, le ticket
:: part sur l'imprimante par defaut de Windows sans ouvrir de fenetre.
::
:: --disable-features=BlockInsecurePrivateNetworkRequests : la page vient du
:: serveur heberge et appelle l'agent sur 127.0.0.1. Chrome restreint ce genre
:: d'appel ; l'agent repond deja l'entete qui l'autorise, et ce drapeau leve le
:: dernier doute sur les versions qui durcissent la regle.
::
:: --user-data-dir : un profil Chrome a part, et c'est indispensable. Lance
:: sans lui alors qu'une fenetre Chrome est deja ouverte, le raccourci se
:: rattache a l'instance existante et toutes les options sont ignorees -- la
:: fenetre d'impression reapparait alors a chaque vente, sans qu'on comprenne
:: pourquoi. Avec son propre profil, la caisse a toujours son instance.
set "SERVER=http://15.235.101.205:3000"
set "PROFIL=%LocalAppData%\Villano-caisse"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app=%SERVER%/#/caisse --window-size=1400,900 --kiosk-printing --user-data-dir="%PROFIL%" --disable-features=BlockInsecurePrivateNetworkRequests
  exit /b 0
)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%SERVER%/#/caisse --window-size=1400,900 --kiosk-printing --user-data-dir="%PROFIL%" --disable-features=BlockInsecurePrivateNetworkRequests
  exit /b 0
)
echo Chrome ou Edge introuvable. Ouvrez %SERVER% dans un navigateur.
pause
