#!/usr/bin/env bash
# Настройка резервных копий одной командой: шифрование, хранилище, расписание.
#
#   ./nasiya backup-setup
#
# Что делает:
#   1. ставит age (шифрование) и rclone (отправка в хранилище);
#   2. создаёт ключ шифрования — его ОБЯЗАТЕЛЬНО сохранить вне сервера;
#   3. подключает S3-хранилище (Yandex Object Storage, Selectel или любое
#      S3-совместимое) и проверяет, что туда можно писать;
#   4. ставит ежедневную копию в 03:17 и сразу делает первую.
#
# Без копии вне сервера данные компании живут только на одном диске:
# переустановка VPS или авария — и их нет (так уже было).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_env
require_root

KEY_DIR=/root/.config/nasiya
KEY_FILE="$KEY_DIR/backup.key"
REMOTE_NAME=nasiya-backup
SLUG="$(env_get COMPANY_SLUG)"

ask() {
  local prompt="$1" default="${2:-}" var
  read -r -p "$prompt${default:+ [$default]}: " var || true
  var="${var:-$default}"
  [ -n "$var" ] || die "Нужно значение «$prompt»"
  echo "$var"
}

echo "Резервные копии Nasiya"
echo "───────────────────────────────────────────────"

# ── 1. Программы ─────────────────────────────────────────────────────────
if ! command -v age >/dev/null 2>&1 || ! command -v rclone >/dev/null 2>&1; then
  echo "→ Ставлю age и rclone"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq age rclone >/dev/null
fi

# ── 2. Ключ шифрования ──────────────────────────────────────────────────
mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"
if [ ! -f "$KEY_FILE" ]; then
  # При переезде ключ нужен прежний — иначе старые копии будет нечем
  # расшифровать, а новые и старые окажутся под разными ключами
  read -r -p "Есть ключ шифрования со старого сервера? [y/N]: " HAS_KEY || true
  if [ "$HAS_KEY" = "y" ] || [ "$HAS_KEY" = "Y" ] || [ "$HAS_KEY" = "д" ]; then
    read -r -s -p "Вставьте строку AGE-SECRET-KEY-…: " SECRET_LINE || true
    echo
    case "$SECRET_LINE" in
      AGE-SECRET-KEY-1*) ;;
      *) die "Это не ключ age — строка должна начинаться с AGE-SECRET-KEY-1" ;;
    esac
    printf '%s\n' "$SECRET_LINE" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    age-keygen -y "$KEY_FILE" >/dev/null 2>&1 || { rm -f "$KEY_FILE"; die "Ключ не подошёл — проверьте, что скопирован целиком"; }
    NEW_KEY=0
  else
    echo "→ Создаю ключ шифрования"
    age-keygen -o "$KEY_FILE" 2>/dev/null
    chmod 600 "$KEY_FILE"
    NEW_KEY=1
  fi
else
  c_dim "  ключ уже есть: $KEY_FILE"
  NEW_KEY=0
fi
RECIPIENT="$(age-keygen -y "$KEY_FILE")"

if [ "$NEW_KEY" = "1" ]; then
  echo
  c_red "ВАЖНО: сохраните ключ ниже в менеджер паролей (целиком, 3 строки)."
  echo "Без него резервные копии не расшифровать — если сервер пропадёт"
  echo "вместе с ключом, копии превратятся в бесполезный мусор."
  echo "───────────────────────────────────────────────"
  cat "$KEY_FILE"
  echo "───────────────────────────────────────────────"
  read -r -p "Сохранили ключ? Введите «да»: " SAVED || true
  [ "$SAVED" = "да" ] || die "Сначала сохраните ключ, затем запустите команду снова (ключ останется тем же)"
fi

# ── 3. Хранилище ────────────────────────────────────────────────────────
if rclone listremotes 2>/dev/null | grep -qx "$REMOTE_NAME:" && [ -n "$(env_get RCLONE_REMOTE)" ]; then
  c_dim "  хранилище уже подключено: $(env_get RCLONE_REMOTE)"
  REMOTE="$(env_get RCLONE_REMOTE)"
else
  echo
  echo "Куда отправлять копии? Нужен бакет в S3-совместимом хранилище"
  echo "и ключ доступа к нему (сервисный аккаунт с правом на запись)."
  echo "  1) Yandex Object Storage"
  echo "  2) Selectel"
  echo "  3) Другое S3-совместимое (VK Cloud, Timeweb, MinIO…)"
  PROVIDER="$(ask "Номер" 1)"
  case "$PROVIDER" in
    1) ENDPOINT=storage.yandexcloud.net; REGION=ru-central1 ;;
    2) ENDPOINT=s3.ru-1.storage.selcloud.ru; REGION=ru-1 ;;
    *) ENDPOINT="$(ask "Адрес (endpoint), например s3.example.ru")"; REGION="$(ask "Регион" ru-1)" ;;
  esac
  BUCKET="$(ask "Имя бакета")"
  ACCESS_KEY="$(ask "Идентификатор ключа (Access key ID)")"
  read -r -s -p "Секретный ключ (Secret access key): " SECRET_KEY || true
  echo
  [ -n "$SECRET_KEY" ] || die "Нужен секретный ключ"

  rclone config create "$REMOTE_NAME" s3 \
    provider=Other env_auth=false \
    access_key_id="$ACCESS_KEY" secret_access_key="$SECRET_KEY" \
    endpoint="$ENDPOINT" region="$REGION" no_check_bucket=true \
    --non-interactive >/dev/null
  REMOTE="$REMOTE_NAME:$BUCKET/$SLUG"
fi

echo "→ Проверяю запись в хранилище"
PROBE="$(mktemp)"
echo "nasiya $(date -Is)" > "$PROBE"
if ! rclone copyto "$PROBE" "$REMOTE/.probe" >/dev/null 2>&1; then
  rm -f "$PROBE"
  rclone config delete "$REMOTE_NAME" >/dev/null 2>&1 || true
  die "Не удалось записать в $REMOTE — проверьте бакет, ключи и права ключа на запись, затем запустите снова"
fi
rclone deletefile "$REMOTE/.probe" >/dev/null 2>&1 || true
rm -f "$PROBE"
c_green "  ✓ хранилище доступно"

env_set AGE_RECIPIENT "$RECIPIENT"
env_set RCLONE_REMOTE "$REMOTE"
env_set BACKUP_DIR "$REPO_DIR/backups"

# ── 4. Расписание ───────────────────────────────────────────────────────
echo "→ Ставлю ежедневную копию на 03:17"
cat > /etc/cron.d/nasiya-backup <<CRON
# Резервная копия баз Nasiya — создано ./nasiya backup-setup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * root cd $REPO_DIR && ./nasiya backup >> /var/log/nasiya-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/nasiya-backup

echo "→ Делаю первую копию"
./nasiya backup

echo
c_green "Готово: копии шифруются и уходят в $REMOTE каждую ночь."
echo "  Журнал         /var/log/nasiya-backup.log"
echo "  Ключ           $KEY_FILE (копия должна быть у вас в менеджере паролей)"
echo "  Восстановить   ./nasiya restore latest"
echo
echo "Раз в квартал проверяйте восстановление на тестовом сервере — DEPLOY.md §6."
