#!/usr/bin/env bash
# Обновление до последней версии из git.
#
#   ./nasiya update              — подтянуть последний коммит текущей ветки
#   ./nasiya update v2026-09-01  — переключиться на конкретный тег/коммит
#
# Каждый сервер обновляется отдельной командой на нём самом — заходить на
# сервер клиента и решать за него, когда обновляться, мы не хотим.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. scripts/lib.sh

require_env
require_root

REF="${1:-}"

if [ -n "$(git status --porcelain)" ]; then
  die "В рабочей копии есть незакоммиченные изменения — commit/stash их перед обновлением (git status)"
fi

echo "→ Забираю изменения из git"
git fetch --all --tags --quiet

BEFORE="$(git rev-parse --short HEAD)"

if [ -n "$REF" ]; then
  git checkout --quiet "$REF"
else
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$BRANCH" = "HEAD" ]; then
    die "Сейчас отсоединённый HEAD (после предыдущего update с тегом) — укажите тег/ветку явно: ./nasiya update main"
  fi
  git merge --ff-only "origin/$BRANCH"
fi

AFTER="$(git rev-parse --short HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  c_green "Уже последняя версия ($AFTER) — пересборка не нужна"
  exit 0
fi

echo "  $BEFORE → $AFTER"

echo "→ Пересобираю образ"
compose build app

echo "→ Перезапускаю"
compose up -d

wait_for_health "$(env_get APP_DOMAIN)"

echo "→ Накатываю миграции"
compose exec -T app node scripts/migrate-all.mjs

c_green "Готово: $AFTER"
