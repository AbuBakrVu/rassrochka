-- Заявки на подключение с лендинга (корневой домен, /api/public/lead).
-- Это ещё не компании — просто контакты тех, кто хочет попробовать CRM.
-- Лежат в реестре, потому что ни к одной компании не относятся.

create table leads (
  id         bigserial primary key,
  name       text not null,
  phone      text not null,
  company    text not null default '',
  comment    text not null default '',
  ip         text not null default '',
  -- new → contacted → done: пока статусом управляем вручную (psql)
  status     text not null default 'new'
             check (status in ('new', 'contacted', 'done')),
  created_at timestamptz not null default now()
);

create index leads_created_at_idx on leads (created_at desc);

comment on table leads is
  'Заявки на подключение CRM с лендинга. Не компании — только контакты.';
