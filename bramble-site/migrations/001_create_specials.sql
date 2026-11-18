create table if not exists specials (
  id bigserial primary key,
  special_date date not null,
  position smallint not null check (position between 1 and 3),
  name text not null,
  description text not null default '',
  price numeric(12, 2),
  unique (special_date, position)
);

create index if not exists specials_special_date_idx on specials (special_date);
