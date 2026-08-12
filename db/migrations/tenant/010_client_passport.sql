alter table clients
  add column middle_name          text,
  add column birth_date           date,
  add column passport_series      text,
  add column passport_number      text,
  add column passport_issued_by   text,
  add column passport_issued_at   date,
  add column registration_address text,
  add column living_address       text,
  add column inn                  text;
