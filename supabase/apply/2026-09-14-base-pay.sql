-- Base Pay apply script, 14 September 2026. Paste into the Supabase SQL Editor and run once (safe to re-run).
-- Same as supabase/migrations/20260914000000_base_pay.sql; the earlier 2026-09-13 script must already be applied.

-- USDC payments on Base (Base Pay), with refunds sent back to the paying wallet.
-- Each Base order carries an exact USDC amount (its price plus a sub-cent tag), so a verified payment can only match one order,
-- and each Base Pay payment id can settle at most one order. Additive and safe to re-run.

alter table public.slowrun_orders
  add column if not exists base_amount bigint,      -- exact USDC atomic units (6 decimals) this order must receive
  add column if not exists base_payment_id text,    -- Base Pay payment id (user operation hash)
  add column if not exists base_payer text;         -- verified sender of the USDC; refunds go back here

alter table public.slowrun_orders drop constraint if exists slowrun_orders_pay_with_check;
alter table public.slowrun_orders add constraint slowrun_orders_pay_with_check check (pay_with in ('card', 'stablecoin', 'base'));

create unique index if not exists slowrun_orders_base_payment_id on public.slowrun_orders (base_payment_id) where base_payment_id is not null;
-- Two pending Base orders can never ask for the same exact amount.
create unique index if not exists slowrun_orders_base_amount_pending on public.slowrun_orders (base_amount) where status = 'pending' and base_amount is not null;

alter table public.slowrun_refund_jobs add column if not exists broadcast_at bigint;

alter table public.slowrun_refund_jobs drop constraint if exists slowrun_refund_jobs_status_check;
alter table public.slowrun_refund_jobs add constraint slowrun_refund_jobs_status_check
  check (status in ('pending', 'submitted', 'succeeded', 'failed', 'awaiting_wallet', 'awaiting_payout', 'broadcasting'));
alter table public.slowrun_refund_jobs drop constraint if exists slowrun_refund_jobs_rail_check;
alter table public.slowrun_refund_jobs add constraint slowrun_refund_jobs_rail_check check (rail is null or rail in ('card', 'stablecoin', 'base'));

-- Links a Base Pay payment id to a pending Base order. Returns:
--   'attached' | 'same' (already linked to this order) | 'taken' (linked to another order)
--   'conflict' (this order is linked to a different payment) | 'not_base' | 'unknown'
create or replace function public.slowrun_attach_base_payment(p_order_id text, p_payment_id text)
returns text
language plpgsql
set search_path = public
as $$
declare
  o slowrun_orders%rowtype;
begin
  select * into o from slowrun_orders where id = p_order_id for update;
  if not found then return 'unknown'; end if;
  if o.pay_with <> 'base' then return 'not_base'; end if;
  if o.base_payment_id = p_payment_id then return 'same'; end if;
  if o.base_payment_id is not null then return 'conflict'; end if;
  if exists (select 1 from slowrun_orders where base_payment_id = p_payment_id) then return 'taken'; end if;
  update slowrun_orders set base_payment_id = p_payment_id where id = o.id;
  return 'attached';
end;
$$;

-- Unlinks a payment that failed onchain or did not match, so the sponsor can pay again. Only while the order is pending.
create or replace function public.slowrun_detach_base_payment(p_order_id text, p_payment_id text)
returns text
language plpgsql
set search_path = public
as $$
begin
  update slowrun_orders set base_payment_id = null
  where id = p_order_id and base_payment_id = p_payment_id and status = 'pending';
  if found then return 'detached'; end if;
  return 'skipped';
end;
$$;

-- Applies a verified Base Pay payment: records the paying wallet as the refund destination, then runs the normal atomic award
-- (ownership, outbid marking and refund queueing) with the payment id prefixed "base:".
create or replace function public.slowrun_award_base_payment(p_order_id text, p_payment_id text, p_payer text, p_now bigint, p_close bigint)
returns text
language plpgsql
set search_path = public
as $$
declare
  o slowrun_orders%rowtype;
begin
  select * into o from slowrun_orders where id = p_order_id for update;
  if not found then return 'unknown'; end if;
  if o.base_payment_id is distinct from p_payment_id then return 'mismatch'; end if;
  if o.base_payer is null then
    update slowrun_orders set base_payer = p_payer, refund_network = 'base', refund_address = p_payer where id = o.id;
  end if;
  return slowrun_award_payment(p_order_id, 'base:' || p_payment_id, p_now, p_close);
end;
$$;

-- Same as before, but keeps a rail already recorded on the job (a Base refund stays 'base').
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
  select * into o from slowrun_orders where id = j.order_id for update;
  select * into j from slowrun_refund_jobs where payment = p_payment for update;
  if j.status <> 'pending' or j.amount is null then return 'skipped'; end if;
  if o.refund_address is null then
    update slowrun_refund_jobs set status = 'awaiting_wallet', rail = coalesce(rail, 'stablecoin') where payment = p_payment;
    return 'awaiting_wallet';
  end if;
  update slowrun_refund_jobs
  set status = 'awaiting_payout', rail = coalesce(rail, 'stablecoin'), payout_network = o.refund_network, payout_address = o.refund_address
  where payment = p_payment;
  return 'awaiting_payout';
end;
$$;

-- Claims a Base refund for the server wallet to send. A job can be claimed once; it is never sent twice automatically.
create or replace function public.slowrun_claim_base_refund(p_payment text, p_now bigint)
returns text
language plpgsql
set search_path = public
as $$
begin
  update slowrun_refund_jobs set status = 'broadcasting', broadcast_at = p_now
  where payment = p_payment and status = 'awaiting_payout' and rail = 'base' and payout_address is not null;
  if found then return 'claimed'; end if;
  return 'skipped';
end;
$$;

-- Stores the transaction hash of a refund the server wallet has sent.
create or replace function public.slowrun_record_base_refund(p_payment text, p_reference text)
returns text
language plpgsql
set search_path = public
as $$
begin
  update slowrun_refund_jobs set payout_reference = p_reference
  where payment = p_payment and status = 'broadcasting' and payout_reference is null;
  if found then return 'recorded'; end if;
  return 'skipped';
end;
$$;

-- Marks a Base refund for operator review (the send failed, reverted, or its outcome is unknown).
create or replace function public.slowrun_fail_base_refund(p_payment text)
returns text
language plpgsql
set search_path = public
as $$
begin
  update slowrun_refund_jobs set status = 'failed' where payment = p_payment and status = 'broadcasting';
  if found then return 'failed'; end if;
  return 'skipped';
end;
$$;

-- An operator (or a confirmed server-wallet send) can complete a payout that is queued or being broadcast.
create or replace function public.slowrun_complete_payout(p_payment text, p_reference text, p_now bigint)
returns text
language plpgsql
set search_path = public
as $$
begin
  update slowrun_refund_jobs set status = 'succeeded', payout_reference = p_reference, completed = p_now
  where payment = p_payment and status in ('awaiting_payout', 'broadcasting');
  if found then return 'succeeded'; end if;
  if exists (select 1 from slowrun_refund_jobs where payment = p_payment and status = 'succeeded') then return 'already'; end if;
  return 'not_awaiting';
end;
$$;

revoke execute on function public.slowrun_attach_base_payment(text, text) from public, anon, authenticated;
revoke execute on function public.slowrun_detach_base_payment(text, text) from public, anon, authenticated;
revoke execute on function public.slowrun_award_base_payment(text, text, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.slowrun_route_stablecoin_refund(text) from public, anon, authenticated;
revoke execute on function public.slowrun_claim_base_refund(text, bigint) from public, anon, authenticated;
revoke execute on function public.slowrun_record_base_refund(text, text) from public, anon, authenticated;
revoke execute on function public.slowrun_fail_base_refund(text) from public, anon, authenticated;
revoke execute on function public.slowrun_complete_payout(text, text, bigint) from public, anon, authenticated;
grant execute on function public.slowrun_attach_base_payment(text, text) to service_role;
grant execute on function public.slowrun_detach_base_payment(text, text) to service_role;
grant execute on function public.slowrun_award_base_payment(text, text, text, bigint, bigint) to service_role;
grant execute on function public.slowrun_route_stablecoin_refund(text) to service_role;
grant execute on function public.slowrun_claim_base_refund(text, bigint) to service_role;
grant execute on function public.slowrun_record_base_refund(text, text) to service_role;
grant execute on function public.slowrun_fail_base_refund(text) to service_role;
grant execute on function public.slowrun_complete_payout(text, text, bigint) to service_role;

notify pgrst, 'reload schema';
