-- Владельцы платформы — те, кто управляет реестром компаний (создаёт,
-- отключает), а не сотрудники внутри какой-то одной компании. Полностью
-- отдельная модель: своя таблица, своя сессия, свой логин на корневом
-- домене (/admin), не путать с users в базе каждой компании.

create extension if not exists pgcrypto;  -- gen_random_bytes для токенов
create extension if not exists citext;    -- регистронезависимый email

create table platform_admins (
  id                    bigserial primary key,
  email                 citext not null unique,
  password_hash         text not null,
  name                  text not null,
  must_change_password  boolean not null default false,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create table platform_sessions (
  token      text primary key,
  admin_id   bigint not null references platform_admins(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index platform_sessions_expires_at_idx on platform_sessions (expires_at);
