# Развёртывание на VPS

Пошаговая инструкция для этапов 7–8 из `MIGRATION.md`. Код готов (этапы
1–6): Postgres, API, авторизация, многотенантность по поддоменам. Здесь —
только инфраструктура: Docker, Caddy, бэкапы, первый запуск.

**Домен не выбран.** Везде ниже `<домен>` — подставьте свой, когда решите.
В коде домен нигде не зашит — он приходит из `APP_DOMAIN` в одном файле
`.env` на сервере (`lib/tenant-host.ts` его просто читает).

---

## 0. Что нужно подготовить заранее

Разово, до первой команды на сервере:

1. **Домен.** Купить, добавить две DNS-записи A на IP будущего сервера:
   - `<домен>` → IP
   - `*.<домен>` → тот же IP (wildcard — иначе поддомены компаний не
     заработают; сертификаты выпускаются отдельно на каждый, без wildcard,
     см. §3)
2. **152-ФЗ.** Форма клиента собирает паспортные данные — это персональные
   данные, и по закону базы с ПДн граждан РФ должны быть на территории РФ.
   Не юридическая консультация — но прежде чем арендовать сервер, свериться
   с юристом. Практический вывод: скорее всего нужен российский провайдер
   (Selectel, Timeweb, Beget, VK Cloud, Yandex Cloud), а не Hetzner/Contabo.
3. **VPS.** 2 vCPU, 4 ГБ RAM, 60 ГБ SSD, Ubuntu 22.04/24.04 LTS — с запасом
   для заявленного масштаба (до 10 компаний, до 5 сотрудников в каждой).

## 1. Первоначальная настройка сервера

Через SSH под пользователем с sudo (не root напрямую):

```bash
apt update && apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
# перелогиниться, чтобы группа применилась

# Файл подкачки — сборка Next.js рядом с Postgres на 4 ГБ RAM может уйти
# в OOM. 2 ГБ подкачки закрывают пик сборки с запасом.
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Базовый firewall: снаружи нужны только 80/443/22
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable
```

**Доступ к приватному репозиторию.** Личный ключ от вашего аккаунта GitHub
на сервер не класть: если сервер скомпрометируют, потеряете доступ ко всем
своим репозиториям, а не к одному.

```bash
ssh-keygen -t ed25519 -C "deploy@<домен>" -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub
```

Публичный ключ добавить в репозиторий: **Settings → Deploy keys → Add deploy
key**, право только на чтение (Allow write access выключен).

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/deploy_key
EOF

git clone git@github.com:<владелец>/rassrochka.git /opt/finora
cd /opt/finora
```

## 2. Настройка окружения

```bash
cp .env.server.example .env
nano .env    # заполнить APP_DOMAIN, ACME_EMAIL, PG_PASSWORD
chmod 600 .env
```

`PG_PASSWORD` сгенерировать: `openssl rand -base64 24`.

## 3. Первый запуск

```bash
docker compose build app
docker compose up -d
docker compose logs -f app    # Ctrl+C когда увидите "Ready"
```

Миграции — отдельной командой, не в `CMD` контейнера (иначе при рестарте
нескольких реплик они пойдут параллельно и подерутся):

```bash
docker compose exec app node scripts/migrate-all.mjs
```

Проверка, что всё поднялось:

```bash
curl -s https://<домен>/api/health
# {"ok":true}
```

Если не отвечает — `docker compose ps` и `docker compose logs caddy`. Первый
запрос на новый поддомен занимает несколько секунд: Caddy в этот момент
получает сертификат от Let's Encrypt.

## 4. Первая компания

```bash
docker compose exec app node scripts/create-tenant.mjs \
  --slug acme --name "ООО Акме" --admin-email director@acme.ru
```

Скрипт печатает временный пароль **один раз** — сохраните его и передайте
клиенту по защищённому каналу. При первом входе на `acme.<домен>` система
потребует пароль сменить.

Остальные компании — той же командой с другим `--slug`. Полный список
команд: `create-tenant`, `drop-tenant` — в `MIGRATION.md` §9.

## 5. Резервные копии

**Обязательный шаг, не пожелание** — данных у клиентов нет нигде, кроме
этого сервера.

```bash
apt install -y age rclone
rclone config
# настроить удалённое хранилище (S3-совместимое) под именем finora-backup,
# первый запуск rclone config интерактивный — следуйте подсказкам
```

Ключ шифрования дампов (в них паспортные данные клиентов):

```bash
age-keygen -o /root/.config/finora/backup.key
# публичный ключ (age1...) — в AGE_RECIPIENT ниже
# приватный ключ — СКОПИРОВАТЬ В ДРУГОЕ МЕСТО (менеджер паролей, сейф).
# Если файл на сервере пропадёт вместе с сервером, расшифровать бэкапы
# будет нечем — резервная копия превратится в бесполезный мусор
```

Cron:

```bash
crontab -e
```

```cron
AGE_RECIPIENT=age1вашключотсюда
RCLONE_REMOTE=finora-backup:finora-db
BACKUP_DIR=/opt/finora/backups
0 3 * * * cd /opt/finora && ./scripts/backup.sh >> /var/log/finora-backup.log 2>&1
```

**Проверка восстановления — раз в квартал, обязательно.** Непроверенная
резервная копия равносильна её отсутствию:

```bash
age -d -i /root/.config/finora/backup.key backups/finora_acme-2026-08-09.dump.age \
  > /tmp/test.dump
docker compose exec -T db createdb -U finora finora_test_restore
docker compose exec -T db pg_restore -U finora -d finora_test_restore < /tmp/test.dump
docker compose exec db psql -U finora -d finora_test_restore -c "select count(*) from deals;"
docker compose exec db dropdb -U finora finora_test_restore
```

## 6. Мониторинг (минимум)

- Внешняя проверка: любой сервис вроде UptimeRobot на
  `https://<домен>/api/health` раз в 1–5 минут
- Диск: `df -h` заполнение на 80% — самая частая причина падения Postgres
  на маленьких серверах. Можно повесить на тот же UptimeRobot через
  простой скрипт-эндпоинт, или проверять руками первое время
- `docker compose ps` — все три сервиса должны быть `healthy`

Полноценный Prometheus/Grafana на масштабе в 10 компаний — чистые
накладные расходы, не нужен.

## 7. Обновление (выкат новой версии)

```bash
cd /opt/finora
git fetch --tags
git checkout v2026-09-01          # конкретный тег, не main
docker compose build app
docker compose up -d
docker compose exec app node scripts/migrate-all.mjs
```

**Помечайте релизы тегами** (`git tag v2026-09-01 && git push --tags`) —
иначе откатываться будет некуда, кроме случайного хеша коммита. Откат —
`git checkout` на предыдущий тег и пересборка тем же способом.

## 8. Частые проблемы

**Caddy не выдаёт сертификат.** Проверить, что DNS уже разошёлся
(`dig acme.<домен>`) и что wildcard-запись `*.<домен>` действительно
существует. Логи: `docker compose logs caddy`.

**`docker compose exec app node scripts/...` падает с ошибкой подключения
к БД.** Проверить, что сервис `db` в статусе `healthy`
(`docker compose ps`), и что `PG_PASSWORD` в `.env` совпадает с тем, что
Postgres запомнил при первом запуске (пароль применяется только при
создании тома — если меняли `.env` задним числом, тому Postgres об этом
неизвестно).

**Сборка падает из-за нехватки памяти.** Проверить, что своп подключён:
`swapon --show`. Если пусто — вернуться к шагу 1.

**Компания создана, но `acme.<домен>` отвечает «Компания не найдена».**
Скорее всего DNS ещё не разошёлся, либо опечатка в `--slug` при создании
компании. Проверить: `docker compose exec db psql -U finora -d finora_control -c "select slug, active from companies;"`
