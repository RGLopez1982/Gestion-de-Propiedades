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

create index if not exists finance_cycles_closed_idx on finance_cycles (id desc);
