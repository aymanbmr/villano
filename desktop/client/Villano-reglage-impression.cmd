@echo off
:: A lancer UNE SEULE FOIS, pour apprendre a la caisse sur quelle imprimante
:: sortir les tickets.
::
:: Pourquoi c'est necessaire : le raccourci habituel ajoute --kiosk-printing,
:: qui imprime sans rien demander. Pratique en service, mais cela supprime la
:: seule fenetre ou l'on peut choisir l'imprimante. Tant que ce choix n'a pas
:: ete fait une fois dans CE profil Chrome, l'impression silencieuse part vers
:: la destination que Chrome avait retenue -- souvent "Enregistrer au format
:: PDF". Le ticket est alors bel et bien imprime... dans un fichier, et rien ne
:: sort de l'imprimante ni ne signale l'erreur.
::
:: Ce raccourci ouvre le meme profil SANS --kiosk-printing : la fenetre
:: d'impression reapparait, on y choisit l'imprimante du comptoir, et Chrome
:: s'en souvient. Le raccourci normal imprimera ensuite dessus, en silence.
::
:: MARCHE A SUIVRE
::   1. Fermez d'abord la fenetre de la caisse (sinon Chrome se rattache a
::      l'instance deja ouverte et ce raccourci reste sans effet).
::   2. Double-cliquez sur ce fichier.
::   3. Encaissez une commande pour de bon, ou faites Ctrl+P.
::   4. Dans "Destination", choisissez COMPTOIRE PRINTER, puis Imprimer.
::   5. Verifiez que le ticket sort. Fermez cette fenetre.
::   6. Reprenez le raccourci habituel : plus aucune fenetre, le ticket sort
::      tout seul.
set "SERVER=http://15.235.101.205:3000"
set "PROFIL=%LocalAppData%\Villano-caisse"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  echo Fenetre de reglage ouverte. Choisissez COMPTOIRE PRINTER dans Destination.
  start "" "%CHROME%" --app=%SERVER%/#/caisse --window-size=1400,900 --user-data-dir="%PROFIL%"
  exit /b 0
)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%SERVER%/#/caisse --window-size=1400,900 --user-data-dir="%PROFIL%"
  exit /b 0
)
echo Chrome ou Edge introuvable. Ouvrez %SERVER% dans un navigateur.
pause
