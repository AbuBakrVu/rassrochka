#!/bin/sh
# Резервное копирование всех баз. Запускается по cron на сервере:
#   0 3 * * * cd /opt/finora && ./scripts/backup.sh >> /var/log/finora-backup.log 2>&1
#
# Данных у клиентов нет НИГДЕ, кроме этого сервера, поэтому копия обязана
# уезжать за его пределы. Копия рядом с базой не переживёт смерть диска.

set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/finora/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
STAMP="$(date +%F)"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%F %T')] начало"

# Роли и права — их нет в дампах отдельных баз
docker compose exec -T db pg_dumpall -U finora --globals-only \
  | gzip > "$BACKUP_DIR/globals-$STAMP.sql.gz"

# Реестр компаний и база каждой из них
DBS="finora_control $(docker compose exec -T db psql -U finora -d finora_control -tAc \
  'select db_name from companies' | tr -d '\r')"

for db in $DBS; do
  [ -z "$db" ] && continue
  out="$BACKUP_DIR/$db-$STAMP.dump"

  # Формат -Fc: сжатый, восстанавливается выборочно через pg_restore
  docker compose exec -T db pg_dump -U finora -Fc "$db" > "$out"

  # Шифруем: в дампах паспортные данные клиентов. Ключ получателя задаётся
  # переменной AGE_RECIPIENT (см. DEPLOY.md). Без неё дамп остаётся открытым
  # и уезжать в чужое хранилище ему нельзя.
  if [ -n "${AGE_RECIPIENT:-}" ]; then
    age -r "$AGE_RECIPIENT" -o "$out.age" "$out" && rm "$out"
    out="$out.age"
  else
    echo "  ВНИМАНИЕ: AGE_RECIPIENT не задан, дамп $db не зашифрован"
  fi

  echo "  ✓ $(basename "$out") ($(du -h "$out" | cut -f1))"
done

# Отправка за пределы сервера. Настройте rclone (rclone config) под своё
# хранилище — S3, Selectel, VK Cloud, Yandex Object Storage.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*-$STAMP.*"
  echo "  ✓ отправлено в $RCLONE_REMOTE"
else
  echo "  ВНИМАНИЕ: RCLONE_REMOTE не задан — копия осталась только на сервере"
fi

find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete
echo "[$(date '+%F %T')] готово"
