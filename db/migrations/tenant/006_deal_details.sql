-- Данные сделки, которые мастер создания сделки уже собирал в форме, но
-- нигде не сохранял: описание, категория, город и поручители (были только
-- на экране «Обзор», при отправке молча терялись).

alter table deals add column description text;
alter table deals add column category text;
alter table deals add column city text;

create table deal_guarantors (
  id         bigserial primary key,
  deal_id    text not null references deals(id) on delete cascade,
  client_id  text not null references clients(id),
  created_at timestamptz not null default now(),
  unique (deal_id, client_id)
);

create index deal_guarantors_deal_id_idx on deal_guarantors (deal_id);
