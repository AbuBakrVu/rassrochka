-- Журнал действий сотрудников: кто и когда удалил сделку, откатил платёж,
-- поправил кассу, сменил ответственного. История сделки (deal_events)
-- рассказывает клиентскую историю одной сделки и не знает автора; здесь —
-- общий след по всей компании для владельца.

create table audit_log (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  user_id     bigint references users(id) on delete set null,
  action      text not null,       -- машинный код: 'payment.undo', 'deal.delete'…
  entity_id   text,                -- R-0012, C-004, INV-001 — куда вести по клику
  details     text not null        -- человекочитаемое описание
);

create index audit_log_occurred_at_idx on audit_log (occurred_at desc);
create index audit_log_user_id_idx on audit_log (user_id);
