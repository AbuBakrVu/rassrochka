-- Соинвесторы: люди, вложившие деньги в оборот компании и получающие
-- ежемесячный процент от вложенной суммы. Выплаты — расход из той же
-- кассы, что и закупки, поэтому идут через cash_tx с новым kind='payout'.

create sequence coinvestor_no start 1;

create table coinvestors (
  id              text primary key
                  default 'INV-' || lpad(nextval('coinvestor_no')::text, 3, '0'),
  name            text not null,
  phone           text not null default '—',
  invested_amount numeric(12,2) not null check (invested_amount >= 0),
  monthly_percent numeric(5,2) not null check (monthly_percent >= 0),
  started_at      date not null default current_date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table cash_tx add column coinvestor_id text references coinvestors(id) on delete set null;
create index cash_tx_coinvestor_id_idx on cash_tx (coinvestor_id);

alter table cash_tx drop constraint cash_tx_kind_check;
alter table cash_tx add constraint cash_tx_kind_check
  check (kind in ('purchase', 'payment', 'adjustment', 'payout'));
