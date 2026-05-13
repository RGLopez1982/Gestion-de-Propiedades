alter table properties enable row level security;
alter table tenants enable row level security;
alter table transactions enable row level security;
alter table bookings enable row level security;
alter table events enable row level security;
alter table settings enable row level security;
alter table finance_cycles enable row level security;
alter table finance_cycle_items enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
  end if;
end $$;
