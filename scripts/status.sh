#!/usr/bin/env bash
# Быстрая проверка состояния сервера.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_env

DOMAIN="$(env_get APP_DOMAIN)"
SLUG="$(env_get COMPANY_SLUG)"

echo "Компания: $(env_get COMPANY_NAME)"
echo "Адрес:    https://$SLUG.$DOMAIN"
echo

compose ps
echo

echo -n "Здоровье приложения:   "
if compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
  c_green "OK"
else
  c_red "НЕ ОТВЕЧАЕТ"
fi

echo -n "Сайт снаружи:          "
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$SLUG.$DOMAIN/api/health" || echo "000")"
if [ "$CODE" = "200" ]; then
  c_green "OK ($CODE)"
else
  c_red "код $CODE — проверьте DNS и docker compose logs caddy"
fi

echo
df -h / | awk 'NR==1 || NR==2'
