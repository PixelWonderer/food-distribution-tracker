-- Surplus distribution tables

create table if not exists surplus_groups (
  id uuid primary key default uuid_generate_v4(),
  group_name text unique not null,
  date_added timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_surplus_groups_active on surplus_groups(is_active);

create table if not exists surplus_claims (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  week_date date not null,
  group_name text not null,
  quantity_claimed numeric(10, 2) not null check (quantity_claimed > 0),
  claimed_by text,
  claimed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_surplus_claims_week_date on surplus_claims(week_date);
create index if not exists idx_surplus_claims_order_id on surplus_claims(order_id);
create index if not exists idx_surplus_claims_group_name on surplus_claims(group_name);
