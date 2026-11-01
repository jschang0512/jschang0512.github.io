-- Split Bill — Realtime publication trimmed to the tables the app listens to (2026-11)
-- The app only subscribes to postgres_changes on expenses, repayments and notifications
-- (app.js / summary.html / shared-ui.js). Every other table in the publication still had
-- each change decoded and checked by Realtime, the single largest cost in pg_stat_statements.
alter publication supabase_realtime drop table
  public.app_config, public.category_learning, public.debt_reminders, public.feedback,
  public.groups, public.members, public.push_subscriptions, public.user_payment_accounts,
  public.user_settings, public.usernames;
