-- ============================================================
-- Split Bill — close an event in one step (2026-11)
--
-- Closing used to be two requests from the app: insert the expense, then mark the event
-- closed. If the second one failed (network drop, app closed) the event stayed open and
-- pressing "close" again recorded the same expense twice.
--
-- close_event() does both inside one transaction and locks the event row first, so it is
-- all-or-nothing and a second call sees status <> 'open' and is refused. It runs as the
-- caller (security invoker): the existing RLS on events and expenses still decides what the
-- organizer may do; the function adds no extra rights.
-- ============================================================

create or replace function public.close_event(p_event_id uuid, p_total numeric, p_shares jsonb)
returns uuid language plpgsql security invoker set search_path to 'public' as $$
declare
  v_ev public.events%rowtype;
  v_me uuid := public.my_member_id();
  v_expense uuid;
begin
  select * into v_ev from public.events where id = p_event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if v_ev.created_by is distinct from v_me then raise exception 'event_not_organizer'; end if;
  if v_ev.status <> 'open' then raise exception 'event_already_closed'; end if;
  if p_total is null or p_total <= 0 then raise exception 'event_bad_amount'; end if;
  if jsonb_typeof(p_shares) is distinct from 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'event_bad_shares';
  end if;

  insert into public.expenses (group_id, amount, description, note, expense_date, created_by,
                               currency, category, payers, shares)
  values (v_ev.group_id, p_total, v_ev.title, v_ev.note, v_ev.event_date, v_me,
          v_ev.currency, 'general',
          jsonb_build_array(jsonb_build_object('member_id', v_me, 'amount', p_total)), p_shares)
  returning id into v_expense;

  update public.events set status = 'closed', expense_id = v_expense where id = p_event_id;
  return v_expense;
end;
$$;

revoke execute on function public.close_event(uuid, numeric, jsonb) from public, anon;
grant execute on function public.close_event(uuid, numeric, jsonb) to authenticated;
