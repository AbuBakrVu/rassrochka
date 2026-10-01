#!/usr/bin/env bash
# Восстановление базы компании из резервной копии — например, после
# переустановки сервера или переезда на новый VPS.
#
#   ./nasiya restore                 — список копий в хранилище
#   ./nasiya restore latest          — самая свежая копия этой компании
#   ./nasiya restore <имя-файла>     — конкретная копия из хранилища
#   ./nasiya restore ./путь/к/файлу  — файл, уже лежащий на сервере
#
# Зашифрованные копии (.age) расшифровываются ключом
# /root/.config/nasiya/backup.key — на новом сервере его нужно положить
# туда из менеджера паролей. Перед заменой текущая база сохраняется
# рядом, в backups/before-restore-*.dump.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_env
require_root

KEY_FILE="${AGE_KEY_FILE:-/root/.config/nasiya/backup.key}"
SLUG="$(env_get COMPANY_SLUG)"
DB="nasiya_${SLUG//-/_}"
REMOTE="$(env_get RCLONE_REMOTE)"
WORK="$REPO_DIR/backups/restore"
ARG="${1:-}"

list_remote() {
  [ -n "$REMOTE" ] || die "Хранилище не подключено (нет RCLONE_REMOTE в .env) — запустите ./nasiya backup-setup или укажите путь к файлу"
  rclone lsf "$REMOTE" --include "nasiya_*.dump*" | { grep -v '^nasiya_control-' || true; } | sort
}

if [ -z "$ARG" ]; then
  echo "Копии в $REMOTE:"
  list_remote | sed 's/^/  /'
  echo
  echo "Восстановить: ./nasiya restore latest  или  ./nasiya restore <имя>"
  exit 0
fi

mkdir -p "$WORK"

# ── Где взять файл ──────────────────────────────────────────────────────
if [ -f "$ARG" ]; then
  FILE="$ARG"
else
  if [ "$ARG" = "latest" ]; then
    NAME="$(list_remote | grep "^$DB-" | tail -1 || true)"
    if [ -z "$NAME" ]; then
      echo "Копий базы $DB в хранилище нет. Все копии:"
      list_remote | sed 's/^/  /'
      die "Укажите имя файла явно (например, если на старом сервере был другой поддомен)"
    fi
  else
    NAME="$ARG"
  fi
  echo "→ Скачиваю $NAME"
  rclone copyto "$REMOTE/$NAME" "$WORK/$NAME"
  FILE="$WORK/$NAME"
fi

# ── Расшифровка ─────────────────────────────────────────────────────────
DUMP="$FILE"
if [[ "$FILE" == *.age ]]; then
  [ -f "$KEY_FILE" ] || die "Нет ключа $KEY_FILE — скопируйте его из менеджера паролей (3 строки, права 600)"
  command -v age >/dev/null 2>&1 || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq age >/dev/null
  DUMP="$WORK/$(basename "${FILE%.age}")"
  echo "→ Расшифровываю"
  age -d -i "$KEY_FILE" -o "$DUMP" "$FILE"
fi

# Проверяем, что это действительно дамп, ДО того как трогать базу
compose exec -T db pg_restore --list < "$DUMP" >/dev/null 2>&1 \
  || die "$DUMP — не похоже на резервную копию (pg_dump -Fc)"

echo
c_red "Все данные компании «$(env_get COMPANY_NAME)» на этом сервере будут"
c_red "заменены содержимым копии $(basename "$FILE")."
read -r -p "Для подтверждения введите поддомен компании ($SLUG): " CONFIRM || true
[ "$CONFIRM" = "$SLUG" ] || die "Отменено"

STAMP="$(date +%F-%H%M%S)"
echo "→ Сохраняю текущую базу в backups/before-restore-$STAMP.dump"
compose exec -T db pg_dump -U nasiya -Fc "$DB" > "$REPO_DIR/backups/before-restore-$STAMP.dump" || true

echo "→ Останавливаю приложение"
compose stop app >/dev/null

echo "→ Восстанавливаю базу $DB"
compose exec -T db psql -U nasiya -d postgres -qc \
  "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB'" >/dev/null
compose exec -T db dropdb -U nasiya --if-exists "$DB"
compose exec -T db createdb -U nasiya "$DB"
compose exec -T db pg_restore -U nasiya --no-owner -d "$DB" < "$DUMP"

echo "→ Запускаю приложение"
compose start app >/dev/null
wait_for_container

# Копия могла быть сделана на старой версии — догоняем схему
echo "→ Накатываю миграции"
compose exec -T app node scripts/migrate-all.mjs

wait_for_health "$(env_get APP_DOMAIN)"

rm -f "$WORK"/*.dump
c_green "Готово: база восстановлена из $(basename "$FILE")."
echo "Входите старыми логинами и паролями сотрудников."
