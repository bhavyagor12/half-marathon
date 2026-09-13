-- Stablecoin payments: refund wallets and operator payouts.
-- Dodo's refund API has no destination field, and a stablecoin payment may come from a one-time wallet, so each order keeps the
-- wallet its refund goes to. Stablecoin refunds leave the automatic queue and wait for a wallet, then for an operator payout.
-- Additive and safe to re-run. Apply after 20260912010100_seed_right_quad.sql.

alter table public.slowrun_orders
  add column if not exists pay_with text not null default 'card',
  add column if not exists refund_network text,
  add column if not exists refund_address text,
  add column if not exists payment_method text;

do $$ begin
  alter table public.slowrun_orders add constraint slowrun_orders_pay_with_check check (pay_with in ('card', 'stablecoin'));
exception when duplicate_object then null; end $$;

-- USDC refund networks. EVM addresses are 20 bytes of hex; Solana addresses are base58 public keys.
do $$ begin
  alter table public.slowrun_orders add constraint slowrun_orders_refund_wallet_check check (
    (refund_network is null and refund_address is null)
    or (refund_network in ('base', 'ethereum', 'polygon') and refund_address ~ '^0x[0-9a-fA-F]{40}$')
    or (refund_network = 'solana' and refund_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.slowrun_orders add constraint slowrun_orders_stablecoin_wallet_check check (pay_with <> 'stablecoin' or refund_address is not null);
exception when duplicate_object then null; end $$;

alter table public.slowrun_refund_jobs
  add column if not exists rail text,
  add column if not exists payout_network text,
  add column if not exists payout_address text,
  add column if not exists payout_reference text,
  add column if not exists completed bigint;

alter table public.slowrun_refund_jobs drop constraint if exists slowrun_refund_jobs_status_check;
alter table public.slowrun_refund_jobs add constraint slowrun_refund_jobs_status_check
  check (status in ('pending', 'submitted', 'succeeded', 'failed', 'awaiting_wallet', 'awaiting_payout'));

do $$ begin
  alter table public.slowrun_refund_jobs add constraint slowrun_refund_jobs_rail_check check (rail is null or rail in ('card', 'stablecoin'));
exception when duplicate_object then null; end $$;

create index if not exists slowrun_refund_jobs_awaiting on public.slowrun_refund_jobs (created)
  where status in ('awaiting_wallet', 'awaiting_payout');

-- Same as the 10-argument reservation, plus how the bid will be paid and its refund wallet.
-- The original overload stays so the currently deployed app keeps working until this code ships.
create or replace function public.slowrun_reserve_slot(
  p_order_id text, p_slot smallint, p_version integer, p_amount integer,
  p_brand text, p_tagline text, p_website text, p_token_hash text, p_now bigint, p_expires bigint,
  p_pay_with text, p_refund_network text, p_refund_address text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  s slowrun_slots%rowtype;
begin
  select * into s from slowrun_slots where id = p_slot for update;
  if not found or s.version <> p_version then return 'stale'; end if;
  if s.reserved_until >= p_now then return 'busy'; end if;
  update slowrun_slots set order_id = p_order_id, reserved_until = p_expires where id = p_slot;
  insert into slowrun_orders (
    id, slot, amount, brand, tagline, website, token_hash, status, expires, created, expected_version, previous_id,
    pay_with, refund_network, refund_address
  )
  values (
    p_order_id, p_slot, p_amount, p_brand, p_tagline, p_website, p_token_hash, 'pending', p_expires, p_now, p_version, s.owner_id,
    p_pay_with, p_refund_network, p_refund_address
  );
  return 'reserved';
end;
$$;

-- Saves or replaces an order's refund wallet. Returns:
--   'queued'  a refund that was waiting for this wallet is back in the queue
--   'saved'   stored for a future refund
--   'locked'  a refund for this order is already submitted, paid, or waiting on an operator payout
--   'unknown' no such order
create or replace function public.slowrun_set_refund_wallet(p_order_id text, p_network text, p_address text)
returns text
language plpgsql
set search_path = public
as $$
declare
  o slowrun_orders%rowtype;
begin
  select * into o from slowrun_orders where id = p_order_id for update;
  if not found then return 'unknown'; end if;
  if exists (
    select 1 from slowrun_refund_jobs where order_id = o.id and status in ('submitted', 'succeeded', 'awaiting_payout')
  ) then return 'locked'; end if;
  update slowrun_orders set refund_network = p_network, refund_address = p_address where id = o.id;
  update slowrun_refund_jobs set status = 'pending' where order_id = o.id and status = 'awaiting_wallet';
  if found then return 'queued'; end if;
  return 'saved';
end;
$$;

-- Takes a pending stablecoin refund (amount already frozen) out of the automatic queue. Returns:
--   'awaiting_payout' the payer's wallet is snapshotted for the operator to pay
--   'awaiting_wallet' the payer has not given a wallet yet
--   'skipped'         the job is not pending or has no frozen amount
create or replace function public.slowrun_route_stablecoin_refund(p_payment text)
returns text
language plpgsql
set search_path = public
as $$
declare
  j slowrun_refund_jobs%rowtype;
  o slowrun_orders%rowtype;
begin
  select * into j from slowrun_refund_jobs where payment = p_payment;
  if not found then return 'skipped'; end if;
  -- Lock the order before the job, in the same order as slowrun_set_refund_wallet.
  select * into o from slowrun_orders where id = j.order_id for update;
  select * into j from slowrun_refund_jobs where payment = p_payment for update;
  if j.status <> 'pending' or j.amount is null then return 'skipped'; end if;
  if o.refund_address is null then
    update slowrun_refund_jobs set status = 'awaiting_wallet', rail = 'stablecoin' where payment = p_payment;
    return 'awaiting_wallet';
  end if;
  update slowrun_refund_jobs
  set status = 'awaiting_payout', rail = 'stablecoin', payout_network = o.refund_network, payout_address = o.refund_address
  where payment = p_payment;
  return 'awaiting_payout';
end;
$$;

-- Records an operator's stablecoin payout by its transaction reference. Returns 'succeeded', 'already' or 'not_awaiting'.
create or replace function public.slowrun_complete_payout(p_payment text, p_reference text, p_now bigint)
returns text
language plpgsql
set search_path = public
as $$
begin
  update slowrun_refund_jobs set status = 'succeeded', payout_reference = p_reference, completed = p_now
  where payment = p_payment and status = 'awaiting_payout';
  if found then return 'succeeded'; end if;
  if exists (select 1 from slowrun_refund_jobs where payment = p_payment and status = 'succeeded') then return 'already'; end if;
  return 'not_awaiting';
end;
$$;

revoke execute on function public.slowrun_reserve_slot(text, smallint, integer, integer, text, text, text, text, bigint, bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.slowrun_set_refund_wallet(text, text, text) from public, anon, authenticated;
revoke execute on function public.slowrun_route_stablecoin_refund(text) from public, anon, authenticated;
revoke execute on function public.slowrun_complete_payout(text, text, bigint) from public, anon, authenticated;
grant execute on function public.slowrun_reserve_slot(text, smallint, integer, integer, text, text, text, text, bigint, bigint, text, text, text) to service_role;
grant execute on function public.slowrun_set_refund_wallet(text, text, text) to service_role;
grant execute on function public.slowrun_route_stablecoin_refund(text) to service_role;
grant execute on function public.slowrun_complete_payout(text, text, bigint) to service_role;

-- Let the Supabase API see the new columns and functions immediately.
notify pgrst, 'reload schema';
