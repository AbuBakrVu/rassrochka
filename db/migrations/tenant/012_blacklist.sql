alter table clients
  add column blacklisted_at timestamptz,
  add column blacklist_reason text;
