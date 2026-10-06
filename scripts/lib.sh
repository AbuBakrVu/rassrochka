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
    if compose exec -T app node -e "process.exit(0)" >/dev/null 2>&1; then
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
    if compose exec -T app \
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

# Режим установки (DEPLOY_MODE в .env):
#   standalone — сервер только под Nasiya, свой Caddy на 80/443;
#   shared     — общий прокси /opt/proxy, приложение в его сети (docker-compose.shared.yml);
#   port       — 80/443 держит ваш веб-сервер, приложение на 127.0.0.1:APP_PORT (docker-compose.port.yml)
compose() {
  local files=(-f "$REPO_DIR/docker-compose.yml")
  case "$(env_get DEPLOY_MODE)" in
    shared) files+=(-f "$REPO_DIR/docker-compose.shared.yml") ;;
    port)   files+=(-f "$REPO_DIR/docker-compose.port.yml") ;;
  esac
  docker compose "${files[@]}" --env-file "$ENV_FILE" "$@"
}

PROXY_DIR="${PROXY_DIR:-/opt/proxy}"

# Сайт Nasiya в общем прокси: <компания>.<домен> → приложение этой установки
write_proxy_site() {
  local host="$1" alias="$2"
  mkdir -p "$PROXY_DIR/sites"
  cat > "$PROXY_DIR/sites/$host.caddy" <<SITE
# $host → $alias:3000 (Nasiya, $REPO_DIR)
$host {
	encode gzip zstd
	reverse_proxy $alias:3000 {
		header_up X-Forwarded-Proto https
	}
}
SITE
  "$PROXY_DIR/proxy" reload
}

# Конфиг nginx для Nasiya за вашим веб-сервером (режим port). Host
# передаётся как есть — по нему приложение узнаёт компанию.
nginx_site_conf() {
  local host="$1" port="$2"
  cat <<CONF
# Nasiya CRM ($REPO_DIR) — $host → 127.0.0.1:$port
server {
    listen 80;
    listen [::]:80;
    server_name $host;

    # Фото паспорта и документы — до 5 МБ, в запросе они крупнее
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
CONF
}

# Режим port: nginx настраиваем сами (новый файл сайта, проверка, перезагрузка,
# сертификат certbot), для другого веб-сервера печатаем, что добавить.
publish_behind_web_server() {
  local host="$1" port="$2" owner="$3" email="$4"
  local conf="/etc/nginx/sites-available/nasiya-$host.conf"

  if [ "$owner" = "nginx" ] && [ -d /etc/nginx/sites-available ]; then
    echo "→ Добавляю сайт $host в nginx"
    if [ -e "$conf" ]; then
      c_dim "  $conf уже есть — оставляю как есть"
    else
      nginx_site_conf "$host" "$port" > "$conf"
      ln -sf "$conf" "/etc/nginx/sites-enabled/nasiya-$host.conf"
      if ! nginx -t >/dev/null 2>&1; then
        rm -f "/etc/nginx/sites-enabled/nasiya-$host.conf" "$conf"
        die "nginx не принял конфиг — откатил, остальные сайты не тронуты (nginx -t покажет причину)"
      fi
      systemctl reload nginx
      c_green "  ✓ nginx перечитал настройки"
    fi

    if ! command -v certbot >/dev/null 2>&1; then
      echo "→ Ставлю certbot для сертификата"
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx >/dev/null \
        || c_red "  certbot не установился — сертификат выпустите сами: certbot --nginx -d $host"
    fi
    if command -v certbot >/dev/null 2>&1; then
      echo "→ Выпускаю сертификат для $host"
      if certbot --nginx -d "$host" --non-interactive --agree-tos -m "$email" --redirect >/dev/null 2>&1; then
        c_green "  ✓ HTTPS включён"
      else
        c_red "  сертификат не выпущен — проверьте A-запись $host и повторите: certbot --nginx -d $host"
      fi
    fi
    return 0
  fi

  echo
  c_red "Порты 80/443 занимает «${owner:-другая программа}» — настроить её сам не могу."
  echo "Направьте домен $host на http://127.0.0.1:$port, обязательно передавая заголовок Host."
  echo "Для nginx — такой сайт (плюс сертификат: certbot --nginx -d $host):"
  echo
  nginx_site_conf "$host" "$port"
  echo
  echo "Если 80/443 держит прокси в Docker (Traefik, Caddy, nginx-proxy) — подключите"
  echo "приложение к его сети и ведите домен на контейнер-app порт 3000:"
  echo "  docker network connect <сеть-прокси> \$(cd $REPO_DIR && docker compose ps -q app)"
}
