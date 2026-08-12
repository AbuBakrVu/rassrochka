-- Откат ошибочно принятого платежа. installment_number нужен, чтобы точно
-- находить и удалять начисления соинвесторам за конкретный отменённый
-- взнос (раньше номер был только в тексте note, не в отдельной колонке).

alter table coinvestor_profit_tx add column installment_number integer;
