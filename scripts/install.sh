#!/usr/bin/env bash
# Первая установка на чистый сервер: одна команда после `git clone`.
#
#   git clone git@github.com:<owner>/rassrochka.git /opt/nasiya
#   cd /opt/nasiya
#   ./nasiya install
#
# Ставит Docker (если его нет), поднимает своп, включает firewall, заводит
# .env, собирает и запускает контейнеры, накатывает миграции и создаёт
# ЕДИНСТВЕННУЮ компанию этого сервера. Компания и её база — только здесь;
# у других клиентов свои отдельные серверы и базы друг друга не видят.
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

# ── Параметры (флаг или интерактивный вопрос) ───────────────────────────

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

DOMAIN="${DOMAIN:-$(ask "Базовый домен (например nasiya.ru)")}"
SLUG="${SLUG:-$(ask "Поддомен этой компании (например acme — получится acme.$DOMAIN)")}"
COMPANY_NAME="${COMPANY_NAME:-$(ask "Название компании")}"
ADMIN_NAME="${ADMIN_NAME:-$(ask "Имя администратора" "Администратор")}"
ADMIN_EMAIL="${ADMIN_EMAIL:-$(ask "Почта администратора (логин в CRM)")}"
ACME_EMAIL="${ACME_EMAIL:-$(ask "Почта для Let's Encrypt (уведомления о сертификате)" "$ADMIN_EMAIL")}"

if ! [[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  die "Поддомен «$SLUG»: только строчные латинские буквы, цифры и дефис (не по краям)"
fi
if ! [[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  die "Некорректная почта администратора: «$ADMIN_EMAIL»"
fi

echo
echo "Проверьте перед стартом:"
echo "  Адрес компании   $SLUG.$DOMAIN"
echo "  Название         $COMPANY_NAME"
echo "  Администратор    $ADMIN_NAME <$ADMIN_EMAIL>"
echo "  DNS: A-запись $SLUG.$DOMAIN → IP этого сервера должна быть добавлена ЗАРАНЕЕ"
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

if command -v ufw >/dev/null 2>&1; then
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

# Служебное — читают только scripts/*.sh, само приложение эти ключи не видит
COMPANY_SLUG=$SLUG
COMPANY_NAME=$COMPANY_NAME
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_NAME=$ADMIN_NAME
EOF
chmod 600 "$ENV_FILE"

# ── Контейнеры ────────────────────────────────────────────────────────

echo "→ Собираю образ (может занять несколько минут)"
compose build app

echo "→ Запускаю контейнеры"
compose up -d

wait_for_container

echo "→ Накатываю миграции"
compose exec -T app node scripts/migrate-all.mjs

wait_for_health "$DOMAIN"

echo "→ Завожу компанию «$COMPANY_NAME»"
CREATE_OUT="$(compose exec -T app node scripts/create-tenant.mjs \
  --slug "$SLUG" --name "$COMPANY_NAME" \
  --admin-email "$ADMIN_EMAIL" --admin-name "$ADMIN_NAME")"
echo "$CREATE_OUT"

echo
c_green "Готово."
echo "───────────────────────────────────────────────"
echo "  Адрес       https://$SLUG.$DOMAIN"
echo "  Логин       $ADMIN_EMAIL"
echo "───────────────────────────────────────────────"
echo
echo "Дальше:"
echo "  ./nasiya backup-setup    — резервные копии в облако (обязательно)"
echo "  ./nasiya restore latest  — перенести данные со старого сервера"
echo "  ./nasiya status          — проверить состояние"
echo "  ./nasiya settings        — сменить домен, почту или пароль"
echo "  ./nasiya update          — обновить код из git"
