-- Сохранённые фильтры: сотрудник называет набор фильтров страницы
-- («Просрочки Иванова») и включает его одним кликом. Личные, у каждого свои.

create table saved_filters (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  page       text not null check (page in ('clients', 'cash', 'deals')),
  name       text not null,
  params     jsonb not null,
  created_at timestamptz not null default now()
);

create index saved_filters_user_page_idx on saved_filters (user_id, page);
