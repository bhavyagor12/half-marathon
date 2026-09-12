-- Sponsor my slow run: auction storage on Supabase.
-- This project is shared with other apps, so the migration is additive only and every object is prefixed "slowrun".
-- Paste the whole file into the Supabase SQL Editor and run it once; it is safe to re-run.
-- Times are epoch milliseconds and prices are USD cents, matching the application code.

-- Spots 0–7 are the tee, 8 is the premium shorts spot.
create table if not exists public.slowrun_slots (
  id smallint primary key check (id between 0 and 8),
  order_id text,
  owner_id text,
  version integer not null default 0,
  reserved_until bigint not null default 0,
  paid boolean not null default false
);
insert into public.slowrun_slots (id) select generate_series(0, 8) on conflict (id) do nothing;

-- An order's id is the SHA-256 of the buyer's browser capability token.
create table if not exists public.slowrun_orders (
  id text primary key,
  slot smallint not null references public.slowrun_slots (id),
  amount integer not null check (amount > 0),
  brand text not null,
  tagline text not null,
  website text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'outbid', 'unfulfilled')),
  expected_version integer not null default 0,
  previous_id text references public.slowrun_orders (id),
  session text,
  checkout_url text,
  payment text unique,
  logo text,
  expires bigint not null,
  created bigint not null
);
create index if not exists slowrun_orders_slot_status on public.slowrun_orders (slot, status);

create table if not exists public.slowrun_refund_jobs (
  payment text primary key,
  order_id text not null references public.slowrun_orders (id),
  mode text not null check (mode in ('outbid', 'unfulfilled')),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'succeeded', 'failed')),
  amount integer,
  fee integer,
  refund_id text,
  created bigint not null
);
create index if not exists slowrun_refund_jobs_pending on public.slowrun_refund_jobs (created) where status = 'pending';

create table if not exists public.slowrun_rate_limits (
  key text primary key,
  count integer not null,
  expires bigint not null
);

-- Only the server (service role) may touch these tables. RLS with no policies blocks the public anon key.
alter table public.slowrun_slots enable row level security;
alter table public.slowrun_orders enable row level security;
alter table public.slowrun_refund_jobs enable row level security;
alter table public.slowrun_rate_limits enable row level security;
revoke all on public.slowrun_slots, public.slowrun_orders, public.slowrun_refund_jobs, public.slowrun_rate_limits from anon, authenticated;

-- Counts a request in a one-minute window and returns the running total.
create or replace function public.slowrun_hit_rate_limit(p_key text, p_now bigint)
returns integer
language plpgsql
set search_path = public
as $$
declare
  hits integer;
begin
  delete from slowrun_rate_limits where expires < p_now;
  insert into slowrun_rate_limits as l (key, count, expires) values (p_key, 1, p_now + 120000)
  on conflict (key) do update set count = l.count + 1
  returning l.count into hits;
  return hits;
end;
$$;

-- Atomically reserves a spot for checkout. The caller prices the bid from the owner it read at p_version;
-- ownership changes always bump the version, so a matching version proves that price is still current.
-- Returns 'reserved', 'stale' (someone won the spot meanwhile) or 'busy' (another checkout holds it).
create or replace function public.slowrun_reserve_slot(
  p_order_id text, p_slot smallint, p_version integer, p_amount integer,
  p_brand text, p_tagline text, p_website text, p_token_hash text, p_now bigint, p_expires bigint
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
  insert into slowrun_orders (id, slot, amount, brand, tagline, website, token_hash, status, expires, created, expected_version, previous_id)
  values (p_order_id, p_slot, p_amount, p_brand, p_tagline, p_website, p_token_hash, 'pending', p_expires, p_now, p_version, s.owner_id);
  return 'reserved';
end;
$$;

-- Applies a verified Dodo payment in one transaction. Returns:
--   'paid'        the bid won; the previous owner (if any) is marked outbid and queued for a fee-adjusted refund
--   'replay'      this payment was already applied
--   'unfulfilled' the checkout expired, went stale, or arrived after bidding closed; queued for a full refund
--   'duplicate'   a second payment for an order that was already settled; queued for a full refund
--   'unknown'     no such order
create or replace function public.slowrun_award_payment(p_order_id text, p_payment text, p_now bigint, p_close bigint)
returns text
language plpgsql
set search_path = public
as $$
declare
  o slowrun_orders%rowtype;
begin
  select * into o from slowrun_orders where id = p_order_id for update;
  if not found then return 'unknown'; end if;
  if o.payment = p_payment then return 'replay'; end if;
  if o.status <> 'pending' then
    insert into slowrun_refund_jobs (payment, order_id, mode, status, created)
    values (p_payment, o.id, 'unfulfilled', 'pending', p_now) on conflict (payment) do nothing;
    return 'duplicate';
  end if;
  if p_now < p_close then
    update slowrun_slots set owner_id = o.id, paid = true, reserved_until = 0, version = version + 1
    where id = o.slot and order_id = o.id and version = o.expected_version;
    if found then
      update slowrun_orders set status = 'paid', payment = p_payment where id = o.id;
      if o.previous_id is not null then
        insert into slowrun_refund_jobs (payment, order_id, mode, status, created)
        select payment, id, 'outbid', 'pending', p_now from slowrun_orders
        where id = o.previous_id and status = 'paid' and payment is not null
        on conflict (payment) do nothing;
        update slowrun_orders set status = 'outbid' where id = o.previous_id and status = 'paid';
      end if;
      return 'paid';
    end if;
  end if;
  update slowrun_orders set status = 'unfulfilled', payment = p_payment where id = o.id;
  insert into slowrun_refund_jobs (payment, order_id, mode, status, created)
  values (p_payment, o.id, 'unfulfilled', 'pending', p_now) on conflict (payment) do nothing;
  return 'unfulfilled';
end;
$$;

revoke execute on function public.slowrun_hit_rate_limit(text, bigint) from public, anon, authenticated;
revoke execute on function public.slowrun_reserve_slot(text, smallint, integer, integer, text, text, text, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.slowrun_award_payment(text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.slowrun_hit_rate_limit(text, bigint) to service_role;
grant execute on function public.slowrun_reserve_slot(text, smallint, integer, integer, text, text, text, text, bigint, bigint) to service_role;
grant execute on function public.slowrun_award_payment(text, text, bigint, bigint) to service_role;

-- Public-read logo bucket. Uploads go through the server with the service role key; there are no client write policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slowrun-logos', 'slowrun-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
