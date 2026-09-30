-- Квитанции о платежах и честный откат платежа.
--
-- Раньше платёж в кассе был связан со взносом графика только текстом
-- заголовка («Платёж 2 из 6 · …»). Из-за этого «Отменить последний
-- платёж» брал просто последнюю запись кассы по сделке — и если перед этим
-- уже был откат, «отменял» саму отмену: второй откат подряд записывал в
-- кассу плюс вместо минуса. Теперь запись кассы знает номер взноса,
-- способ оплаты, а запись-отмена — какую именно запись она отменяет.

alter table cash_tx add column installment_number int;
alter table cash_tx add column method text
  check (method in ('cash', 'card', 'transfer'));
alter table cash_tx add column reverses_id bigint references cash_tx(id);

-- Одну запись нельзя отменить дважды
create unique index cash_tx_reverses_id_key on cash_tx (reverses_id)
  where reverses_id is not null;

-- ── Перенос истории ────────────────────────────────────────────────────

update cash_tx
set installment_number = substring(title from '^Платёж (\d+) из')::int
where kind = 'payment' and title ~ '^Платёж \d+ из';

update cash_tx
set method = case
  when note like '% · наличные' then 'cash'
  when note like '% · карта' then 'card'
  when note like '% · перевод' then 'transfer'
end
where installment_number is not null;

-- Каждую старую отмену связываем с последним ещё не отменённым платежом
-- того же взноса, записанным раньше неё. Суммы не трогаем: если старый
-- баг двойного отката уже записал в кассу неверную сумму, это видно
-- отдельным запросом (см. OPERATIONS.md) и правится только вручную.
do $$
declare
  r record;
  target bigint;
begin
  for r in
    select id, deal_id, substring(title from '^Отмена платежа (\d+) из')::int as n
    from cash_tx
    where kind = 'payment' and title ~ '^Отмена платежа \d+ из'
    order by id
  loop
    select p.id into target
    from cash_tx p
    where p.deal_id = r.deal_id
      and p.installment_number = r.n
      and p.amount > 0
      and p.id < r.id
      and p.reverses_id is null
      and not exists (select 1 from cash_tx x where x.reverses_id = p.id)
    order by p.id desc
    limit 1;

    update cash_tx set installment_number = r.n, reverses_id = target where id = r.id;
  end loop;
end $$;
