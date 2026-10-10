#!/usr/bin/env bash
# Sauvegarde quotidienne de la base et des images, gardées 30 jours.
#
# Le moteur est déduit de backend/.env : si DATABASE_URL y figure, la base est
# PostgreSQL et l'on passe par pg_dump ; sinon c'est le fichier SQLite, copié
# avec « sqlite3 .backup » plutôt qu'avec cp, pour rester cohérent même si une
# commande est encaissée pendant l'opération.
set -euo pipefail

APP_DIR="/opt/villano/backend"
BACKUP_DIR="/var/backups/villano"
STAMP="$(date +%F-%H%M)"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

DATABASE_URL=""
if [[ -f "$APP_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  DATABASE_URL="$(grep '^DATABASE_URL=' "$APP_DIR/.env" | cut -d= -f2- || true)"
fi

if [[ -n "$DATABASE_URL" ]]; then
  PGPASSWORD="" pg_dump "$DATABASE_URL" --no-owner --no-privileges \
    | gzip > "$BACKUP_DIR/villano-$STAMP.sql.gz"
  DUMP="$BACKUP_DIR/villano-$STAMP.sql.gz"
elif [[ -f "$APP_DIR/villano.sqlite" ]]; then
  sqlite3 "$APP_DIR/villano.sqlite" ".backup '$BACKUP_DIR/villano-$STAMP.sqlite'"
  gzip -f "$BACKUP_DIR/villano-$STAMP.sqlite"
  DUMP="$BACKUP_DIR/villano-$STAMP.sqlite.gz"
else
  echo "Aucune base trouvee : ni DATABASE_URL dans $APP_DIR/.env, ni $APP_DIR/villano.sqlite" >&2
  exit 1
fi

# Une sauvegarde vide est un piege : mieux vaut echouer bruyamment maintenant
# que le decouvrir le jour ou il faut restaurer.
if [[ ! -s "$DUMP" ]] || [[ "$(stat -c %s "$DUMP")" -lt 200 ]]; then
  echo "La sauvegarde $DUMP est vide ou suspecte." >&2
  exit 1
fi

if [[ -d "$APP_DIR/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads
fi

find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete

echo "Sauvegarde : $DUMP ($(du -h "$DUMP" | cut -f1))"
