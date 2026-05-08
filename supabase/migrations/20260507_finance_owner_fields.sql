alter table transactions add column if not exists paid_by text;
alter table transactions add column if not exists payment_method text;
alter table bookings add column if not exists refund_amount numeric default 0;

update properties
set monthly_rate = round(monthly_rate), nightly_rate = round(nightly_rate);

update bookings
set amount_total = round(amount_total), amount_paid = round(amount_paid);

update transactions
set amount = round(amount);
