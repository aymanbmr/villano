#!/usr/bin/env bash
# Sauvegarde quotidienne de la base et des images, gardées 30 jours.
#
# La base est copiée avec « sqlite3 .backup » plutôt qu'avec cp : la copie est
# cohérente même si une commande est encaissée pendant la sauvegarde.
set -euo pipefail

APP_DIR="/opt/villano/backend"
BACKUP_DIR="/var/backups/villano"
STAMP="$(date +%F-%H%M)"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

sqlite3 "$APP_DIR/villano.sqlite" ".backup '$BACKUP_DIR/villano-$STAMP.sqlite'"
gzip -f "$BACKUP_DIR/villano-$STAMP.sqlite"

if [[ -d "$APP_DIR/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads
fi

find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete

echo "Sauvegarde : $BACKUP_DIR/villano-$STAMP.sqlite.gz"
