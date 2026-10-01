-- Лимит клиента: сколько всего ему можно выдать в рассрочку одновременно.
-- null — лимит считается автоматически по истории платежей (lib/credit.ts),
-- число — администратор задал его вручную.

alter table clients add column credit_limit numeric(12,2)
  check (credit_limit is null or credit_limit >= 0);

-- Базовый лимит для клиента без истории. 0 — автоматический лимит выключен.
insert into settings (key, value) values ('client_default_limit', '100000'::jsonb)
on conflict (key) do nothing;
