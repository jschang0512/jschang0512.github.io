-- ============================================================
-- Split Bill — notification rules (2026-10)
-- Applied to the Supabase project as migration "notifications_params_and_rules".
--
-- 1. Recurring auto-records produce ONE notification (type recurring_generated)
--    from the trigger, to everyone involved including the creator; the client no
--    longer calls notify_recurring_generated (kept as a no-op for cached clients).
-- 2. Edits notify only when something that matters changed
--    (expenses: amount, currency, payers, shares, description, date;
--     repayments: amount, currency, from, to, date). People added to / removed
--    from an expense's split are told so.
-- 3. Each recipient's row carries params written from their point of view
--    (their share, what they paid, who they owe, old amount…). The app and the
--    push service worker build the text in the reader's language from type +
--    params (notif-text.js); title/body hold a Chinese fallback for old clients.
-- 4. Amounts use the currency symbol and separators.
-- 5. "Yourself" = created_by everywhere (client realtime toast aligned).
-- 6. Notifications older than 30 days are deleted daily.
-- 7. pushed_at: notify-push / send-reminder push exactly the rows written here
--    (claiming them atomically), so the push text never drifts from the bell.
-- ============================================================

alter table public.notifications add column if not exists params jsonb;
alter table public.notifications add column if not exists pushed_at timestamptz;
update public.notifications set pushed_at = created_at where pushed_at is null;
create index if not exists notifications_unpushed_idx
  on public.notifications (related_table, related_id) where pushed_at is null;

create or replace function public.notif_money(p_amount numeric, p_currency text)
returns text language sql immutable set search_path to 'public' as $$
  select coalesce(
           jsonb_build_object(
             'TWD','NT$','JPY','¥','KRW','₩','CNY','CN¥','HKD','HK$','MOP','MOP$','USD','$',
             'VND','₫','THB','฿','PHP','₱','SGD','S$','MYR','RM','IDR','Rp','KHR','៛','EUR','€',
             'GBP','£','CHF','Fr','AUD','A$','NZD','NZ$','TRY','₺','CZK','Kč','HUF','Ft',
             'SEK','kr','NOK','kr','DKK','kr','ISK','kr') ->> p_currency,
           coalesce(p_currency, '') || ' ')
      || case when p_currency in ('TWD','JPY','KRW','VND','IDR','KHR','HUF','ISK')
                or round(p_amount, 2) = trunc(p_amount)
              then to_char(round(p_amount), 'FM999,999,999,990')
              else to_char(round(p_amount, 2), 'FM999,999,999,990.00') end
$$;

-- same cleanup the client does: drop hidden AI data / cross-currency markers, keep the first line
create or replace function public.notif_clean_desc(p text)
returns text language sql immutable set search_path to 'public' as $$
  select btrim(replace(split_part(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p, ''), '<!--.*?-->', '', 'g'),
        'AI_RECEIPT_DATA:.*$', '', 'g'),
      '\s*\[xcur[:_][^\]]+\]', '', 'gi'),
    E'\n', 1), '(AI自動拆單)', ''))
$$;

-- Chinese fallback text; mirrors splitbillNotifText() in notif-text.js (zh-Hant)
create or replace function public.notif_text_zh(p_kind text, p jsonb, out title text, out body text)
language plpgsql immutable set search_path to 'public' as $function$
declare
  v_cur text := p->>'currency';
  v_zero boolean := (p->>'currency') in ('TWD','JPY','KRW','VND','IDR','KHR','HUF','ISK');
  v_actor text := coalesce(nullif(p->>'actor', ''), '有人');
  v_desc text := coalesce(nullif(p->>'desc', ''), '支出');
  v_amount text := notif_money((p->>'amount')::numeric, v_cur);
  v_share numeric := coalesce((p->>'share')::numeric, 0);
  v_paid numeric := coalesce((p->>'paid')::numeric, 0);
  v_diff numeric;
  v_mine text;
  v_head text;
begin
  v_share := case when v_zero then round(v_share) else round(v_share, 2) end;
  v_paid := case when v_zero then round(v_paid) else round(v_paid, 2) end;
  v_diff := v_paid - v_share;

  if v_paid > 0 then
    v_mine := case when v_share > 0 then '（你分攤其中 ' || notif_money(v_share, v_cur) || '）' else '' end
           || E'\n你先付 ' || notif_money(v_paid, v_cur)
           || case when v_diff > 0 then '，別人欠你 ' || notif_money(v_diff, v_cur)
                   when v_diff < 0 then '，還要付 ' || notif_money(-v_diff, v_cur)
                   else '' end;
  elsif nullif(p->>'payee', '') is not null and not coalesce((p->>'payee_is_actor')::boolean, false) then
    v_mine := '・你應付 ' || notif_money(v_share, v_cur) || ' 給' || (p->>'payee');
  else
    v_mine := '（你分攤其中 ' || notif_money(v_share, v_cur) || '）';
  end if;

  if p_kind in ('expenses_insert', 'expenses_update') then
    if coalesce((p->>'removed')::boolean, false) then
      title := v_actor || '把你從「' || v_desc || '」移除';
      body := '你不用分攤了';
      return;
    end if;
    title := case when coalesce((p->>'added')::boolean, false) then v_actor || '把你加入「' || v_desc || '」'
                  when p_kind = 'expenses_insert' then v_actor || '記了一筆支出'
                  else v_actor || '修改了「' || v_desc || '」' end;
    v_head := case when p_kind = 'expenses_update' and not coalesce((p->>'added')::boolean, false) and p ? 'old_amount'
                   then '金額 ' || notif_money((p->>'old_amount')::numeric, v_cur) || ' → ' || v_amount
                   else v_desc || ' ' || v_amount end;
    body := v_head || v_mine;
  elsif p_kind = 'recurring_generated' then
    title := v_desc || '已自動記錄';
    body := v_amount || v_mine;
  elsif p_kind in ('repayments_insert', 'repayments_update') then
    title := v_actor || case when p_kind = 'repayments_insert' then '記了一筆還款' else '修改了一筆還款' end;
    body := case when p->>'role' = 'from' then '你還給' || coalesce(p->>'to', '?') || ' ' || v_amount
                 else coalesce(p->>'from', '?') || '還你 ' || v_amount end
         || case when p_kind = 'repayments_update' and p ? 'old_amount'
                 then '（原本 ' || notif_money((p->>'old_amount')::numeric, v_cur) || '）' else '' end;
  elsif p_kind = 'debt_reminder' then
    title := '還款提醒';
    body := coalesce(nullif(p->>'creditor', ''), '有人') || '提醒你結清 ' || v_amount;
  end if;
end;
$function$;

create or replace function public.notify_expense_or_repayment()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_ids uuid[];
  v_type text;
  v_params jsonb;
  v_member uuid;
  v_actor text;
  v_desc text;
  v_single uuid;
  v_now_in boolean;
  v_was_in boolean;
  v_recurring boolean := false;
  v_text record;
begin
  select name into v_actor from members where id = NEW.created_by;

  if TG_TABLE_NAME = 'expenses' then
    if TG_OP = 'UPDATE'
       and NEW.amount is not distinct from OLD.amount
       and NEW.currency is not distinct from OLD.currency
       and NEW.payers is not distinct from OLD.payers
       and NEW.shares is not distinct from OLD.shares
       and NEW.description is not distinct from OLD.description
       and NEW.expense_date is not distinct from OLD.expense_date then
      return NEW;  -- e.g. a receipt photo or AI data was attached: nothing worth a notification
    end if;
    v_recurring := TG_OP = 'INSERT' and coalesce(NEW.note, '') like '%[recurring:%';
    v_type := case when v_recurring then 'recurring_generated' else 'expenses_' || lower(TG_OP) end;
    v_desc := notif_clean_desc(NEW.description);

    select array_agg(distinct m) into v_ids from (
      select (x->>'member_id')::uuid m from jsonb_array_elements(coalesce(NEW.payers, '[]') || coalesce(NEW.shares, '[]')) x
      union
      select (x->>'member_id')::uuid from jsonb_array_elements(
        case when TG_OP = 'UPDATE' then coalesce(OLD.payers, '[]') || coalesce(OLD.shares, '[]') else '[]'::jsonb end) x
    ) s;

    -- exactly one person actually paid → recipients who did not pay owe that person
    select case when count(*) = 1 then min((x->>'member_id'))::uuid end into v_single
    from jsonb_array_elements(coalesce(NEW.payers, '[]')) x
    where coalesce((x->>'amount')::numeric, 0) > 0;

    foreach v_member in array coalesce(v_ids, '{}'::uuid[]) loop
      continue when v_member is null;
      -- nobody "did" an auto-recorded recurring expense, so the creator hears about it too
      continue when not v_recurring and v_member = NEW.created_by;
      v_now_in := exists (select 1 from jsonb_array_elements(coalesce(NEW.payers, '[]') || coalesce(NEW.shares, '[]')) x
                          where (x->>'member_id')::uuid = v_member);
      v_was_in := TG_OP = 'UPDATE' and exists (select 1 from jsonb_array_elements(coalesce(OLD.payers, '[]') || coalesce(OLD.shares, '[]')) x
                          where (x->>'member_id')::uuid = v_member);
      v_params := jsonb_build_object(
        'actor', coalesce(v_actor, ''), 'desc', v_desc, 'amount', NEW.amount, 'currency', NEW.currency,
        'share', (select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(coalesce(NEW.shares, '[]')) x where (x->>'member_id')::uuid = v_member),
        'paid', (select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(coalesce(NEW.payers, '[]')) x where (x->>'member_id')::uuid = v_member),
        'payee', case when v_single is not null and v_single <> v_member then (select name from members where id = v_single) end,
        'payee_is_actor', v_single is not null and v_single = NEW.created_by);
      if TG_OP = 'UPDATE' then
        if NEW.amount is distinct from OLD.amount then v_params := v_params || jsonb_build_object('old_amount', OLD.amount); end if;
        if v_now_in and not v_was_in then v_params := v_params || '{"added":true}'; end if;
        if v_was_in and not v_now_in then v_params := v_params || '{"removed":true}'; end if;
      end if;
      v_text := notif_text_zh(v_type, v_params);
      insert into notifications (member_id, group_id, type, title, body, related_table, related_id, params)
      values (v_member, NEW.group_id, v_type, v_text.title, v_text.body, 'expenses', NEW.id, v_params);
    end loop;
  else
    if TG_OP = 'UPDATE'
       and NEW.amount is not distinct from OLD.amount
       and NEW.currency is not distinct from OLD.currency
       and NEW.from_member is not distinct from OLD.from_member
       and NEW.to_member is not distinct from OLD.to_member
       and NEW.payment_date is not distinct from OLD.payment_date then
      return NEW;
    end if;
    v_type := 'repayments_' || lower(TG_OP);
    foreach v_member in array array[NEW.from_member, NEW.to_member] loop
      continue when v_member is null or v_member = NEW.created_by;
      v_params := jsonb_build_object(
        'actor', coalesce(v_actor, ''),
        'from', coalesce((select name from members where id = NEW.from_member), '?'),
        'to', coalesce((select name from members where id = NEW.to_member), '?'),
        'role', case when v_member = NEW.to_member then 'to' else 'from' end,
        'amount', NEW.amount, 'currency', NEW.currency);
      if TG_OP = 'UPDATE' and NEW.amount is distinct from OLD.amount then
        v_params := v_params || jsonb_build_object('old_amount', OLD.amount);
      end if;
      v_text := notif_text_zh(v_type, v_params);
      insert into notifications (member_id, group_id, type, title, body, related_table, related_id, params)
      values (v_member, NEW.group_id, v_type, v_text.title, v_text.body, 'repayments', NEW.id, v_params);
    end loop;
  end if;

  return NEW;
end;
$function$;

-- the trigger above now covers recurring auto-records; keep the RPC (old cached clients still call it) as a no-op
create or replace function public.notify_recurring_generated(p_group_id uuid, p_member_ids uuid[], p_title text, p_body text, p_related_table text default null::text, p_related_id uuid default null::uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (
    select 1 from public.members m
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.left_at is null
  ) then
    raise exception 'not a member of this group';
  end if;
  return;  -- notification is written by notify_expense_or_repayment() on insert
end;
$function$;

create or replace function public.send_debt_reminder(p_debtor_member_id uuid, p_amount numeric, p_currency text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_creditor_id uuid;
  v_creditor_name text;
  v_debtor_group_id uuid;
  v_last_sent timestamptz;
  v_params jsonb;
  v_text record;
begin
  select group_id into v_debtor_group_id from members where id = p_debtor_member_id;
  if v_debtor_group_id is null then
    return 'FORBIDDEN';
  end if;

  select id, name into v_creditor_id, v_creditor_name
  from members
  where user_id = auth.uid() and left_at is null and group_id = v_debtor_group_id
  limit 1;

  if v_creditor_id is null or v_creditor_id = p_debtor_member_id then
    return 'FORBIDDEN';
  end if;

  select sent_at into v_last_sent from debt_reminders
  where creditor_member_id = v_creditor_id and debtor_member_id = p_debtor_member_id and currency = p_currency;

  if v_last_sent is not null and v_last_sent > now() - interval '24 hours' then
    return 'THROTTLED';
  end if;

  insert into debt_reminders (creditor_member_id, debtor_member_id, currency, sent_at)
  values (v_creditor_id, p_debtor_member_id, p_currency, now())
  on conflict (creditor_member_id, debtor_member_id, currency)
  do update set sent_at = excluded.sent_at;

  v_params := jsonb_build_object('creditor', v_creditor_name, 'amount', p_amount, 'currency', p_currency);
  v_text := notif_text_zh('debt_reminder', v_params);
  insert into notifications (member_id, group_id, type, title, body, related_table, related_id, params)
  values (p_debtor_member_id, v_debtor_group_id, 'debt_reminder', v_text.title, v_text.body,
          'members', v_creditor_id, v_params);

  return 'OK';
end;
$function$;

-- daily cleanup: notifications older than 30 days
do $$ begin perform cron.unschedule('cleanup-old-notifications'); exception when others then null; end $$;
select cron.schedule('cleanup-old-notifications', '30 18 * * *',
  $$delete from public.notifications where created_at < now() - interval '30 days'$$);
