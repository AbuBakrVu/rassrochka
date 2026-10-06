#!/usr/bin/env bash
# Установка на новый сервер одной командой — запускается на ВАШЕМ
# компьютере (macOS/Linux), а не на сервере:
#
#   ./nasiya deploy root@203.0.113.10
#   ./nasiya deploy root@203.0.113.10 --key ~/keys/deploy_key --branch main
#
# Что делает по SSH:
#   1. кладёт на сервер deploy key для чтения репозитория (DEPLOY.md §1);
#   2. ставит git, клонирует репозиторий в /opt/nasiya;
#   3. запускает там ./nasiya install — вопросы про домен и администратора
#      задаются прямо в вашем терминале;
#   4. по желанию сразу настраивает резервные копии и восстанавливает базу
#      из копии со старого сервера.
#
# Совместим с bash 3.2 из macOS.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
die()   { red "✗ $1" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Использование: ./nasiya deploy root@<IP-сервера> [параметры]

  --key <файл>       deploy key для чтения репозитория (по умолчанию ~/.ssh/nasiya_deploy_key)
  --repo <адрес>     репозиторий (по умолчанию — origin этой копии, в виде git@github.com:…)
  --branch <ветка>   ветка (по умолчанию main)
  --dir <путь>       куда ставить на сервере (по умолчанию /opt/nasiya)
  --shared           сервер общий с другими сервисами: вход через /opt/proxy
USAGE
  exit 1
}

TARGET="${1:-}"
[ -n "$TARGET" ] && [ "${TARGET#-}" = "$TARGET" ] || usage
shift

KEY="$HOME/.ssh/nasiya_deploy_key"
REPO=""
BRANCH="main"
DIR="/opt/nasiya"
MODE_ENV=""
while [ $# -gt 0 ]; do
  case "$1" in
    --key) KEY="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --shared) MODE_ENV="MODE=shared "; shift ;;
    *) usage ;;
  esac
done

if [ -z "$REPO" ]; then
  REPO="$(git remote get-url origin 2>/dev/null || true)"
  [ -n "$REPO" ] || die "Не удалось определить репозиторий — укажите --repo git@github.com:<владелец>/rassrochka.git"
fi
# Серверу нужен SSH-адрес: по https приватный репозиторий без пароля не склонировать
case "$REPO" in
  https://github.com/*)
    REPO="git@github.com:${REPO#https://github.com/}"
    case "$REPO" in *.git) ;; *) REPO="$REPO.git" ;; esac
    ;;
esac
case "$REPO" in
  git@*) ;;
  *) die "Репозиторий «$REPO» — нужен SSH-адрес вида git@github.com:<владелец>/rassrochka.git (--repo)" ;;
esac

[ -f "$KEY" ] || die "Нет deploy key $KEY — создайте его по DEPLOY.md §1 или укажите --key"

echo "Установка Nasiya на $TARGET"
echo "───────────────────────────────────────────────"
echo "  Репозиторий  $REPO ($BRANCH)"
echo "  Папка        $DIR"
echo "  Deploy key   $KEY"
echo

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"

echo "→ Проверяю доступ к серверу"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$TARGET" "true" || die "Нет доступа по SSH. Если вход пока по паролю — сначала: ssh-copy-id $TARGET"

echo "→ Передаю deploy key"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$TARGET" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat > ~/.ssh/nasiya_deploy_key && chmod 600 ~/.ssh/nasiya_deploy_key" < "$KEY"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$TARGET" 'grep -q "nasiya_deploy_key" ~/.ssh/config 2>/dev/null || cat >> ~/.ssh/config <<CFG

Host github.com
  IdentityFile ~/.ssh/nasiya_deploy_key
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
CFG
chmod 600 ~/.ssh/config'

echo "→ Клонирую репозиторий"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$TARGET" "set -e
command -v git >/dev/null 2>&1 || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git >/dev/null; }
if [ -d '$DIR/.git' ]; then
  echo '  уже склонирован — обновляю'
  git -C '$DIR' fetch --quiet origin && git -C '$DIR' checkout --quiet '$BRANCH' && git -C '$DIR' merge --ff-only --quiet 'origin/$BRANCH'
else
  git clone --quiet --branch '$BRANCH' '$REPO' '$DIR'
fi"

echo "→ Запускаю установку на сервере"
# -t — чтобы вопросы install.sh задавались в этом терминале
# shellcheck disable=SC2086
ssh -t $SSH_OPTS "$TARGET" "cd '$DIR' && ${MODE_ENV}./nasiya install"

echo
read -r -p "Настроить резервные копии сейчас? [Y/n]: " ANSWER || true
if [ "${ANSWER:-Y}" != "n" ] && [ "${ANSWER:-Y}" != "N" ]; then
  # shellcheck disable=SC2086
  ssh -t $SSH_OPTS "$TARGET" "cd '$DIR' && ./nasiya backup-setup"
fi

echo
green "Сервер готов."
echo "Переезжаете со старого сервера? Восстановите данные из копии:"
echo "  ssh $TARGET 'cd $DIR && ./nasiya restore latest'"
