-- Хранимый план графика платежей (lib/schedule.ts: ScheduleShape).
--
-- Обычная сделка сюда не пишется — её график вычисляется из суммы и срока.
-- План сохраняется, когда график меняют: реструктуризация, отсрочка,
-- гибкий график. Раньше реструктуризация хранила только «сколько было
-- месяцев до неё», и вторая реструктуризация пересчитывала суммы уже
-- оплаченных взносов неверно. deals.months всегда равен числу строк плана.

create table deal_plan (
  deal_id  text not null references deals(id) on delete cascade,
  n        int not null check (n >= 1),
  due_date date not null,
  amount   numeric(12,2) not null check (amount > 0),
  primary key (deal_id, n)
);
