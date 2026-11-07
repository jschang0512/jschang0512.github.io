-- ============================================================
-- Split Bill — group events with sign-up (2026-11)
--
-- An event collects who is coming; closing it creates one normal expense from the
-- client (organizer paid, attendees share), so debts, repayments and reminders all
-- keep working from the expenses table. Nothing here touches existing tables.
--
-- 1. Only members of the active group can see an event.
-- 2. Only the organizer can edit, close or delete it.
-- 3. Each member can only change their own sign-up.
-- 4. Closed events, passed deadlines and full events are enforced by a trigger,
--    so two people signing up for the last seat cannot both get in.
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.members(id),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  event_date date not null,
  location text check (char_length(location) <= 120),
  note text check (char_length(note) <= 500),
  currency text not null default 'TWD',
  fee_mode text not null check (fee_mode in ('per_person', 'split_total')),
  fee_amount numeric not null check (fee_amount > 0),
  capacity integer check (capacity > 0),
  deadline date,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists events_group_date_idx on public.events (group_id, event_date);

create table if not exists public.event_registrations (
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null check (status in ('going', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index if not exists event_registrations_member_idx on public.event_registrations (member_id);

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

create policy events_select_own_group on public.events for select
  using (group_id = my_group_id());
create policy events_insert_own_group on public.events for insert
  with check (created_by = my_member_id() and group_id = my_group_id());
create policy events_update_organizer on public.events for update
  using (group_id = my_group_id() and created_by = my_member_id())
  with check (group_id = my_group_id() and created_by = my_member_id());
create policy events_delete_organizer on public.events for delete
  using (group_id = my_group_id() and created_by = my_member_id());

create policy event_registrations_select_own_group on public.event_registrations for select
  using (exists (select 1 from public.events e where e.id = event_id and e.group_id = my_group_id()));
create policy event_registrations_insert_self on public.event_registrations for insert
  with check (member_id = my_member_id()
    and exists (select 1 from public.events e where e.id = event_id and e.group_id = my_group_id()));
create policy event_registrations_update_self on public.event_registrations for update
  using (member_id = my_member_id())
  with check (member_id = my_member_id()
    and exists (select 1 from public.events e where e.id = event_id and e.group_id = my_group_id()));

-- security definer: it has to lock the event row, and row locks follow the update
-- policy, which only the organizer passes. The lock is what makes the seat count safe.
create or replace function public.event_registration_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_event public.events;
  v_taken integer;
begin
  select * into v_event from public.events where id = new.event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if v_event.status <> 'open' then raise exception 'event_closed'; end if;
  if v_event.deadline is not null and v_event.deadline < (now() at time zone 'Asia/Taipei')::date then
    raise exception 'event_deadline_passed';
  end if;
  if new.status = 'going' and v_event.capacity is not null
     and (tg_op = 'INSERT' or old.status <> 'going') then
    select count(*) into v_taken from public.event_registrations
      where event_id = new.event_id and status = 'going';
    if v_taken >= v_event.capacity then raise exception 'event_full'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.event_registration_guard() from public, anon, authenticated;

drop trigger if exists event_registration_guard on public.event_registrations;
create trigger event_registration_guard
  before insert or update on public.event_registrations
  for each row execute function public.event_registration_guard();

grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update on public.event_registrations to authenticated;
revoke all on public.events, public.event_registrations from anon;
