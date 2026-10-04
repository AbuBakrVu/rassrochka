-- Кабинет соинвестора и автоначисление.
--
-- Личная ссылка /investor/<токен> — как кабинет клиента: капитал,
-- начисления по месяцам, выплаты. Токен случайный, перевыпускается из CRM.
--
-- Режим начисления:
--   profit_share — доля от маржи каждого закрытого взноса (как было);
--   fixed        — фиксированный % в месяц на капитал: начисляется сам
--                  за каждый закончившийся месяц от среднего капитала за
--                  этот месяц (lib/coinvestor-accrual.ts).

alter table coinvestors add column portal_token text not null unique
  default encode(gen_random_bytes(16), 'hex');
alter table coinvestors add column accrual_mode text not null default 'profit_share'
  check (accrual_mode in ('profit_share', 'fixed'));
alter table coinvestors add column monthly_rate_pct numeric(5,2) not null default 0
  check (monthly_rate_pct >= 0 and monthly_rate_pct <= 100);
-- С какого месяца начислять фиксированный процент: при переключении режима
-- у давнего соинвестора прошлые месяцы задним числом не начисляются
alter table coinvestors add column fixed_since date;

-- Месяц, за который начислен фиксированный процент (первое число месяца).
-- Уникальность не даёт начислить один месяц дважды, даже если два запроса
-- запустили начисление одновременно.
alter table coinvestor_profit_tx add column period date;
create unique index coinvestor_profit_tx_period_key
  on coinvestor_profit_tx (coinvestor_id, period)
  where kind = 'accrual' and period is not null;
