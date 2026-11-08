-- ============================================================
-- Split Bill — fixed costs v2 (2026-11)
--
-- 1. Amount that changes every period (utilities): variable_amount. The app does not
--    auto-record these; on the due date everyone involved is asked to fill in the amount.
--    `amount` keeps the latest / estimated amount.
-- 2. Yearly schedule: interval_unit 'yearly' + interval_month.
-- 3. Unequal split: split_mode ('equal' | 'ratio' | 'amount') and split_weights for ratio.
--    shares keeps the per-person amounts for the current amount as before; a new amount is
--    spread in the same proportions.
-- 4. Stop after a date or after N periods: end_date / total_count / generated_count.
-- 7. Price change from a later period: next_amount + next_amount_from.
-- 9. Reminder the day before (and "please fill the amount" on the due date for variable
--    ones): a daily pg_cron job writes notifications and asks notify-push to send them.
--
-- schedule_rev is bumped by the new app every time it moves next_due_date. Older cached
-- app versions do not know these features; the guard trigger stops them from moving the
-- schedule of a template that uses any of them (their claim fails, nothing is recorded).
-- ============================================================

alter table public.recurring_expenses
  add column if not exists variable_amount boolean not null default false,
  add column if not exists interval_month integer,
  add column if not exists split_mode text not null default 'equal',
  add column if not exists split_weights jsonb,
  add column if not exists end_date date,
  add column if not exists total_count integer,
  add column if not exists generated_count integer not null default 0,
  add column if not exists next_amount numeric,
  add column if not exists next_amount_from date,
  add column if not exists reminded_for date,
  add column if not exists schedule_rev integer not null default 0;

alter table public.recurring_expenses drop constraint if exists recurring_expenses_interval_unit_check;
alter table public.recurring_expenses add constraint recurring_expenses_interval_unit_check
  check (interval_unit in ('monthly', 'weekly', 'yearly'));
alter table public.recurring_expenses drop constraint if exists recurring_expenses_interval_month_check;
alter table public.recurring_expenses add constraint recurring_expenses_interval_month_check
  check (interval_month is null or interval_month between 1 and 12);
alter table public.recurring_expenses drop constraint if exists recurring_expenses_yearly_month_check;
alter table public.recurring_expenses add constraint recurring_expenses_yearly_month_check
  check (interval_unit <> 'yearly' or interval_month is not null);
alter table public.recurring_expenses drop constraint if exists recurring_expenses_split_mode_check;
alter table public.recurring_expenses add constraint recurring_expenses_split_mode_check
  check (split_mode in ('equal', 'ratio', 'amount'));
alter table public.recurring_expenses drop constraint if exists recurring_expenses_total_count_check;
alter table public.recurring_expenses add constraint recurring_expenses_total_count_check
  check (total_count is null or total_count > 0);
alter table public.recurring_expenses drop constraint if exists recurring_expenses_next_amount_check;
alter table public.recurring_expenses add constraint recurring_expenses_next_amount_check
  check (next_amount is null or (next_amount > 0 and next_amount_from is not null));

-- ---------- guard against old app versions ----------
create or replace function public.recurring_schedule_guard()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.next_due_date is distinct from old.next_due_date
     and new.schedule_rev = old.schedule_rev
     and (old.variable_amount or old.interval_unit = 'yearly' or old.end_date is not null
          or old.total_count is not null or old.next_amount is not null) then
    raise exception 'this fixed cost needs the latest app version' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recurring_schedule_guard on public.recurring_expenses;
create trigger trg_recurring_schedule_guard
  before update on public.recurring_expenses
  for each row execute function public.recurring_schedule_guard();

-- ---------- daily reminders ----------
create or replace function public.recurring_daily_reminders()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_today date := (now() at time zone 'Asia/Taipei')::date;
  v_args text[];
  r record;
  v_amount numeric;
  v_kind text;
  v_n integer := 0;
begin
  -- notify-push URL and auth header come from the existing expenses webhook
  select (string_to_array(encode(t.tgargs, 'escape'), '\000'))[1:t.tgnargs]
    into v_args
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'expenses' and t.tgname = 'notify_expenses';

  for r in
    select * from public.recurring_expenses
     where active
       and reminded_for is distinct from next_due_date
       and (end_date is null or next_due_date <= end_date)
       and ((not variable_amount and next_due_date = v_today + 1)
         or (variable_amount and next_due_date <= v_today))
  loop
    v_amount := case when r.next_amount is not null and r.next_amount_from <= r.next_due_date
                     then r.next_amount else r.amount end;
    v_kind := case when r.variable_amount then 'recurring_need_amount' else 'recurring_upcoming' end;

    insert into public.notifications (member_id, group_id, type, title, body, related_table, related_id, params)
    select m.id, r.group_id, v_kind,
           case when r.variable_amount then r.description || '該填金額了'
                else '明天會自動記錄「' || r.description || '」' end,
           case when r.variable_amount then '這期金額不固定，點開填好就會記帳'
                else notif_money(v_amount, r.currency)
                     || case when coalesce(s.share, 0) > 0
                             then '（你分攤其中 ' || notif_money(s.share * v_amount / r.amount, r.currency) || '）'
                             else '' end end,
           'recurring_expenses', r.id,
           jsonb_build_object('desc', r.description, 'amount', v_amount, 'currency', r.currency,
                              'date', r.next_due_date,
                              'share', round(coalesce(s.share, 0) * v_amount / r.amount, 2))
      from public.members m
      left join lateral (
        select sum((x->>'amount')::numeric) as share
          from jsonb_array_elements(r.shares) x
         where (x->>'member_id')::uuid = m.id
      ) s on true
     where m.group_id = r.group_id and m.left_at is null and m.account_deleted_at is null
       and (exists (select 1 from jsonb_array_elements(r.shares) x where (x->>'member_id')::uuid = m.id)
         or exists (select 1 from jsonb_array_elements(r.payers) x where (x->>'member_id')::uuid = m.id));

    update public.recurring_expenses set reminded_for = r.next_due_date where id = r.id;

    if v_args is not null then
      perform net.http_post(
        url := v_args[1],
        headers := replace(v_args[3], '\\', '\')::jsonb,
        body := jsonb_build_object('type', 'INSERT', 'table', 'recurring_expenses',
                                   'record', jsonb_build_object('id', r.id, 'currency', r.currency))
      );
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.recurring_daily_reminders() from public, anon, authenticated;

-- 09:00 Taiwan time
select cron.schedule('recurring-reminders', '0 1 * * *', 'select public.recurring_daily_reminders()');
