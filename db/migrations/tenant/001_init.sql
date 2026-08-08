-- Схема базы одной компании. Все бизнес-данные живут здесь; чужая компания
-- физически недоступна, потому что она в другой базе.
--
-- Главное отличие от типов текущего прототипа (lib/data.ts): всё, что
-- вычисляется, больше не хранится. Подробности — MIGRATION.md §3.1.

create extension if not exists pgcrypto;  -- gen_random_bytes для токенов
create extension if not exists citext;    -- регистронезависимый email

-- ── Пользователи ───────────────────────────────────────────────────────
-- Заменяют прежний Employee/seedEmployees: сотрудник — это тот, кто может
-- войти, а не отдельная справочная сущность.

create table users (
  id            bigserial primary key,
  email         citext not null unique,
  password_hash text not null,            -- argon2id
  name          text not null,            -- "Алексей Соколов"
  initials      text not null,            -- "АС" — прежний Employee.id
  role          text not null default 'manager'
                check (role in ('admin', 'manager')),
  phone         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on column users.initials is
  'Показываются на карточках сделок вместо полного имени. Раньше были Deal.manager.';

create table sessions (
  token      text primary key,            -- 32 случайных байта, hex
  user_id    bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_expires_at_idx on sessions (expires_at);
create index sessions_user_id_idx on sessions (user_id);

-- ── Клиенты ────────────────────────────────────────────────────────────
-- Убраны status/statusLabel/nextAction/nextDate: первые два выводятся из
-- сделок клиента, вторые два были чистым моком.

create sequence client_no start 1;

create table clients (
  id         text primary key
             default 'C-' || lpad(nextval('client_no')::text, 3, '0'),
  name       text not null,
  phone      text not null default '—',
  email      text not null default '—',
  city       text not null default '—',
  since      date not null default current_date,
  created_at timestamptz not null default now()
);

-- ── Сделки ─────────────────────────────────────────────────────────────
-- Убраны status/statusTone/urgent (вычисляются из графика и текущей даты)
-- и денормализованное имя клиента (берётся join'ом).

create sequence deal_no start 1;

create table deals (
  id            text primary key
                default 'R-' || lpad(nextval('deal_no')::text, 4, '0'),
  client_id     text not null references clients(id),
  product       text not null,
  -- сумма, которая гасится графиком (итоговая цена минус первый взнос)
  amount        numeric(12,2) not null check (amount > 0),
  months        int not null check (months > 0),
  markup_pct    numeric(5,2) not null default 15 check (markup_pct >= 0),
  opened_at     date not null default current_date,
  stage         text not null default 'new'
                check (stage in ('new','check','signing','active','closed','rejected')),
  manager_id    bigint references users(id),
  -- сколько взносов закрыто. Осознанный долг: правильнее таблица платежей,
  -- но не в эту миграцию — см. MIGRATION.md §3.2
  paid_count    int not null default 0 check (paid_count >= 0),
  next_step     text,
  deadline      date,
  reject_reason text,
  -- случайный, НЕ выводимый из номера сделки. Прежний tokenForDeal был
  -- детерминированным хешем и позволял вычислить чужую ссылку — MIGRATION.md §4.1
  portal_token  text not null unique
                default encode(gen_random_bytes(16), 'hex'),
  created_at    timestamptz not null default now(),
  constraint paid_count_within_schedule check (paid_count <= months)
);

create index deals_client_id_idx on deals (client_id);
create index deals_stage_idx on deals (stage);
create index deals_manager_id_idx on deals (manager_id);

-- ── Касса ──────────────────────────────────────────────────────────────

create table cash_tx (
  id          bigserial primary key,
  kind        text not null check (kind in ('purchase','payment','adjustment')),
  amount      numeric(12,2) not null,     -- минус расход, плюс приход
  occurred_at date not null,
  deal_id     text references deals(id) on delete set null,
  title       text not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index cash_tx_occurred_at_idx on cash_tx (occurred_at desc);
create index cash_tx_deal_id_idx on cash_tx (deal_id);

-- ── История сделки ─────────────────────────────────────────────────────

create table deal_events (
  id          bigserial primary key,
  deal_id     text not null references deals(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  text        text not null,
  user_id     bigint references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index deal_events_deal_id_idx on deal_events (deal_id, occurred_at desc);

-- ── Настройки компании ─────────────────────────────────────────────────
-- Сюда переезжают величины, которые в прототипе были константами в коде.

create table settings (
  key   text primary key,
  value jsonb not null
);

-- В прототипе CASH_OPENING_BALANCE = 1 240 000 был одинаков для всех.
-- Новая компания начинает с нуля и задаёт свой остаток сама.
insert into settings (key, value) values ('cash_opening_balance', '0'::jsonb);
