# Relais d'impression Villano -- version PowerShell, pour Windows 7.
#
# Meme role que relay.js : il recupere aupres du serveur heberge les tickets
# que celui-ci ne peut pas envoyer lui-meme, et les transmet aux imprimantes du
# reseau local. La difference est qu'il n'exige RIEN a installer : il n'utilise
# que PowerShell et .NET, presents d'origine sur Windows 7.
#
# C'est la version a employer sur une caisse ancienne, Node.js ne s'installant
# plus sur Windows 7 depuis longtemps.
#
#   powershell -ExecutionPolicy Bypass -File Villano-relay.ps1
#
# Ou plus simplement : double-cliquez sur Villano-relay.cmd.
#
# Ce fichier est volontairement sans aucun caractere accentue : PowerShell lit
# un .ps1 sans marqueur d'encodage comme de l'ANSI, et un accent y suffirait a
# empecher le script de demarrer.

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- configuration

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $here 'relay.env'

if (-not (Test-Path $envFile)) {
    Write-Host "Fichier relay.env introuvable a cote du script." -ForegroundColor Red
    Write-Host "Copiez relay.env.example en relay.env et renseignez-le."
    Read-Host "Entree pour fermer"
    exit 1
}

$settings = @{}
foreach ($line in Get-Content $envFile) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $at = $trimmed.IndexOf('=')
    if ($at -lt 1) { continue }
    $settings[$trimmed.Substring(0, $at).Trim()] = $trimmed.Substring($at + 1).Trim()
}

$serverUrl = $settings['SERVER_URL']
$relayToken = $settings['RELAY_TOKEN']
$pollMs = 3000
if ($settings.ContainsKey('POLL_INTERVAL_MS') -and $settings['POLL_INTERVAL_MS']) {
    $pollMs = [int]$settings['POLL_INTERVAL_MS']
}

if (-not $serverUrl -or -not $relayToken) {
    Write-Host "SERVER_URL et RELAY_TOKEN doivent etre renseignes dans relay.env." -ForegroundColor Red
    Read-Host "Entree pour fermer"
    exit 1
}
$serverUrl = $serverUrl.TrimEnd('/')

function Write-Log($message) {
    Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $message)
}

# ------------------------------------------------------------------- transport

# Invoke-RestMethod n'existe qu'a partir de PowerShell 3 : on passe par .NET,
# disponible sur toutes les versions de Windows 7.
function Invoke-Server($method, $path) {
    $request = [System.Net.HttpWebRequest]::Create($serverUrl + $path)
    $request.Method = $method
    $request.Timeout = 15000
    $request.Headers.Add('X-Relay-Token', $relayToken)
    $request.UserAgent = 'Villano-Relay-PowerShell'

    $response = $request.GetResponse()
    try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        try { return $reader.ReadToEnd() } finally { $reader.Close() }
    } finally {
        $response.Close()
    }
}

# ConvertFrom-Json n'existe qu'a partir de PowerShell 3 ; le serialiseur .NET
# rend le meme service sur les machines restees en PowerShell 2.
function ConvertFrom-JsonCompat($text) {
    if (Get-Command ConvertFrom-Json -ErrorAction SilentlyContinue) {
        return ConvertFrom-Json $text
    }
    Add-Type -AssemblyName System.Web.Extensions
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $serializer.MaxJsonLength = [int]::MaxValue
    return $serializer.DeserializeObject($text)
}

function Get-Field($job, $name) {
    if ($job -is [System.Collections.IDictionary]) { return $job[$name] }
    return $job.$name
}

# Envoi brut sur le port d'impression, exactement ce que fait le serveur quand
# il se trouve sur le meme reseau que l'imprimante.
function Send-ToPrinter($printerHost, $printerPort, $bytes) {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.SendTimeout = 8000
    $client.ReceiveTimeout = 8000
    try {
        $connect = $client.BeginConnect($printerHost, $printerPort, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(8000, $false)) {
            throw ($printerHost + ':' + $printerPort + ' ne repond pas')
        }
        $client.EndConnect($connect)
        $stream = $client.GetStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush()
        Start-Sleep -Milliseconds 150
        $stream.Close()
    } finally {
        $client.Close()
    }
}

# ----------------------------------------------------------------------- boucle

Write-Log ('Relais demarre -- serveur ' + $serverUrl + ', verification toutes les ' + [int]($pollMs / 1000) + ' s.')
Write-Log 'Laissez cette fenetre ouverte. Ctrl+C pour arreter.'

while ($true) {
    try {
        $raw = Invoke-Server 'GET' '/api/printing/relay/jobs'
        $jobs = ConvertFrom-JsonCompat $raw

        foreach ($job in $jobs) {
            $id = Get-Field $job 'id'
            $printerHost = Get-Field $job 'host'
            $printerPort = [int](Get-Field $job 'port')
            $payload = Get-Field $job 'payload'
            try {
                $bytes = [Convert]::FromBase64String($payload)
                Send-ToPrinter $printerHost $printerPort $bytes
                Invoke-Server 'DELETE' ('/api/printing/relay/jobs/' + $id) | Out-Null
                Write-Log ('Ticket ' + $id + ' imprime sur ' + $printerHost + ':' + $printerPort)
            } catch {
                # L'imprimante est peut-etre juste eteinte : on retente au tour
                # suivant plutot que de perdre le ticket.
                Write-Log ('Ticket ' + $id + ' en attente : ' + $_.Exception.Message)
            }
        }
    } catch {
        Write-Log ('Serveur injoignable : ' + $_.Exception.Message)
    }

    Start-Sleep -Milliseconds $pollMs
}
