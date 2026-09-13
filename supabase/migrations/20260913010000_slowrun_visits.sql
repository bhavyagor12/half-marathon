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
