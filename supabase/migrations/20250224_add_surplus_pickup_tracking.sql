-- Add pickup tracking to surplus claims
alter table surplus_claims
  add column if not exists picked_up boolean default false,
  add column if not exists picked_up_qty numeric(10,2) default 0 check (picked_up_qty >= 0),
  add column if not exists picked_up_by text,
  add column if not exists picked_up_at timestamptz;

-- Keep a reasonable default for new rows
update surplus_claims
set picked_up_qty = coalesce(picked_up_qty, 0)
where picked_up_qty is null;

create index if not exists idx_surplus_claims_picked on surplus_claims(picked_up);
