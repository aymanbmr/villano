#!/usr/bin/env bash
# Met à jour Villano sur le VPS : récupère le code, recompile, redémarre.
#
#   sudo bash /opt/villano/deploy/vps-update.sh
#
# Une sauvegarde est prise avant toute chose : si la mise à jour se passe mal,
# la base de la veille est encore là.
set -euo pipefail

APP_DIR="/opt/villano"
SERVICE_USER="villano"

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé avec sudo." >&2
  exit 1
fi

echo "==> Sauvegarde avant mise a jour"
/usr/local/bin/villano-backup

echo "==> Recuperation du code"
git -C "$APP_DIR" pull --ff-only

echo "==> Compilation"
cd "$APP_DIR"
npm run install:all --silent
npm run build --silent
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "==> Redemarrage"
systemctl restart villano
sleep 2
systemctl --no-pager --lines=5 status villano || true

echo
echo "Mise a jour terminee."
