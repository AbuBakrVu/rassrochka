# Общие хелперы для install.sh / update.sh / settings.sh / status.sh.
# Подключается через `. scripts/lib.sh`, сам по себе не запускается.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

c_green() { printf '\033[32m%s\033[0m\n' "$1"; }
c_red()   { printf '\033[31m%s\033[0m\n' "$1"; }
c_dim()   { printf '\033[2m%s\033[0m\n' "$1"; }

die() { c_red "✗ $1" >&2; exit 1; }

require_root() {
  [ "$(id -u)" = "0" ] || die "нужен root — запустите через sudo"
}

require_env() {
  [ -f "$ENV_FILE" ] || die ".env не найден — сначала запустите: ./nasiya install"
}

# Загружает .env в переменные окружения текущего процесса
load_env() {
  require_env
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

# Значение ключа из .env (без загрузки остальных переменных в окружение)
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-
}

# Заменяет или добавляет ключ в .env
env_set() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -qE "^$key=" "$ENV_FILE"; then
    # разделитель | — в значениях (пароли, домены) не встречается «/»-конфликтов,
    # но на всякий случай экранируем его
    local escaped="${value//|/\\|}"
    sed -i.bak "s|^$key=.*|$key=$escaped|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# Ждёт, пока контейнер app вообще способен выполнять команды — НЕ проверяет
# базу. Нужен между `compose up` и первым `migrate-all.mjs`: до миграций
# базы CONTROL_DB (nasiya_control) ещё не существует, и wait_for_health()
# (которая её проверяет через /api/health) навсегда просидела бы в цикле,
# ожидая условие, которое сама же ещё не наступила — того, что база уже есть.
wait_for_container() {
  local tries=0
  echo "  ждём, пока контейнер поднимется…"
  while [ "$tries" -lt 20 ]; do
    if docker compose -f "$REPO_DIR/docker-compose.yml" exec -T app node -e "process.exit(0)" >/dev/null 2>&1; then
      c_green "  ✓ контейнер отвечает"
      return 0
    fi
    tries=$((tries + 1))
    sleep 2
  done
  die "контейнер app не поднялся за 40 секунд — смотрите: docker compose logs app"
}

# Полная проверка: приложение отвечает И видит свою базу. Используется
# после миграций (install.sh) или при обновлении, когда база уже точно есть.
wait_for_health() {
  local domain="$1" tries=0
  echo "  ждём, пока приложение поднимется…"
  while [ "$tries" -lt 40 ]; do
    if docker compose -f "$REPO_DIR/docker-compose.yml" exec -T app \
         node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
         >/dev/null 2>&1; then
      c_green "  ✓ приложение отвечает"
      return 0
    fi
    tries=$((tries + 1))
    sleep 3
  done
  die "приложение не поднялось за 2 минуты — смотрите: docker compose logs app"
}

compose() {
  docker compose -f "$REPO_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"
}
