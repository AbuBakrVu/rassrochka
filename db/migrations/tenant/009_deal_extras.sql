-- Первоначальный взнос (был только в расчёте при создании, нигде не
-- сохранялся), свой шаблон напоминания на сделку (по умолчанию — общий
-- шаблон компании) и мягкое удаление (ошибочно созданная сделка прячется,
-- а не пропадает физически).

alter table deals add column down_payment numeric(12,2);
alter table deals add column reminder_template_id bigint references message_templates(id) on delete set null;
alter table deals add column deleted_at timestamptz;
