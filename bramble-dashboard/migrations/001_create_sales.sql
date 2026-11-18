create table if not exists sales (
  id bigserial primary key,
  sale_date date not null,
  item text not null,
  quantity numeric(12, 2) not null default 1,
  revenue numeric(12, 2) not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists sales_sale_date_idx on sales (sale_date);
