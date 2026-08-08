-- Временный пароль выдаёт администратор при заведении сотрудника; до его
-- смены пускаем только на страницу смены пароля.
alter table users add column must_change_password boolean not null default false;
