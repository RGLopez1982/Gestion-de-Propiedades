create table if not exists properties (
  id serial primary key,
  name text not null,
  location text not null,
  status text default 'Disponible',
  monthly_rate numeric default 0,
  occupancy integer,
  image text,
  department text,
  nightly_rate numeric default 0,
  capacity integer default 1,
  images text,
  created_at timestamptz default now()
);

create table if not exists tenants (
  id serial primary key,
  name text not null,
  email text,
  phone text,
  property_id integer references properties(id) on delete set null,
  status text default 'VIGENTE',
  since text,
  avatar text,
  source text,
  tags text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id serial primary key,
  date text not null,
  concept text not null,
  property_id integer references properties(id) on delete set null,
  booking_id integer,
  amount numeric not null,
  status text default 'Completado',
  type text default 'income',
  paid_by text,
  payment_method text,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id serial primary key,
  tenant text not null,
  property_id integer references properties(id) on delete set null,
  guests integer,
  check_in text not null,
  check_out text not null,
  status text default 'Confirmado',
  amount_total numeric default 0,
  amount_paid numeric default 0,
  refund_issued boolean default false,
  refund_amount numeric default 0,
  received_by text,
  booking_source text,
  payment_method text,
  receipt_data text,
  receipt_name text,
  receipt_files text,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_booking_id_fkey'
  ) then
    alter table transactions
      add constraint transactions_booking_id_fkey
      foreign key (booking_id) references bookings(id) on delete cascade;
  end if;
end $$;

create table if not exists events (
  id serial primary key,
  title text not null,
  description text,
  property_id integer references properties(id) on delete set null,
  date text not null,
  type text,
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

create table if not exists finance_cycles (
  id serial primary key,
  closed_at text not null,
  period_label text not null,
  income numeric not null default 0,
  expense numeric not null default 0,
  balance numeric not null default 0,
  owner_settlements text not null default '[]',
  payment_totals text not null default '[]',
  expense_rows text not null default '[]',
  transaction_count integer not null default 0,
  withdrawal_transaction_id integer references transactions(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists finance_cycle_items (
  id serial primary key,
  cycle_id integer references finance_cycles(id) on delete cascade,
  transaction_id integer references transactions(id) on delete cascade
);

create index if not exists bookings_property_dates_idx on bookings (property_id, check_in, check_out);
create index if not exists bookings_tenant_lower_idx on bookings (lower(tenant));
create index if not exists transactions_booking_idx on transactions (booking_id);
create index if not exists finance_cycles_closed_idx on finance_cycles (id desc);
