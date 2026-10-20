# Agent d'impression Villano -- a lancer sur la caisse.
#
# Il attend les tickets que la caisse lui remet et les pousse vers l'imprimante
# demandee, sur le reseau local. C'est tout.
#
# A ne pas confondre avec Villano-relay.ps1, qui faisait l'inverse : celui-la
# allait CHERCHER les tickets sur le serveur heberge, d'ou le delai et la
# dependance a internet. Ici la caisse fabrique ses tickets elle-meme et les
# donne a l'agent, sur la meme machine : l'impression ne quitte jamais le cafe
# et fonctionne donc coupure ou pas.
#
# Deux imprimantes, deux adresses : le navigateur n'a qu'une seule destination
# d'impression, c'est pourquoi le bon de cuisine ne peut pas passer par lui.
# L'agent, lui, envoie chaque ticket a l'adresse que la caisse lui indique.
#
#   powershell -ExecutionPolicy Bypass -File Villano-imprimante.ps1
#
# Ou plus simplement : double-cliquez sur Villano-imprimante.cmd.
#
# Rien a installer : TcpListener et TcpClient viennent de .NET, present
# d'origine sur Windows 7. Pas de droits administrateur non plus -- contrairement
# a un vrai serveur HTTP Windows, qui aurait exige une reservation netsh.
#
# Ce fichier est volontairement sans aucun caractere accentue : PowerShell lit
# un .ps1 sans marqueur d'encodage comme de l'ANSI, et un accent y suffirait a
# empecher le script de demarrer.

param(
    [int] $Port = 9631
)

$ErrorActionPreference = 'Stop'

function Write-Log($message) {
    Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $message)
}

# ------------------------------------------------------------------ JSON (PS 2)

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

function Get-Field($obj, $name) {
    if ($obj -is [System.Collections.IDictionary]) { return $obj[$name] }
    return $obj.$name
}

# ------------------------------------------------------------------- imprimante

# Envoi brut sur le port d'impression, exactement ce que faisait le serveur
# quand il se trouvait sur le meme reseau que l'imprimante.
function Send-ToPrinter($printerHost, $printerPort, $bytes) {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.SendTimeout = 3000
    $client.ReceiveTimeout = 3000
    try {
        $connect = $client.BeginConnect($printerHost, $printerPort, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(3000, $false)) {
            throw ($printerHost + ':' + $printerPort + ' ne repond pas')
        }
        $client.EndConnect($connect)
        $stream = $client.GetStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush()
        # L'imprimante a besoin d'un instant avant la fermeture, sans quoi la
        # fin du ticket est parfois perdue.
        Start-Sleep -Milliseconds 150
        $stream.Close()
    } finally {
        $client.Close()
    }
}

# ------------------------------------------------------------------------- HTTP

# Un serveur HTTP minimal ecrit a la main sur TcpListener. C'est plus de lignes
# que HttpListener, mais HttpListener aurait reclame des droits administrateur
# ou une reservation d'URL : inutilisable sur une caisse ouverte par l'employe.
function Read-Request($stream) {
    $memoire = New-Object System.IO.MemoryStream
    $tampon = New-Object byte[] 8192
    $finEntetes = -1
    $longueur = -1

    while ($true) {
        $lu = $stream.Read($tampon, 0, $tampon.Length)
        if ($lu -le 0) { return $null }
        $memoire.Write($tampon, 0, $lu)
        $octets = $memoire.ToArray()
        # Entetes et corps sont de l'ASCII (du JSON en base64) : pas de piege
        # d'encodage ici, contrairement au contenu des tickets.
        $texte = [System.Text.Encoding]::ASCII.GetString($octets)

        if ($finEntetes -lt 0) {
            $finEntetes = $texte.IndexOf("`r`n`r`n")
            if ($finEntetes -ge 0) {
                $longueur = 0
                foreach ($ligne in ($texte.Substring(0, $finEntetes) -split "`r`n")) {
                    # -match est insensible a la casse en PowerShell
                    if ($ligne -match '^content-length:\s*(\d+)') {
                        $longueur = [int]$matches[1]
                    }
                }
            }
        }

        if ($finEntetes -ge 0) {
            $debutCorps = $finEntetes + 4
            if (($octets.Length - $debutCorps) -ge $longueur) {
                $premiereLigne = ($texte -split "`r`n")[0]
                $morceaux = $premiereLigne -split ' '
                $corps = ''
                if ($longueur -gt 0) { $corps = $texte.Substring($debutCorps, $longueur) }
                return @{
                    Methode = $morceaux[0]
                    Chemin  = $morceaux[1]
                    Corps   = $corps
                }
            }
        }
    }
}

function Send-Response($stream, $code, $statut, $corps) {
    $octetsCorps = [System.Text.Encoding]::UTF8.GetBytes($corps)
    # Access-Control-Allow-Origin : la page de la caisse vient du serveur
    # heberge, donc d'une autre origine que 127.0.0.1. Sans cet entete le
    # navigateur refuserait de lire la reponse.
    # Access-Control-Allow-Private-Network : Chrome restreint les appels d'une
    # page publique vers le reseau local ; cet entete est la reponse attendue.
    $entetes = "HTTP/1.1 $code $statut`r`n" +
        "Content-Type: application/json`r`n" +
        "Content-Length: $($octetsCorps.Length)`r`n" +
        "Access-Control-Allow-Origin: *`r`n" +
        "Access-Control-Allow-Headers: content-type`r`n" +
        "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
        "Access-Control-Allow-Private-Network: true`r`n" +
        "Access-Control-Max-Age: 86400`r`n" +
        "Connection: close`r`n`r`n"
    $octetsEntetes = [System.Text.Encoding]::ASCII.GetBytes($entetes)
    $stream.Write($octetsEntetes, 0, $octetsEntetes.Length)
    $stream.Write($octetsCorps, 0, $octetsCorps.Length)
    $stream.Flush()
}

# ----------------------------------------------------------------------- boucle

try {
    $ecouteur = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
    $ecouteur.Start()
} catch {
    Write-Host ("Impossible d'ecouter sur le port " + $Port + " : " + $_.Exception.Message) -ForegroundColor Red
    Write-Host "Un autre agent tourne peut-etre deja. Fermez-le, puis relancez."
    Read-Host "Entree pour fermer"
    exit 1
}

Write-Log ('Agent d impression demarre sur 127.0.0.1:' + $Port + '.')
Write-Log 'Laissez cette fenetre ouverte. Ctrl+C pour arreter.'

$imprimes = 0

while ($true) {
    $client = $null
    try {
        $client = $ecouteur.AcceptTcpClient()
        $client.ReceiveTimeout = 5000
        $client.SendTimeout = 5000
        $stream = $client.GetStream()

        $requete = Read-Request $stream
        if (-not $requete) { continue }

        if ($requete.Methode -eq 'OPTIONS') {
            Send-Response $stream 204 'No Content' ''
            continue
        }

        if ($requete.Chemin -eq '/ping') {
            Send-Response $stream 200 'OK' '{"ok":true,"agent":"villano"}'
            continue
        }

        if ($requete.Chemin -ne '/print' -or $requete.Methode -ne 'POST') {
            Send-Response $stream 404 'Not Found' '{"error":"chemin inconnu"}'
            continue
        }

        $job = ConvertFrom-JsonCompat $requete.Corps
        $printerHost = Get-Field $job 'host'
        $rawPort = Get-Field $job 'port'
        $payload = Get-Field $job 'payload'

        if (-not $printerHost -or -not $payload) {
            Send-Response $stream 400 'Bad Request' '{"printed":false,"error":"host ou payload manquant"}'
            Write-Log 'Ticket refuse : host ou payload manquant.'
            continue
        }

        $printerPort = 9100
        if ($rawPort) { $printerPort = [int]$rawPort }

        try {
            $bytes = [Convert]::FromBase64String($payload)
            Send-ToPrinter $printerHost $printerPort $bytes
            $imprimes = $imprimes + 1
            Send-Response $stream 200 'OK' '{"printed":true}'
            Write-Log ('Ticket ' + $imprimes + ' imprime sur ' + $printerHost + ':' + $printerPort +
                ' (' + $bytes.Length + ' octets)')
        } catch {
            # L'imprimante est peut-etre eteinte. On le dit a la caisse, qui
            # avertira l'employe plutot que de laisser croire a un ticket sorti.
            $raison = $_.Exception.Message -replace '"', "'"
            Send-Response $stream 502 'Bad Gateway' ('{"printed":false,"error":"' + $raison + '"}')
            Write-Log ($printerHost + ':' + $printerPort + ' injoignable -- ' + $_.Exception.Message)
        }
    } catch {
        Write-Log ('Requete abandonnee : ' + $_.Exception.Message)
    } finally {
        if ($client) { $client.Close() }
    }
}
