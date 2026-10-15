@echo off
:: CLIENT shortcut for another PC (works on Windows 7 with Chrome 109+):
:: opens the caisse served by the server PC in an app window (no browser bars).
:: Change SERVER to the server PC's address.
:: --kiosk-printing : le ticket part sur l'imprimante par defaut de Windows
:: sans ouvrir de fenetre. Ne sert que si aucune imprimante reseau n'est
:: configuree dans Admin -> Imprimantes ; dans ce cas c'est le serveur qui
:: imprime et le navigateur n'est pas sollicite.
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
  start "" "%CHROME%" --app=%SERVER%/#/caisse --window-size=1400,900 --kiosk-printing --user-data-dir="%PROFIL%"
  exit /b 0
)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%SERVER%/#/caisse --window-size=1400,900 --kiosk-printing --user-data-dir="%PROFIL%"
  exit /b 0
)
echo Chrome ou Edge introuvable. Ouvrez %SERVER% dans un navigateur.
pause
