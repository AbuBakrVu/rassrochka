#!/usr/bin/env bash
# Изменение настроек уже установленного сервера.
#
#   ./nasiya settings            — меню
#   ./nasiya settings domain     — сменить поддомен или базовый домен
#   ./nasiya settings email      — сменить почту для Let's Encrypt
#   ./nasiya settings password <почта>  — сбросить пароль сотрудника
#   ./nasiya settings show       — показать текущие настройки
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_env
require_root

cmd_show() {
  echo "Текущие настройки"
  echo "───────────────────────────────────────────────"
  echo "  Базовый домен      $(env_get APP_DOMAIN)"
  echo "  Поддомен компании  $(env_get COMPANY_SLUG)"
  echo "  Адрес входа        https://$(env_get COMPANY_SLUG).$(env_get APP_DOMAIN)"
  echo "  Название компании  $(env_get COMPANY_NAME)"
  echo "  Почта Let's Encrypt $(env_get ACME_EMAIL)"
  echo "  Часовой пояс       $(env_get TZ || true)"
  echo "───────────────────────────────────────────────"
}

cmd_domain() {
  local current_domain current_slug new_domain new_slug
  current_domain="$(env_get APP_DOMAIN)"
  current_slug="$(env_get COMPANY_SLUG)"

  echo "Сейчас: https://$current_slug.$current_domain"
  read -r -p "Новый базовый домен [$current_domain]: " new_domain
  new_domain="${new_domain:-$current_domain}"
  read -r -p "Новый поддомен компании [$current_slug]: " new_slug
  new_slug="${new_slug:-$current_slug}"

  if [ "$new_domain" = "$current_domain" ] && [ "$new_slug" = "$current_slug" ]; then
    echo "Без изменений"
    return 0
  fi

  echo
  echo "Новый адрес входа: https://$new_slug.$new_domain"
  echo "ВАЖНО: A-запись $new_slug.$new_domain → IP этого сервера должна уже существовать в DNS,"
  echo "       иначе Let's Encrypt не выпустит сертификат и сайт не откроется."
  read -r -p "Продолжить? [y/N]: " CONFIRM
  [ "${CONFIRM:-N}" = "y" ] || [ "${CONFIRM:-N}" = "Y" ] || { echo "Отменено"; return 0; }

  if [ "$new_slug" != "$current_slug" ]; then
    compose exec -T app node scripts/rename-tenant.mjs --slug "$current_slug" --new-slug "$new_slug"
  fi

  if [ "$new_domain" != "$current_domain" ]; then
    env_set APP_DOMAIN "$new_domain"
  fi
  env_set COMPANY_SLUG "$new_slug"

  echo "→ Перезапускаю с новыми настройками"
  compose up -d
  wait_for_health "$new_domain"
  case "$(env_get DEPLOY_MODE)" in
    shared)
      rm -f "$PROXY_DIR/sites/$current_slug.$current_domain.caddy"
      write_proxy_site "$new_slug.$new_domain" "$(env_get PROXY_ALIAS)"
      ;;
    docker)
      sed -i.bak "s/$current_slug\.$current_domain/$new_slug.$new_domain/g" "$REPO_DIR/docker-compose.local.yml" && rm -f "$REPO_DIR/docker-compose.local.yml.bak"
      compose up -d app
      c_red "Если прокси настраивается вручную (Nginx Proxy Manager и т.п.) — поменяйте там домен на $new_slug.$new_domain"
      ;;
    port)
      c_red "Обновите адрес в вашем веб-сервере: $new_slug.$new_domain → 127.0.0.1:$(env_get APP_PORT)"
      [ -f "/etc/nginx/sites-available/nasiya-$current_slug.$current_domain.conf" ] && \
        echo "  nginx: /etc/nginx/sites-available/nasiya-$current_slug.$current_domain.conf, затем certbot --nginx -d $new_slug.$new_domain"
      ;;
  esac

  c_green "Готово: https://$new_slug.$new_domain"
}

cmd_email() {
  local current new
  if [ "$(env_get DEPLOY_MODE)" = "port" ]; then
    echo "Сертификаты выпускает ваш веб-сервер (certbot) — почта настраивается там"
    return 0
  fi
  if [ "$(env_get DEPLOY_MODE)" = "shared" ]; then
    echo "Сертификаты выпускает общий прокси — почта в $PROXY_DIR/.env, затем: cd $PROXY_DIR && docker compose up -d"
    return 0
  fi
  current="$(env_get ACME_EMAIL)"
  read -r -p "Новая почта для Let's Encrypt [$current]: " new
  new="${new:-$current}"
  [ "$new" = "$current" ] && { echo "Без изменений"; return 0; }

  env_set ACME_EMAIL "$new"
  echo "→ Перезапускаю caddy"
  compose up -d caddy
  c_green "Готово"
}

cmd_timezone() {
  local current new
  current="$(env_get TZ)"
  current="${current:-Europe/Moscow}"
  read -r -p "Часовой пояс компании [$current]: " new
  new="${new:-$current}"
  [ "$new" = "$current" ] && { echo "Без изменений"; return 0; }
  [ -f "/usr/share/zoneinfo/$new" ] || die "Часовой пояс «$new» не найден — пример: Asia/Yekaterinburg"

  env_set TZ "$new"
  echo "→ Перезапускаю приложение и базу"
  compose up -d app db
  wait_for_health "$(env_get APP_DOMAIN)"
  c_green "Готово: «сегодня» теперь считается по $new"
}

cmd_password() {
  local email="${1:-}"
  [ -z "$email" ] && read -r -p "Почта сотрудника: " email
  compose exec -T app node scripts/reset-password.mjs --slug "$(env_get COMPANY_SLUG)" --email "$email"
}

case "${1:-}" in
  domain)   cmd_domain ;;
  email)    cmd_email ;;
  timezone) cmd_timezone ;;
  password) cmd_password "${2:-}" ;;
  show)     cmd_show ;;
  "")
    cmd_show
    echo
    echo "Что изменить?"
    select choice in "Домен" "Почта Let's Encrypt" "Часовой пояс" "Пароль сотрудника" "Выход"; do
      case "$choice" in
        "Домен") cmd_domain; break ;;
        "Почта Let's Encrypt") cmd_email; break ;;
        "Часовой пояс") cmd_timezone; break ;;
        "Пароль сотрудника") cmd_password; break ;;
        *) exit 0 ;;
      esac
    done
    ;;
  *)
    die "Неизвестная команда «$1». Доступно: domain, email, timezone, password, show"
    ;;
esac
