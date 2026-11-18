create table if not exists daily_specials (
  id smallint primary key default 1 check (id = 1),
  special_date date not null,
  items jsonb not null,
  updated_at timestamptz not null default now()
);
