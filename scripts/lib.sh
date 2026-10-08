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
#   docker     — 80/443 держит прокси в контейнере, приложение в его сети (docker-compose.local.yml)
compose() {
  local files=(-f "$REPO_DIR/docker-compose.yml")
  case "$(env_get DEPLOY_MODE)" in
    shared) files+=(-f "$REPO_DIR/docker-compose.shared.yml") ;;
    port)   files+=(-f "$REPO_DIR/docker-compose.port.yml") ;;
    docker) files+=(-f "$REPO_DIR/docker-compose.local.yml") ;;
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

# Режим port: nginx (новый файл сайта + certbot) и Caddy на сервере (блок в
# /etc/caddy/Caddyfile) настраиваем сами, для другого — печатаем, что добавить.
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

  # Caddy, установленный прямо на сервер: дописываем сайт в его Caddyfile,
  # проверяем, при ошибке возвращаем прежний файл. Сертификат Caddy выпустит сам
  local caddyfile="/etc/caddy/Caddyfile"
  if [ "$owner" = "caddy" ] && [ -f "$caddyfile" ] && command -v caddy >/dev/null 2>&1; then
    echo "→ Добавляю сайт $host в Caddy ($caddyfile)"
    if grep -qE "^[[:space:]]*$host([[:space:],{]|$)" "$caddyfile"; then
      c_dim "  $host в Caddyfile уже есть — оставляю как есть"
      return 0
    fi
    local backup="$caddyfile.before-nasiya-$(date +%Y%m%d%H%M%S)"
    cp "$caddyfile" "$backup"
    cat >> "$caddyfile" <<SITE

# Nasiya CRM ($REPO_DIR)
$host {
	encode gzip zstd
	reverse_proxy 127.0.0.1:$port
	request_body {
		max_size 12MB
	}
}
SITE
    if caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null 2>&1; then
      systemctl reload caddy && c_green "  ✓ Caddy перечитал настройки, сертификат выпустит при первом заходе"
      c_dim "  прежний файл сохранён: $backup"
    else
      cp "$backup" "$caddyfile"
      c_red "  Caddy не принял настройки — вернул прежний Caddyfile, остальные сайты не тронуты."
      echo "  Добавьте вручную: $host { reverse_proxy 127.0.0.1:$port }"
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

# ── Прокси других сервисов в Docker (режим docker) ─────────────────────
# 80/443 держит контейнер (Traefik, Nginx Proxy Manager, nginx-proxy,
# свой nginx/Caddy). Nasiya подключается к его Docker-сети под именем
# PROXY_ALIAS; Traefik и nginx-proxy публикуют её сами по меткам и
# переменным, для остальных печатаем, что добавить.

# Заполняет PROXY_CONTAINER, PROXY_IMAGE, PROXY_KIND, PROXY_NETWORK.
# Ненулевой код — порты держит не контейнер.
detect_docker_proxy() {
  command -v docker >/dev/null 2>&1 || return 1
  local line
  line="$(docker ps --filter publish=443 --format '{{.Names}} {{.Image}}' | grep -v '^proxy-caddy ' | head -1)"
  [ -n "$line" ] || line="$(docker ps --filter publish=80 --format '{{.Names}} {{.Image}}' | grep -v '^proxy-caddy ' | head -1)"
  [ -n "$line" ] || return 1
  PROXY_CONTAINER="${line%% *}"
  PROXY_IMAGE="${line#* }"
  case "$PROXY_IMAGE" in
    *traefik*) PROXY_KIND=traefik ;;
    *nginx-proxy-manager*) PROXY_KIND=npm ;;
    *nginx-proxy*|*jwilder*) PROXY_KIND=nginx-proxy ;;
    *) PROXY_KIND=other ;;
  esac
  # Своя сеть прокси (не bridge/host): по ней он и ходит к сервисам
  PROXY_NETWORK="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$PROXY_CONTAINER" \
    | tr ' ' '\n' | grep -vxE 'bridge|host|none|' | head -1)"
  return 0
}

# Traefik: имя точки входа на :443 и certresolver — из аргументов запуска.
# Если Traefik настроен файлом, берём самые частые имена.
traefik_settings() {
  local args
  args="$(docker inspect -f '{{join .Config.Cmd " "}} {{join .Args " "}}' "$PROXY_CONTAINER" 2>/dev/null | tr ' ' '\n')"
  TRAEFIK_EP="$(echo "$args" | sed -n 's/^--entrypoints\.\([^.=]*\)\.address=:443$/\1/p' | head -1)"
  TRAEFIK_RESOLVER="$(echo "$args" | sed -n 's/^--certificatesresolvers\.\([^.=]*\)\..*/\1/p' | head -1)"
  TRAEFIK_GUESSED=""
  [ -n "$TRAEFIK_EP" ] || { TRAEFIK_EP="websecure"; TRAEFIK_GUESSED=1; }
  [ -n "$TRAEFIK_RESOLVER" ] || { TRAEFIK_RESOLVER="letsencrypt"; TRAEFIK_GUESSED=1; }
}

# docker-compose.local.yml — создаётся при установке (в git не попадает):
# без своего Caddy, приложение в сети прокси, плюс метки/переменные для него
write_docker_override() {
  local host="$1" alias="$2" net="$3" kind="$4"
  {
    echo "# Создан ./nasiya install: Nasiya за прокси «$PROXY_CONTAINER» ($kind), сеть $net"
    echo "services:"
    echo "  caddy:"
    echo '    profiles: ["standalone-only"]'
    echo "  app:"
    echo "    networks:"
    echo "      default: {}"
    echo "      proxy:"
    echo "        aliases: [\"$alias\"]"
    if [ "$kind" = "nginx-proxy" ]; then
      echo "    environment:"
      echo "      VIRTUAL_HOST: \"$host\""
      echo "      VIRTUAL_PORT: \"3000\""
      echo "      LETSENCRYPT_HOST: \"$host\""
    fi
    if [ "$kind" = "traefik" ]; then
      echo "    labels:"
      echo "      traefik.enable: \"true\""
      echo "      traefik.docker.network: \"$net\""
      echo "      traefik.http.routers.$alias.rule: \"Host(\`$host\`)\""
      echo "      traefik.http.routers.$alias.entrypoints: \"$TRAEFIK_EP\""
      echo "      traefik.http.routers.$alias.tls: \"true\""
      echo "      traefik.http.routers.$alias.tls.certresolver: \"$TRAEFIK_RESOLVER\""
      echo "      traefik.http.services.$alias.loadbalancer.server.port: \"3000\""
    fi
    echo "networks:"
    echo "  proxy:"
    echo "    name: $net"
    echo "    external: true"
  } > "$REPO_DIR/docker-compose.local.yml"
}

# Что сделать в прокси, который сам по меткам не настраивается
docker_proxy_instructions() {
  local host="$1" alias="$2" kind="$3"
  case "$kind" in
    traefik|nginx-proxy)
      c_green "  ✓ $PROXY_CONTAINER подхватит $host сам (сертификат — при первом заходе)"
      [ -n "${TRAEFIK_GUESSED:-}" ] && c_red "  Traefik настроен файлом — взял точку входа «$TRAEFIK_EP» и certresolver «$TRAEFIK_RESOLVER». Если у вас другие — поправьте docker-compose.local.yml и: ./nasiya update"
      ;;
    npm)
      echo
      echo "В Nginx Proxy Manager (обычно http://IP-сервера:81) → Proxy Hosts → Add:"
      echo "  Domain Names       $host"
      echo "  Scheme / Forward   http  $alias  3000"
      echo "  SSL                Request a new certificate, Force SSL"
      ;;
    *)
      echo
      echo "В настройках прокси «$PROXY_CONTAINER» направьте $host на http://$alias:3000"
      echo "(контейнеры уже в одной сети), передавая заголовок Host. Для nginx:"
      echo "  location / { proxy_pass http://$alias:3000; proxy_set_header Host \$host;"
      echo "               proxy_set_header X-Forwarded-Proto \$scheme; client_max_body_size 12m; }"
      ;;
  esac
}
