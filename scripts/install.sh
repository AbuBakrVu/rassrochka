#!/usr/bin/env bash
# Первая установка: одна команда после `git clone`.
#
#   git clone git@github.com:<owner>/rassrochka.git /opt/nasiya
#   cd /opt/nasiya
#   ./nasiya install
#
# Спрашивает три вещи — домен CRM, логин и пароль администратора, — всё
# остальное определяет сама. Ставит Docker (если его нет), заводит .env,
# собирает и запускает контейнеры, накатывает миграции и создаёт
# ЕДИНСТВЕННУЮ компанию этой установки.
#
# Как Nasiya выходит в интернет, выбирается по серверу (MODE= — вручную):
#   shared     — порты 80/443 свободны или их держит общий прокси /opt/proxy:
#                Nasiya публикуется в нём (прокси ставится, если его нет);
#                рядом можно ставить другие сервисы (DEPLOY.md §2а).
#   docker     — 80/443 держит прокси в контейнере (Traefik, Nginx Proxy
#                Manager, nginx-proxy, свой nginx у других CRM): Nasiya
#                входит в его Docker-сеть; Traefik и nginx-proxy подхватывают
#                её сами, для остальных печатается, что добавить.
#   port       — 80/443 занял веб-сервер прямо на сервере (nginx):
#                приложение слушает 127.0.0.1:<порт>, nginx настраивается
#                сам (с сертификатом certbot), для остальных — готовый конфиг.
#   standalone — сервер только под Nasiya, свой Caddy (прежний вариант).
#
# Без вопросов (например, из скрипта):
#   CRM_DOMAIN=crm.example.ru ADMIN_EMAIL=a@example.ru ADMIN_PASSWORD=… CONFIRM=Y ./nasiya install
# Необязательно: COMPANY_NAME, ADMIN_NAME, ACME_EMAIL, TZ_NAME, MODE, APP_PORT.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_root

if [ -f "$ENV_FILE" ]; then
  c_red "Похоже, установка уже выполнена — .env существует."
  echo "Хотите обновить код? ./nasiya update"
  echo "Хотите поменять настройки? ./nasiya settings"
  exit 1
fi

echo "Установка Nasiya CRM"
echo "───────────────────────────────────────────────"

# ── Вопросы ─────────────────────────────────────────────────────────────

# `read` возвращает ненулевой код на EOF (нет терминала — например, при
# запуске одной командой через `ssh host './nasiya install'` без -t). Под
# `set -e` это молча убивало бы скрипт прямо на первом вопросе — поэтому
# `|| true` и явная проверка результата вместо бесконечного while.
ask() {
  local prompt="$1" default="${2:-}" var
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " var || true
    echo "${var:-$default}"
  else
    read -r -p "$prompt: " var || true
    if [ -z "${var:-}" ]; then
      die "Нужно значение «$prompt» — задайте переменной окружения или запустите в интерактивном терминале (ssh -t)"
    fi
    echo "$var"
  fi
}

# Пароль — без эха и дважды. Никуда не записывается: уходит в базу хешем
ask_password() {
  local p1 p2
  while true; do
    read -r -s -p "Пароль администратора (не короче 8 символов): " p1 || die "Нужен пароль — запустите в интерактивном терминале (ssh -t) или задайте ADMIN_PASSWORD"
    echo >&2
    if [ "${#p1}" -lt 8 ]; then c_red "  слишком короткий" >&2; continue; fi
    read -r -s -p "Повторите пароль: " p2 || true
    echo >&2
    [ "$p1" = "$p2" ] && break
    c_red "  пароли не совпали, ещё раз" >&2
  done
  printf '%s' "$p1"
}

# Домен: полный адрес CRM. Прежние DOMAIN + SLUG тоже понимаем
if [ -z "${CRM_DOMAIN:-}" ] && [ -n "${DOMAIN:-}" ] && [ -n "${SLUG:-}" ]; then
  CRM_DOMAIN="$SLUG.$DOMAIN"
fi
CRM_DOMAIN="$(echo "${CRM_DOMAIN:-$(ask "Домен CRM (например crm.mycompany.ru)")}" | tr 'A-Z' 'a-z' | sed 's#^https\{0,1\}://##; s#/.*$##')"
if ! [[ "$CRM_DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  die "Домен «$CRM_DOMAIN» не похож на адрес сайта — пример: crm.mycompany.ru"
fi
# Компания определяется по первой части адреса, поэтому нужен поддомен
if [ "$(echo "$CRM_DOMAIN" | tr -cd '.' | wc -c)" -lt 2 ]; then
  die "Нужен поддомен, а не сам домен: например crm.${CRM_DOMAIN} (A-запись поддомена — на IP этого сервера)"
fi
SLUG="${CRM_DOMAIN%%.*}"
DOMAIN="${CRM_DOMAIN#*.}"

ADMIN_EMAIL="${ADMIN_EMAIL:-$(ask "Логин администратора (e-mail)")}"
if ! [[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  die "Логин — это e-mail, а «$ADMIN_EMAIL» на него не похож"
fi
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  ADMIN_PASSWORD="$(ask_password)"
fi
[ "${#ADMIN_PASSWORD}" -ge 8 ] || die "Пароль администратора — не короче 8 символов"

COMPANY_NAME="${COMPANY_NAME:-$CRM_DOMAIN}"
ADMIN_NAME="${ADMIN_NAME:-Администратор}"
ACME_EMAIL="${ACME_EMAIL:-$ADMIN_EMAIL}"
TZ_NAME="${TZ_NAME:-Europe/Moscow}"
if [ -d /usr/share/zoneinfo ] && [ ! -f "/usr/share/zoneinfo/$TZ_NAME" ]; then
  die "Часовой пояс «$TZ_NAME» не найден — пример: Europe/Moscow"
fi

# ── Как выходить в интернет ─────────────────────────────────────────────

# Кто слушает порт (имя процесса из ss) — пусто, если порт свободен
port_owner() {
  ss -ltnpH "( sport = :$1 )" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -1
}
port_busy() { [ -n "$(ss -ltnH "( sport = :$1 )" 2>/dev/null)" ]; }

WEB_OWNER=""
if [ -z "${MODE:-}" ]; then
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx proxy-caddy; then
    MODE=shared
  elif detect_docker_proxy; then
    # Порты контейнера видны в docker ps, даже когда ss их не показывает
    MODE=docker
  elif port_busy 80 || port_busy 443; then
    MODE=port
  else
    MODE=shared
  fi
fi
case "$MODE" in shared|port|docker|standalone) ;; *) die "MODE — shared, port, docker или standalone" ;; esac

if [ "$MODE" = "docker" ]; then
  [ -n "${PROXY_CONTAINER:-}" ] || detect_docker_proxy || die "Не нашёл контейнер, который держит 80/443"
  [ "$PROXY_KIND" = "traefik" ] && traefik_settings
fi

if [ "$MODE" = "port" ]; then
  WEB_OWNER="$(port_owner 443)"
  [ -n "$WEB_OWNER" ] || WEB_OWNER="$(port_owner 80)"
  if [ -z "${APP_PORT:-}" ]; then
    for p in $(seq 3100 3199); do
      if ! port_busy "$p"; then APP_PORT="$p"; break; fi
    done
  fi
  [ -n "${APP_PORT:-}" ] || die "Не нашёл свободный порт 3100–3199 — задайте APP_PORT=…"
  ! port_busy "$APP_PORT" || die "Порт $APP_PORT занят — задайте другой: APP_PORT=…"
fi
PROXY_ALIAS="nasiya-$SLUG"

echo
echo "Проверьте перед стартом:"
echo "  Адрес CRM        https://$CRM_DOMAIN"
echo "  Логин            $ADMIN_EMAIL"
echo "  Пароль           заданный вами (в файлы не записывается)"
case "$MODE" in
  shared)     echo "  Вход из сети     общий прокси $PROXY_DIR — рядом можно ставить другие сервисы" ;;
  port)       echo "  Вход из сети     через ваш веб-сервер (${WEB_OWNER:-занимает 80/443}) → 127.0.0.1:$APP_PORT" ;;
  docker)     echo "  Вход из сети     через ваш прокси-контейнер «$PROXY_CONTAINER» ($PROXY_IMAGE), сеть ${PROXY_NETWORK:-будет создана}" ;;
  standalone) echo "  Вход из сети     свой Caddy, сервер только под Nasiya" ;;
esac
echo "  DNS: A-запись $CRM_DOMAIN → IP этого сервера должна быть добавлена ЗАРАНЕЕ"
if [ -z "${CONFIRM:-}" ]; then
  read -r -p "Продолжить? [Y/n]: " CONFIRM || true
fi
if [ "${CONFIRM:-Y}" = "n" ] || [ "${CONFIRM:-Y}" = "N" ]; then
  echo "Отменено"
  exit 0
fi

# ── Системные зависимости ────────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Устанавливаю Docker…"
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 8000 ]; then
  echo "→ Включаю своп (2 ГБ) — сборка рядом с Postgres на маленьком сервере рискует упереться в OOM"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Firewall включаем только на сервере под одну Nasiya: на общем включение
# ufw закрыло бы порты, которые нужны соседям
if [ "$MODE" != "standalone" ]; then
  c_dim "→ Firewall не трогаю (на сервере и другие сервисы)"
elif command -v ufw >/dev/null 2>&1; then
  echo "→ Настраиваю firewall (22, 80, 443)"
  ufw allow OpenSSH >/dev/null
  ufw allow 80,443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

# Защита от перебора паролей SSH и автоматические обновления безопасности.
# Раньше это настраивалось руками и пропало при переустановке сервера.
if command -v apt-get >/dev/null 2>&1; then
  echo "→ Ставлю fail2ban и автообновления безопасности"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban unattended-upgrades >/dev/null
  mkdir -p /etc/fail2ban/jail.d
  if [ ! -f /etc/fail2ban/jail.d/nasiya.local ]; then
    cat > /etc/fail2ban/jail.d/nasiya.local <<'JAIL'
# 5 неудачных входов по SSH за 10 минут — бан на час, повторный — дольше (до недели)
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
bantime.increment = true
bantime.maxtime = 1w
JAIL
  fi
  systemctl enable fail2ban >/dev/null 2>&1 || true
  systemctl restart fail2ban >/dev/null 2>&1 || true
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
fi

# ── .env ──────────────────────────────────────────────────────────────

echo "→ Пишу .env"
# hex, не base64: base64 может выдать /, + или = — эти символы ломают разбор
# postgres://user:PASSWORD@db:5432, если попадают в пароль как есть
PG_PASSWORD="$(openssl rand -hex 24)"
cat > "$ENV_FILE" <<EOF
APP_DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
PG_PASSWORD=$PG_PASSWORD
TZ=$TZ_NAME

# Служебное — читают только scripts/*.sh, само приложение эти ключи не видит
DEPLOY_MODE=$MODE
PROXY_ALIAS=$PROXY_ALIAS
APP_PORT=${APP_PORT:-}
COMPANY_SLUG=$SLUG
COMPANY_NAME=$COMPANY_NAME
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_NAME=$ADMIN_NAME
EOF
chmod 600 "$ENV_FILE"

# Чтобы и ручной `docker compose …` в этой папке видел режим установки
case "$MODE" in
  shared) echo "COMPOSE_FILE=docker-compose.yml:docker-compose.shared.yml" >> "$ENV_FILE" ;;
  port)   echo "COMPOSE_FILE=docker-compose.yml:docker-compose.port.yml" >> "$ENV_FILE" ;;
  docker) echo "COMPOSE_FILE=docker-compose.yml:docker-compose.local.yml" >> "$ENV_FILE" ;;
esac

if [ "$MODE" = "docker" ]; then
  # Прокси только в сети по умолчанию — заводим общую сеть и подключаем его.
  # Подключение живёт до пересоздания его контейнера — поэтому подсказка ниже
  if [ -z "$PROXY_NETWORK" ]; then
    PROXY_NETWORK="web"
    docker network inspect web >/dev/null 2>&1 || docker network create web >/dev/null
    docker network connect web "$PROXY_CONTAINER" 2>/dev/null || true
    PROXY_NET_ADDED=1
  fi
  write_docker_override "$CRM_DOMAIN" "$PROXY_ALIAS" "$PROXY_NETWORK" "$PROXY_KIND"
fi

if [ "$MODE" = "shared" ] && ! docker ps --format '{{.Names}}' | grep -qx proxy-caddy; then
  echo "→ Ставлю общий прокси в $PROXY_DIR"
  ACME_EMAIL="$ACME_EMAIL" bash scripts/proxy-setup.sh
fi

# ── Контейнеры ────────────────────────────────────────────────────────

echo "→ Собираю образ (может занять несколько минут)"
compose build app

echo "→ Запускаю контейнеры"
compose up -d

wait_for_container

echo "→ Накатываю миграции"
compose exec -T app node scripts/migrate-all.mjs

wait_for_health "$DOMAIN"

echo "→ Завожу компанию и администратора"
# Пароль — через stdin, а не аргументом: так его не видно в списке процессов
printf '%s' "$ADMIN_PASSWORD" | compose exec -T app node scripts/create-tenant.mjs \
  --slug "$SLUG" --name "$COMPANY_NAME" \
  --admin-email "$ADMIN_EMAIL" --admin-name "$ADMIN_NAME" --password-stdin
unset ADMIN_PASSWORD

# ── Публикация в интернет ─────────────────────────────────────────────

case "$MODE" in
  shared)
    echo "→ Публикую $CRM_DOMAIN в общем прокси"
    write_proxy_site "$CRM_DOMAIN" "$PROXY_ALIAS"
    ;;
  port)
    publish_behind_web_server "$CRM_DOMAIN" "$APP_PORT" "$WEB_OWNER" "$ACME_EMAIL"
    ;;
  docker)
    echo "→ Публикация через $PROXY_CONTAINER"
    docker_proxy_instructions "$CRM_DOMAIN" "$PROXY_ALIAS" "$PROXY_KIND"
    if [ -n "${PROXY_NET_ADDED:-}" ]; then
      c_red "  Прокси «$PROXY_CONTAINER» подключён к сети web вручную — после его пересоздания связь пропадёт."
      echo "  Добавьте в его docker-compose.yml сеть web (external: true), чтобы это сохранилось."
    fi
    ;;
esac

echo
c_green "Готово."
echo "───────────────────────────────────────────────"
echo "  Адрес       https://$CRM_DOMAIN"
echo "  Логин       $ADMIN_EMAIL"
echo "  Пароль      тот, что вы ввели"
echo "───────────────────────────────────────────────"
echo
echo "Дальше:"
echo "  ./nasiya backup-setup    — резервные копии в облако (обязательно)"
echo "  ./nasiya restore latest  — перенести данные со старого сервера"
echo "  ./nasiya status          — проверить состояние"
echo "  ./nasiya settings        — сменить домен, почту или пароль"
echo "  ./nasiya update          — обновить код из git"
