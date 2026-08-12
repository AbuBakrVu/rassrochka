-- Реструктуризация: остаток долга на дату реструктуризации размазывается
-- по новому графику из N месяцев начиная с выбранной даты. Прежние взносы
-- (уже отмеченные оплаченными) остаются как были — не пересчитываются.
--
-- original_months хранит months ДО реструктуризации — без него нельзя
-- корректно восстановить суммы уже прошедших взносов (см. lib/schedule.ts).

alter table deals add column original_months integer;
alter table deals add column restructured_months integer;
alter table deals add column restructured_from date;
