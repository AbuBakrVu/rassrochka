-- Приём клиентов: документы, согласие на обработку персональных данных,
-- онлайн-заявка.

-- Файлы: фото паспорта и документов клиента, фото товара по сделке.
-- Хранятся в базе (как логотип), чтобы попадать в резервные копии и
-- переезжать на новый сервер вместе с данными. Не больше 5 МБ на файл.
create table attachments (
  id           bigserial primary key,
  client_id    text references clients(id) on delete cascade,
  deal_id      text references deals(id) on delete cascade,
  kind         text not null check (kind in ('passport', 'document', 'product', 'other')),
  name         text not null,
  content_type text not null
               check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size         int not null check (size > 0 and size <= 5242880),
  data         bytea not null,
  user_id      bigint references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (client_id is not null or deal_id is not null)
);

create index attachments_client_idx on attachments (client_id);
create index attachments_deal_idx on attachments (deal_id);

-- Согласие на обработку персональных данных (152-ФЗ): когда и как получено.
-- null — отметки нет, менеджер увидит предупреждение в карточке.
alter table clients add column consent_at timestamptz;
alter table clients add column consent_source text
  check (consent_source is null or consent_source in ('paper', 'online'));

-- Откуда пришла сделка: из CRM или онлайн-заявкой со страницы /apply
alter table deals add column source text not null default 'crm'
  check (source in ('crm', 'online'));

-- Онлайн-заявка и калькулятор для клиентов (/apply): выключены, пока
-- администратор не включит их в настройках
insert into settings (key, value) values
  ('apply', '{"enabled": false, "markupPct": 15, "terms": [3, 6, 9, 12], "minDownPct": 0}'::jsonb),
  ('portal_show_limit', 'true'::jsonb)
on conflict (key) do nothing;
