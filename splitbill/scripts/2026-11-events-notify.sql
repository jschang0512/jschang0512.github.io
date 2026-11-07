-- ============================================================
-- Split Bill — notify the group about a new event (2026-11)
--
-- Same shape as expenses and repayments: a trigger writes one notifications row per
-- recipient, then a webhook tells notify-push to send the rows nobody has pushed yet.
-- Everyone active in the group is told except the organizer.
--
-- The webhook reuses the arguments of the existing notify_expenses trigger, so the
-- function URL and its auth header are read from the database and never appear here.
-- ============================================================

create or replace function public.notify_event_created()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_actor text;
begin
  select coalesce(nullif(nickname, ''), name) into v_actor from public.members where id = new.created_by;
  insert into public.notifications (member_id, group_id, type, title, body, related_table, related_id, params)
  select m.id, new.group_id, 'event_created',
         coalesce(v_actor, '有人') || '開了新活動',
         new.title || '・' || new.event_date,
         'events', new.id,
         jsonb_build_object('actor', v_actor, 'desc', new.title, 'date', new.event_date)
  from public.members m
  where m.group_id = new.group_id and m.left_at is null and m.account_deleted_at is null
    and m.id <> new.created_by;
  return new;
end;
$$;
revoke execute on function public.notify_event_created() from public, anon, authenticated;

drop trigger if exists trg_notify_event on public.events;
create trigger trg_notify_event
  after insert on public.events
  for each row execute function public.notify_event_created();

do $$
declare
  v_args text[];
  v_list text;
begin
  select (string_to_array(encode(t.tgargs, 'escape'), '\000'))[1:t.tgnargs]
    into v_args
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'expenses' and t.tgname = 'notify_expenses';
  if v_args is null then raise exception 'notify_expenses webhook not found'; end if;
  select string_agg(quote_literal(replace(a, '\\', '\')), ', ') into v_list from unnest(v_args) a;
  execute 'drop trigger if exists notify_events on public.events';
  execute 'create trigger notify_events after insert on public.events for each row execute function supabase_functions.http_request(' || v_list || ')';
end;
$$;
