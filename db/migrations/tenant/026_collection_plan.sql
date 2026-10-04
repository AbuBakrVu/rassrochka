-- План сборов на месяц по менеджерам. План по умолчанию считается сам —
-- сумма взносов графиков с датой в этом месяце (lib/collection-plan.ts);
-- строка здесь — цель, которую администратор поставил вручную вместо него.

create table collection_targets (
  month      date not null check (extract(day from month) = 1),
  manager_id bigint not null references users(id) on delete cascade,
  amount     numeric(12,2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (month, manager_id)
);
