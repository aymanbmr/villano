#!/usr/bin/env bash
# Installation de Villano sur un VPS Ubuntu 22.04 / 24.04, en une fois.
#
#   sudo bash deploy/vps-install.sh villano.exemple.ma
#
# Le script installe Node.js et Caddy, crée l'utilisateur de service, compile
# l'application, écrit backend/.env avec des secrets tirés au hasard, puis
# démarre le tout derrière HTTPS. Il peut être relancé sans dommage.
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/villano"
SERVICE_USER="villano"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage : sudo bash deploy/vps-install.sh <domaine>" >&2
  echo "Exemple : sudo bash deploy/vps-install.sh villano.exemple.ma" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé avec sudo." >&2
  exit 1
fi

echo "==> Paquets de base"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git sqlite3 ufw build-essential python3

echo "==> Node.js 22 LTS"
NODE_MAJOR="$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)"
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "    $(node -v)"

echo "==> Caddy (HTTPS automatique)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

echo "==> Utilisateur de service"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"

echo "==> Code source dans $APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone https://github.com/aymanbmr/villano.git "$APP_DIR"
fi

echo "==> Configuration"
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  cat > "$ENV_FILE" <<EOF
# Genere a l'installation le $(date +%F)
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=14h

PORT=3000
# Derriere Caddy : le port n'est pas expose directement sur internet
HOST=127.0.0.1

STOCK_ENABLED=false
EOF
  chmod 600 "$ENV_FILE"
  echo "    backend/.env cree"
  echo "    MOT DE PASSE ADMIN : $ADMIN_PASSWORD   <-- notez-le maintenant"
else
  echo "    backend/.env deja present, laisse tel quel"
fi

echo "==> Compilation (quelques minutes)"
cd "$APP_DIR"
npm run install:all --silent
npm run build --silent

chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "==> Service systemd"
install -m 644 "$APP_DIR/deploy/villano.service" /etc/systemd/system/villano.service
systemctl daemon-reload
systemctl enable --now villano
systemctl restart villano

echo "==> Caddy sur $DOMAIN"
sed "s/villano\.exemple\.ma/$DOMAIN/" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl reload caddy || systemctl restart caddy

echo "==> Pare-feu"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> Sauvegarde quotidienne a 3h"
install -m 755 "$APP_DIR/deploy/vps-backup.sh" /usr/local/bin/villano-backup
cat > /etc/cron.d/villano-backup <<'EOF'
0 3 * * * root /usr/local/bin/villano-backup >/dev/null 2>&1
EOF

echo
echo "Termine. L'application repond sur https://$DOMAIN"
echo "Etat du service : systemctl status villano"
echo "Journaux        : journalctl -u villano -f"
