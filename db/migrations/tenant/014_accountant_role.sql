alter table users drop constraint users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'manager', 'accountant'));
