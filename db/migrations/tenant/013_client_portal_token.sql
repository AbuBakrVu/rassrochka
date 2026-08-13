alter table clients
  add column portal_token text unique default encode(gen_random_bytes(16), 'hex');

alter table clients
  alter column portal_token set not null;
