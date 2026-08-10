-- Шаблоны сообщений для напоминаний клиентам. Отправка идёт через
-- WhatsApp-ссылку (wa.me) — у компании нет отдельного договора с
-- WhatsApp Business API, поэтому менеджер отправляет сообщение сам,
-- а мы подставляем текст и логируем факт в историю сделки.

create table message_templates (
  id         bigserial primary key,
  name       text not null,
  body       text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

insert into message_templates (name, body, is_default) values (
  'Напоминание об оплате',
  'Здравствуйте, {имя}! Напоминаем про платёж {сумма} по рассрочке «{товар}» — срок {дата}. Если уже оплатили, пожалуйста, не обращайте внимания.',
  true
);
