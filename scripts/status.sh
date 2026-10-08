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
case "$(env_get DEPLOY_MODE)" in
  shared) echo "Вход:     общий прокси $PROXY_DIR" ;;
  port)   echo "Вход:     ваш веб-сервер → 127.0.0.1:$(env_get APP_PORT)" ;;
  docker) echo "Вход:     ваш прокси-контейнер (сеть из docker-compose.local.yml)" ;;
esac
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
  if [ "$(env_get DEPLOY_MODE)" = "shared" ]; then
    c_red "код $CODE — проверьте DNS, $PROXY_DIR/proxy list и $PROXY_DIR/proxy logs"
  elif [ "$(env_get DEPLOY_MODE)" = "port" ]; then
    c_red "код $CODE — проверьте DNS и настройки вашего веб-сервера (nginx -t, certbot certificates)"
  else
    c_red "код $CODE — проверьте DNS и docker compose logs caddy"
  fi
fi

echo -n "Резервные копии:       "
if [ -f /etc/cron.d/nasiya-backup ] && [ -n "$(env_get RCLONE_REMOTE)" ]; then
  LAST="$(ls -t backups/*.dump* 2>/dev/null | grep -v before-restore | head -1 || true)"
  c_green "настроены → $(env_get RCLONE_REMOTE)${LAST:+, последняя $(basename "$LAST")}"
else
  c_red "НЕ НАСТРОЕНЫ — запустите ./nasiya backup-setup"
fi

echo
df -h / | awk 'NR==1 || NR==2'
