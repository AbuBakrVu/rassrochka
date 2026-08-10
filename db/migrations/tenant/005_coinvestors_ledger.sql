-- Переводим соинвесторов с плоского "% от вложенной суммы в месяц" на
-- реалистичную модель: доля от РЕАЛЬНОЙ прибыли кассы (начисляется с
-- каждого принятого платежа пропорционально марже сделки), плюс полный
-- журнал движений капитала (пополнение/снятие/реинвестирование) вместо
-- одного статичного числа invested_amount.

alter table coinvestors rename column monthly_percent to profit_share_pct;

create table coinvestor_capital_tx (
  id            bigserial primary key,
  coinvestor_id text not null references coinvestors(id) on delete cascade,
  kind          text not null check (kind in ('deposit', 'withdrawal', 'reinvest')),
  amount        numeric(12,2) not null check (amount > 0),
  occurred_at   date not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index coinvestor_capital_tx_coinvestor_id_idx
  on coinvestor_capital_tx (coinvestor_id, occurred_at desc);

create table coinvestor_profit_tx (
  id            bigserial primary key,
  coinvestor_id text not null references coinvestors(id) on delete cascade,
  deal_id       text references deals(id) on delete set null,
  -- accrual — начисление доли с реального платежа; payout — выплата деньгами
  -- (дублируется в cash_tx как реальный расход); reinvest — начисленное
  -- превращается в капитал без движения денег в кассе
  kind          text not null check (kind in ('accrual', 'payout', 'reinvest')),
  amount        numeric(12,2) not null check (amount > 0),
  occurred_at   timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now()
);

create index coinvestor_profit_tx_coinvestor_id_idx
  on coinvestor_profit_tx (coinvestor_id, occurred_at desc);

-- Существующих инвесторов не оставляем без капитала: переносим их
-- invested_amount первым взносом в журнал
insert into coinvestor_capital_tx (coinvestor_id, kind, amount, occurred_at, note)
select id, 'deposit', invested_amount, started_at, 'Начальный капитал (перенесено при обновлении)'
from coinvestors
where invested_amount > 0;

alter table coinvestors drop column invested_amount;

alter table cash_tx drop constraint cash_tx_kind_check;
alter table cash_tx add constraint cash_tx_kind_check
  check (kind in ('purchase', 'payment', 'adjustment', 'payout', 'capital_deposit', 'capital_withdrawal'));
