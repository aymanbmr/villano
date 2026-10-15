#!/usr/bin/env bash
# Envoie la base du café vers le VPS, qui en sert une copie de consultation.
#
#   bash deploy/mirror-to-vps.sh ubuntu@15.235.101.205
#
# À faire tourner **sur la machine du café**, celle qui tient la vraie base.
# Le VPS doit être démarré avec READ_ONLY=true : il refuse alors toute écriture,
# faute de quoi une commande qui y serait prise disparaîtrait à l'envoi suivant.
#
# Une clé SSH sans mot de passe est nécessaire, sinon le script s'arrêterait
# pour en demander un à chaque passage :
#   ssh-keygen -t ed25519           (si vous n'en avez pas)
#   ssh-copy-id ubuntu@15.235.101.205
set -euo pipefail

CIBLE="${1:-}"
DB_LOCALE="${DB_LOCALE:-/opt/villano/backend/villano.sqlite}"
DB_DISTANTE="${DB_DISTANTE:-/opt/villano/backend/villano.sqlite}"

if [[ -z "$CIBLE" ]]; then
  echo "Usage : bash deploy/mirror-to-vps.sh utilisateur@adresse-du-vps" >&2
  exit 1
fi
if [[ ! -f "$DB_LOCALE" ]]; then
  echo "Base introuvable : $DB_LOCALE" >&2
  exit 1
fi

TEMP="$(mktemp -t villano-mirror-XXXXXX.sqlite)"
trap 'rm -f "$TEMP"' EXIT

# « .backup » plutôt qu'une copie de fichier : la base reste cohérente même si
# une commande est encaissée pendant l'opération.
sqlite3 "$DB_LOCALE" ".backup '$TEMP'"

TAILLE=$(stat -c %s "$TEMP" 2>/dev/null || stat -f %z "$TEMP")
if [[ "$TAILLE" -lt 4096 ]]; then
  echo "La copie fait $TAILLE octets : trop petite pour être une vraie base. Envoi annulé." >&2
  exit 1
fi

# Déposée à côté, puis mise en place d'un seul geste : le serveur distant ne
# voit jamais un fichier à moitié transféré.
scp -q "$TEMP" "$CIBLE:$DB_DISTANTE.nouvelle"
ssh "$CIBLE" "mv '$DB_DISTANTE.nouvelle' '$DB_DISTANTE' && sudo systemctl restart villano"

echo "Base envoyée ($(( TAILLE / 1024 )) Ko) et serveur de consultation redémarré."
