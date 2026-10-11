# Creates a "Villano" shortcut on the Desktop (and in the Start menu) for a
# CLIENT PC: opens the caisse served by the remote server (see SERVER in
# Villano-caisse.cmd) in its own app window, no browser bars.
#   powershell -ExecutionPolicy Bypass -File desktop\client\create-shortcut.ps1

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cmd = Join-Path $here 'Villano-caisse.cmd'
$icon = Join-Path $here '..\villano.ico'

$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Villano.lnk'))
  # Run the .cmd through cmd.exe minimized so no console window stays visible
  $lnk.TargetPath = "$env:ComSpec"
  $lnk.Arguments = "/c `"$cmd`""
  $lnk.WorkingDirectory = $here
  $lnk.IconLocation = "$icon,0"
  $lnk.WindowStyle = 7  # minimized
  $lnk.Description = 'Villano - caisse et gestion du restaurant'
  $lnk.Save()
  Write-Host "Raccourci cree : $(Join-Path $dir 'Villano.lnk')"
}
