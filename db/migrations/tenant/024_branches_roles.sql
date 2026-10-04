-- Филиалы и свои роли с правами по разделам.
--
-- Филиал есть у клиента, сделки, операции кассы и сотрудника. Сотрудник с
-- филиалом видит и ведёт только его данные; без филиала (null) — все.
-- Все существующие данные уходят в первый филиал: для компании с одной
-- точкой ничего не меняется, а интерфейс филиалов не показывается, пока
-- филиал один.

create table branches (
  id         bigserial primary key,
  name       text not null unique,
  address    text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into branches (name) values ('Основной');

alter table clients add column branch_id bigint references branches(id);
alter table deals   add column branch_id bigint references branches(id);
alter table cash_tx add column branch_id bigint references branches(id);
alter table users   add column branch_id bigint references branches(id) on delete set null;

update clients set branch_id = (select min(id) from branches);
update deals   set branch_id = (select min(id) from branches);
-- Деньги соинвесторов (капитал, выплаты) — общие для компании, без филиала
update cash_tx set branch_id = (select min(id) from branches) where coinvestor_id is null;

alter table clients alter column branch_id set not null;
alter table deals   alter column branch_id set not null;

create index clients_branch_idx on clients (branch_id);
create index deals_branch_idx on deals (branch_id);
create index cash_tx_branch_idx on cash_tx (branch_id);

-- Филиал по умолчанию — чтобы ни один из десятка мест, где заводятся
-- клиенты, сделки и проводки (онлайн-заявка, выдача, платежи, откаты…),
-- не пришлось переписывать: сделка наследует филиал клиента, проводка —
-- филиал сделки, клиент без явного филиала попадает в первый активный.

create function default_client_branch() returns trigger language plpgsql as $$
begin
  if new.branch_id is null then
    new.branch_id := (select id from branches where active order by id limit 1);
  end if;
  return new;
end $$;

create trigger clients_default_branch before insert on clients
  for each row execute function default_client_branch();

create function default_deal_branch() returns trigger language plpgsql as $$
begin
  if new.branch_id is null then
    new.branch_id := (select branch_id from clients where id = new.client_id);
  end if;
  return new;
end $$;

create trigger deals_default_branch before insert on deals
  for each row execute function default_deal_branch();

create function default_cash_branch() returns trigger language plpgsql as $$
begin
  if new.branch_id is null and new.deal_id is not null then
    new.branch_id := (select branch_id from deals where id = new.deal_id);
  end if;
  return new;
end $$;

create trigger cash_tx_default_branch before insert on cash_tx
  for each row execute function default_cash_branch();

-- ── Свои роли ──────────────────────────────────────────────────────────
-- Встроенные роли (admin/manager/accountant) остаются в users.role, их права
-- заданы в коде (lib/permissions.ts). Своя роль — users.role = 'custom' и
-- ссылка на строку здесь со списком прав.

create table roles (
  id          bigserial primary key,
  name        text not null unique,
  permissions text[] not null default '{}',
  created_at  timestamptz not null default now()
);

alter table users add column role_id bigint references roles(id);

alter table users drop constraint users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'manager', 'accountant', 'custom'));
alter table users add constraint users_custom_role_check
  check ((role = 'custom') = (role_id is not null));
