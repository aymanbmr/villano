# Installe le relais d'impression pour qu'il demarre automatiquement avec
# Windows, reduit (pas de fenetre visible au quotidien).
#   powershell -ExecutionPolicy Bypass -File relay\install-startup.ps1

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cmd = Join-Path $here 'Villano-relay.cmd'

if (-not (Test-Path (Join-Path $here 'relay.env'))) {
  Write-Host "ATTENTION : relay.env n'existe pas encore." -ForegroundColor Yellow
  Write-Host "Copiez relay.env.example en relay.env et renseignez SERVER_URL + RELAY_TOKEN avant de continuer."
  exit 1
}

$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path $startupDir 'Villano-relay.lnk'))
$lnk.TargetPath = "$env:ComSpec"
$lnk.Arguments = "/c `"$cmd`""
$lnk.WorkingDirectory = $here
$lnk.WindowStyle = 7  # minimized
$lnk.Description = 'Villano - relais d''impression (connecte le serveur aux imprimantes locales)'
$lnk.Save()

Write-Host "Installe : le relais demarrera automatiquement a la prochaine ouverture de session."
Write-Host "Pour le lancer tout de suite sans redemarrer : double-cliquez sur Villano-relay.cmd"
