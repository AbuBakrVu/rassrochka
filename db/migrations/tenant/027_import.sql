-- Импорт клиентов и сделок из Excel. Перенесённые сделки помечаются
-- источником 'import': по ним не проводятся закупка и прошлые платежи в
-- кассу (деньги уже прошли в старой системе) и не начисляется доля
-- соинвесторам за взносы, оплаченные до переноса.

alter table deals drop constraint deals_source_check;
alter table deals add constraint deals_source_check
  check (source in ('crm', 'online', 'import'));
