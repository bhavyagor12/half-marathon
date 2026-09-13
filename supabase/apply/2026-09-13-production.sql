-- Production apply script, 13 September 2026. Paste the whole file into the Supabase SQL Editor and run it once.
-- It is the pending migrations in order, and safe to re-run:
--   20260912010000_expand_spot_ids.sql + 20260912010100_seed_right_quad.sql  (right quad, spot 10, slot ID 9)
--   20260913000000_stablecoin_refund_wallets.sql                             (stablecoin refund wallets and payouts)
--   20260913010000_slowrun_visits.sql                                        (views, visitors, online now)
-- Source of truth stays in supabase/migrations; regenerate this file rather than editing it.

-- Right quad: allow slot ID 9 and seed it without touching existing owners.
alter table public.slowrun_slots drop constraint if exists slowrun_slots_id_check;
alter table public.slowrun_slots add constraint slowrun_slots_id_check check (id between 0 and 9);
insert into public.slowrun_slots (id) values (9) on conflict (id) do nothing;

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

-- Site views, unique visitors, and who is online now.
-- Visitor ids are random browser ids hashed on the server and sessions are random server ids; no IPs or user agents are stored.
-- Additive and safe to re-run.

create table if not exists public.slowrun_stats (
  id text primary key check (id = 'site'),
  views bigint not null default 0,
  visitors bigint not null default 0
);
insert into public.slowrun_stats (id) values ('site') on conflict (id) do nothing;

create table if not exists public.slowrun_visitors (
  visitor text primary key,
  first_seen bigint not null,
  last_seen bigint not null
);

create table if not exists public.slowrun_presence (
  session text primary key,
  last_seen bigint not null
);
create index if not exists slowrun_presence_last_seen on public.slowrun_presence (last_seen);

alter table public.slowrun_stats enable row level security;
alter table public.slowrun_visitors enable row level security;
alter table public.slowrun_presence enable row level security;
revoke all on public.slowrun_stats, public.slowrun_visitors, public.slowrun_presence from anon, authenticated;

-- The totals shown on the site. "Online" counts sessions seen within the last p_window milliseconds.
create or replace function public.slowrun_site_stats(p_now bigint, p_window bigint)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'views', s.views,
    'visitors', s.visitors,
    'online', (select count(*) from slowrun_presence where last_seen >= p_now - p_window)
  )
  from slowrun_stats s
  where s.id = 'site';
$$;

-- Counts one page view, counts the visitor if this is their first visit, and marks the session online.
create or replace function public.slowrun_record_visit(p_visitor text, p_session text, p_now bigint, p_window bigint)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  first_visit boolean;
begin
  insert into slowrun_visitors (visitor, first_seen, last_seen) values (p_visitor, p_now, p_now)
  on conflict (visitor) do update set last_seen = excluded.last_seen
  returning (xmax = 0) into first_visit;
  update slowrun_stats
  set views = views + 1, visitors = visitors + case when first_visit then 1 else 0 end
  where id = 'site';
  insert into slowrun_presence (session, last_seen) values (p_session, p_now)
  on conflict (session) do update set last_seen = excluded.last_seen;
  return slowrun_site_stats(p_now, p_window);
end;
$$;

-- Keeps a session online, or removes it when the tab is hidden or closed, and prunes sessions gone for two windows.
create or replace function public.slowrun_heartbeat(p_session text, p_now bigint, p_window bigint, p_leave boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if p_leave then
    delete from slowrun_presence where session = p_session;
  else
    insert into slowrun_presence (session, last_seen) values (p_session, p_now)
    on conflict (session) do update set last_seen = excluded.last_seen;
  end if;
  delete from slowrun_presence where last_seen < p_now - 2 * p_window;
  return slowrun_site_stats(p_now, p_window);
end;
$$;

revoke execute on function public.slowrun_site_stats(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.slowrun_record_visit(text, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.slowrun_heartbeat(text, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.slowrun_site_stats(bigint, bigint) to service_role;
grant execute on function public.slowrun_record_visit(text, text, bigint, bigint) to service_role;
grant execute on function public.slowrun_heartbeat(text, bigint, bigint, boolean) to service_role;

notify pgrst, 'reload schema';
