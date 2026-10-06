#!/usr/bin/env bash
# Общий прокси для сервера, на котором живёт несколько веб-сервисов.
#
#   ./nasiya proxy-setup
#
# Ставит Docker (если его нет), кладёт proxy/ из репозитория в /opt/proxy и
# запускает Caddy на портах 80/443 с общей Docker-сетью «web». Повторный
# запуск обновляет файлы прокси, не трогая опубликованные сайты
# (/opt/proxy/sites) и почту для сертификатов (/opt/proxy/.env).
#
# Дальше любой сервис публикуется командой /opt/proxy/proxy add.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_root

PROXY_DIR="${PROXY_DIR:-/opt/proxy}"

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Устанавливаю Docker…"
  curl -fsSL https://get.docker.com | sh
fi

# Порты 80/443 должен держать только общий прокси
if ! docker ps --format '{{.Names}}' | grep -qx proxy-caddy; then
  BUSY="$(ss -ltnH '( sport = :80 or sport = :443 )' 2>/dev/null || true)"
  [ -z "$BUSY" ] || die "Порты 80/443 уже заняты другой программой — остановите её (ss -ltnp | grep -E ':80|:443')"
fi

mkdir -p "$PROXY_DIR/sites"
cp proxy/docker-compose.yml proxy/Caddyfile proxy/proxy "$PROXY_DIR/"
chmod +x "$PROXY_DIR/proxy"

if [ ! -f "$PROXY_DIR/.env" ]; then
  EMAIL="${ACME_EMAIL:-}"
  if [ -z "$EMAIL" ]; then
    read -r -p "Почта для Let's Encrypt (уведомления о сертификатах): " EMAIL || true
  fi
  [ -n "$EMAIL" ] || die "Нужна почта для Let's Encrypt — ACME_EMAIL=... ./nasiya proxy-setup"
  printf 'ACME_EMAIL=%s\n' "$EMAIL" > "$PROXY_DIR/.env"
  chmod 600 "$PROXY_DIR/.env"
fi

"$PROXY_DIR/proxy" up
c_dim "  Опубликовать сервис: $PROXY_DIR/proxy add <домен> <контейнер:порт>"
