create table if not exists menu_link (
  id smallint primary key default 1 check (id = 1),
  secret text not null,
  created_at timestamptz not null default now()
);
