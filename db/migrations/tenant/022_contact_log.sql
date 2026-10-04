-- Работа с просрочкой: журнал звонков и обещаний оплатить (страница
-- «Просрочки», lib/collections.ts). Каждая запись — один контакт с
-- клиентом по сделке и его итог.
--
--   promise   — обещал оплатить к due_date (сумма — amount)
--   callback  — просил перезвонить в due_date
--   no_answer — не дозвонились
--   refused   — отказывается платить
--   paid      — говорит, что уже оплатил (проверить кассу)
--   other     — другое, см. note

create table contact_log (
  id         bigserial primary key,
  deal_id    text not null references deals(id) on delete cascade,
  user_id    bigint references users(id) on delete set null,
  outcome    text not null
             check (outcome in ('promise', 'callback', 'no_answer', 'refused', 'paid', 'other')),
  due_date   date,
  amount     numeric(12,2) check (amount is null or amount > 0),
  note       text,
  created_at timestamptz not null default now()
);

create index contact_log_deal_idx on contact_log (deal_id, created_at desc);
