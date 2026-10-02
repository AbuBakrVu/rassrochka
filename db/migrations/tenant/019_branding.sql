-- Оформление компании: свой логотип и основной цвет (Настройки → Оформление).
--
-- Цвет — ключ 'brand_color' в settings (строка "#RRGGBB"); нет ключа —
-- стандартная бирюзовая тема. Логотип — одна картинка до 500 КБ прямо в
-- базе: так он попадает в резервные копии вместе с остальными данными и
-- переезжает на новый сервер без отдельной папки с файлами.

create table company_logo (
  id           smallint primary key default 1 check (id = 1),
  data         bytea not null,
  content_type text not null
               check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  updated_at   timestamptz not null default now()
);
