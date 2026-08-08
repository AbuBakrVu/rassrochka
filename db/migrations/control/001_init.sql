-- Реестр компаний — единственная общая база на всю установку.
-- Бизнес-данных здесь нет и быть не должно: по поддомену мы находим
-- только имя базы, к которой подключаться дальше.

create table companies (
  id         bigserial primary key,
  -- slug становится поддоменом (acme → acme.finora.ru), поэтому формат
  -- ограничен требованиями DNS: строчные буквы, цифры, дефис не по краям
  slug       text not null unique
             check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
                    and length(slug) between 2 and 32),
  name       text not null,
  db_name    text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table companies is
  'Компании-арендаторы. slug — поддомен, db_name — их изолированная база.';
comment on column companies.active is
  'false — вход закрыт, но база сохранена (клиент ушёл, данные ещё храним).';
