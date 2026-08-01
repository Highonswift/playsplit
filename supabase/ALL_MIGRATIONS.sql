-- PitchLive — combined migrations 0001–0014. Paste into Supabase → SQL Editor → Run.

-- ============================================================
-- 0001_init.sql
-- ============================================================
-- PlaySplit — initial schema (PRD §8 Core Entities)
-- All money is stored as integer paise (bigint). All timestamps are timestamptz.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type group_role     as enum ('platform_admin', 'group_admin', 'player');
create type member_status  as enum ('invited', 'active', 'removed');
create type cost_model      as enum ('equal', 'usage', 'investor', 'hybrid');
create type sub_status      as enum ('green', 'yellow', 'red', 'expired', 'gray');
create type match_status    as enum ('scheduled', 'completed', 'settled', 'cancelled');
create type attendance_method as enum ('manual', 'self_checkin', 'admin_approval', 'qr', 'gps');
create type wallet_txn_type as enum ('usage', 'payment', 'advance', 'credit', 'refund', 'investor_return', 'settlement');
create type payment_method  as enum ('upi', 'razorpay', 'cash', 'bank_transfer', 'wallet');
create type payment_status  as enum ('pending', 'paid', 'partial', 'failed', 'refunded');

-- ----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  is_platform_admin boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Groups & membership (tenancy + RBAC)
-- ----------------------------------------------------------------------------
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sport       text not null default 'cricket',
  cost_model  cost_model not null default 'equal',
  owner_id    uuid not null references profiles(id),
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at  timestamptz not null default now()
);

create table group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references groups(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      group_role not null default 'player',
  status    member_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index idx_group_members_group on group_members(group_id);
create index idx_group_members_user on group_members(user_id);

-- ----------------------------------------------------------------------------
-- Grounds & subscription plans (PRD §8)
-- ----------------------------------------------------------------------------
create table grounds (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  name            text not null,
  address         text,
  contact_person  text,
  hourly_rate_paise bigint not null,
  created_at      timestamptz not null default now()
);
create index idx_grounds_group on grounds(group_id);

create table subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  ground_id      uuid not null references grounds(id) on delete cascade,
  name           text not null,
  cost_paise     bigint not null,
  included_hours numeric(6,2) not null,
  validity_days  int not null,
  auto_renew     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index idx_plans_ground on subscription_plans(ground_id);

-- ----------------------------------------------------------------------------
-- Subscriptions (PRD §9, §10)
-- ----------------------------------------------------------------------------
create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  plan_id         uuid references subscription_plans(id),
  ground_id       uuid not null references grounds(id),
  name            text not null,
  cost_paise      bigint not null,
  purchased_hours numeric(6,2) not null,
  consumed_hours  numeric(6,2) not null default 0,
  expired_hours   numeric(6,2) not null default 0,
  rate_per_hour_paise bigint not null, -- cost_paise / purchased_hours, cached
  start_date      date not null,
  end_date        date not null,
  auto_renew      boolean not null default false,
  status          sub_status not null default 'gray',
  created_at      timestamptz not null default now()
);
create index idx_subs_group on subscriptions(group_id);
create index idx_subs_status on subscriptions(group_id, status);

-- ----------------------------------------------------------------------------
-- Matches & attendance (PRD §12, §13)
-- ----------------------------------------------------------------------------
create table matches (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  ground_id       uuid not null references grounds(id),
  subscription_id uuid references subscriptions(id),
  match_date      date not null,
  start_time      time not null,
  end_time        time not null,
  duration_mins   int not null,
  total_cost_paise bigint not null default 0,
  cost_model      cost_model not null default 'equal',
  status          match_status not null default 'scheduled',
  payment_status  payment_status not null default 'pending',
  settled_at      timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_matches_group_date on matches(group_id, match_date);

create table match_attendance (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  user_id         uuid not null references profiles(id),
  rsvp            boolean,
  present         boolean not null default false,
  is_investor     boolean not null default false,
  method          attendance_method not null default 'manual',
  join_time       time,
  leave_time      time,
  billable_minutes int not null default 0,
  unique (match_id, user_id)
);
create index idx_attendance_match on match_attendance(match_id);
create index idx_attendance_user on match_attendance(user_id);

-- ----------------------------------------------------------------------------
-- Wallet — append-only ledger (PRD §14)
-- ----------------------------------------------------------------------------
create table wallet_accounts (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  cached_balance_paise bigint not null default 0, -- credit positive, debt negative
  unique (group_id, user_id)
);
create index idx_wallet_group on wallet_accounts(group_id);

create table wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references wallet_accounts(id) on delete cascade,
  match_id    uuid references matches(id) on delete set null,
  payment_id  uuid,
  type        wallet_txn_type not null,
  -- signed: negative reduces wallet (usage/settlement), positive increases (payment/credit/refund/advance/investor_return)
  amount_paise bigint not null,
  balance_after_paise bigint not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_wtx_account on wallet_transactions(account_id, created_at);
create index idx_wtx_match on wallet_transactions(match_id);

-- ----------------------------------------------------------------------------
-- Payments (PRD §15)
-- ----------------------------------------------------------------------------
create table payments (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references groups(id) on delete cascade,
  user_id          uuid not null references profiles(id),
  amount_paise     bigint not null,
  method           payment_method not null,
  status           payment_status not null default 'pending',
  razorpay_order_id   text,
  razorpay_payment_id text unique,
  receipt_url      text,
  created_at       timestamptz not null default now()
);
create index idx_payments_group on payments(group_id);
create index idx_payments_order on payments(razorpay_order_id);

-- ----------------------------------------------------------------------------
-- Subscription hour-consumption audit (PRD §10)
-- ----------------------------------------------------------------------------
create table subscription_ledger (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  match_id        uuid references matches(id) on delete set null,
  hours_deducted  numeric(6,2) not null,
  created_at      timestamptz not null default now()
);
create index idx_subledger_sub on subscription_ledger(subscription_id);

-- ----------------------------------------------------------------------------
-- Notifications (PRD §17) & audit trail (PRD §24)
-- ----------------------------------------------------------------------------
create table notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles(id) on delete cascade,
  group_id  uuid references groups(id) on delete cascade,
  type      text not null,
  title     text not null,
  body      text,
  payload   jsonb not null default '{}',
  read_at   timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, read_at);

create table audit_log (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid references groups(id) on delete cascade,
  actor_id  uuid references profiles(id),
  action    text not null,
  entity    text not null,
  entity_id uuid,
  before    jsonb,
  after     jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_group on audit_log(group_id, created_at);

-- ----------------------------------------------------------------------------
-- Achievements (PRD §21 — Phase 2 stub, table present for forward-compat)
-- ----------------------------------------------------------------------------
create table achievements (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references groups(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  code      text not null,
  earned_at timestamptz not null default now(),
  unique (group_id, user_id, code)
);

-- ----------------------------------------------------------------------------
-- updated_at trigger for profiles
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- 0002_rls.sql
-- ============================================================
-- PlaySplit — Row Level Security (PRD §24 role-based access control)
-- Multi-tenant: every domain row is scoped by group membership; writes that
-- mutate money/state are restricted to group admins. The settlement & payment
-- server actions use the service-role key, which bypasses RLS by design.

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid policy recursion on group_members)
-- ----------------------------------------------------------------------------
create or replace function is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function is_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
      and status = 'active' and role in ('group_admin', 'platform_admin')
  );
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table groups              enable row level security;
alter table group_members       enable row level security;
alter table grounds             enable row level security;
alter table subscription_plans  enable row level security;
alter table subscriptions       enable row level security;
alter table matches             enable row level security;
alter table match_attendance    enable row level security;
alter table wallet_accounts     enable row level security;
alter table wallet_transactions enable row level security;
alter table payments            enable row level security;
alter table subscription_ledger enable row level security;
alter table notifications       enable row level security;
alter table audit_log           enable row level security;
alter table achievements        enable row level security;

-- ----------------------------------------------------------------------------
-- profiles: a user sees/edits their own profile; members see each other.
-- ----------------------------------------------------------------------------
create policy profiles_self_select on profiles for select
  using (id = auth.uid() or exists (
    select 1 from group_members gm1
    join group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
  ));
create policy profiles_self_update on profiles for update using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- groups: members read; admins update; any authenticated user can create.
-- ----------------------------------------------------------------------------
create policy groups_member_select on groups for select using (is_group_member(id));
create policy groups_insert on groups for insert with check (owner_id = auth.uid());
create policy groups_admin_update on groups for update using (is_group_admin(id));

-- ----------------------------------------------------------------------------
-- group_members: members read the roster; admins manage it; users see own row.
-- ----------------------------------------------------------------------------
create policy gm_select on group_members for select
  using (user_id = auth.uid() or is_group_member(group_id));
create policy gm_admin_write on group_members for all
  using (is_group_admin(group_id))
  with check (is_group_admin(group_id));
-- Allow a user to insert themselves (accept invite via code) — checked in app.
create policy gm_self_join on group_members for insert with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Generic pattern: members read group-scoped data, admins write it.
-- ----------------------------------------------------------------------------
create policy grounds_select on grounds for select using (is_group_member(group_id));
create policy grounds_write  on grounds for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy plans_select on subscription_plans for select
  using (exists (select 1 from grounds g where g.id = ground_id and is_group_member(g.group_id)));
create policy plans_write on subscription_plans for all
  using (exists (select 1 from grounds g where g.id = ground_id and is_group_admin(g.group_id)))
  with check (exists (select 1 from grounds g where g.id = ground_id and is_group_admin(g.group_id)));

create policy subs_select on subscriptions for select using (is_group_member(group_id));
create policy subs_write  on subscriptions for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy matches_select on matches for select using (is_group_member(group_id));
create policy matches_write  on matches for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- attendance: members read; admins write; players may self-RSVP/self-checkin.
create policy attendance_select on match_attendance for select
  using (exists (select 1 from matches m where m.id = match_id and is_group_member(m.group_id)));
create policy attendance_admin_write on match_attendance for all
  using (exists (select 1 from matches m where m.id = match_id and is_group_admin(m.group_id)))
  with check (exists (select 1 from matches m where m.id = match_id and is_group_admin(m.group_id)));
create policy attendance_self on match_attendance for update
  using (user_id = auth.uid());

-- wallet: a member sees only their OWN wallet + transactions; admins see all in group.
create policy wallet_select on wallet_accounts for select
  using (user_id = auth.uid() or is_group_admin(group_id));
create policy wtx_select on wallet_transactions for select
  using (exists (
    select 1 from wallet_accounts wa where wa.id = account_id
      and (wa.user_id = auth.uid() or is_group_admin(wa.group_id))
  ));

-- payments: user sees own; admin sees all in group; user can create own payment.
create policy payments_select on payments for select
  using (user_id = auth.uid() or is_group_admin(group_id));
create policy payments_insert on payments for insert with check (user_id = auth.uid() or is_group_admin(group_id));

create policy subledger_select on subscription_ledger for select
  using (exists (select 1 from subscriptions s where s.id = subscription_id and is_group_member(s.group_id)));

-- notifications: strictly per-user.
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid());

-- audit log: admins only.
create policy audit_select on audit_log for select using (group_id is not null and is_group_admin(group_id));

create policy achievements_select on achievements for select using (is_group_member(group_id));


-- ============================================================
-- 0003_groups_rpc.sql
-- ============================================================
-- PlaySplit — M1 group join RPC + wallet auto-provisioning
-- A non-member cannot SELECT a group (RLS), so joining by invite code goes
-- through a SECURITY DEFINER function that adds the caller as a member.

create or replace function join_group_by_invite(p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  select * into g from groups where invite_code = lower(trim(p_code));
  if g.id is null then
    raise exception 'Invalid invite code' using errcode = 'no_data_found';
  end if;

  insert into group_members (group_id, user_id, role, status)
  values (g.id, auth.uid(), 'player', 'active')
  on conflict (group_id, user_id) do update set status = 'active';

  return g;
end;
$$;

grant execute on function join_group_by_invite(text) to authenticated;

-- Every group member gets a wallet account (idempotent). Used from M5 onward.
create or replace function ensure_wallet_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallet_accounts (group_id, user_id)
  values (new.group_id, new.user_id)
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger trg_member_wallet
  after insert on group_members
  for each row execute function ensure_wallet_account();


-- ============================================================
-- 0004_grants.sql
-- ============================================================
-- PlaySplit — role grants. RLS (migration 0002) restricts which ROWS each user
-- sees; these grants give the Supabase roles the base table privileges they need
-- for RLS to even be evaluated. Without them every query is "permission denied".

grant usage on schema public to anon, authenticated, service_role;

-- Authenticated users: full DML, but every table has RLS so rows stay scoped.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Apply the same defaults to any tables/functions added by later migrations.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;


-- ============================================================
-- 0005_create_group_rpc.sql
-- ============================================================
-- PlaySplit — atomic group creation. Creating a group and returning it via RLS
-- is a chicken-and-egg (the creator isn't a member until after insert), so do
-- both in one SECURITY DEFINER call: create the group + enrol the owner as admin.

create or replace function create_group(p_name text, p_sport text default 'cricket')
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g groups;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'Group name too short' using errcode = 'check_violation';
  end if;

  insert into groups (name, sport, owner_id)
  values (trim(p_name), p_sport, uid)
  returning * into g;

  insert into group_members (group_id, user_id, role, status)
  values (g.id, uid, 'group_admin', 'active');

  return g;
end;
$$;

grant execute on function create_group(text, text) to authenticated;


-- ============================================================
-- 0006_expiry_job.sql
-- ============================================================
-- PlaySplit — subscription expiry job (PRD §10).
-- Display status (green/yellow/red) is computed on read by the app via the core
-- engine. This job persists the TERMINAL transition: when a subscription's
-- validity has elapsed OR its hours are exhausted, mark it expired and book the
-- unused hours as `expired_hours` for the Savings / Expired-Hours reports.

create or replace function expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update subscriptions
  set status = 'expired',
      expired_hours = greatest(0, purchased_hours - consumed_hours)
  where status not in ('expired', 'gray')
    and (end_date < current_date or consumed_hours >= purchased_hours);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Schedule daily at 00:30 if pg_cron is available (Supabase hosted has it).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('playsplit-expire-subscriptions', '30 0 * * *',
      $cron$ select expire_subscriptions(); $cron$);
  end if;
end;
$$;


-- ============================================================
-- 0007_settle_match.sql
-- ============================================================
-- PlaySplit — match settlement persistence (PRD §12).
-- The cost-split MATH runs in TypeScript (packages/core, fully unit-tested).
-- This RPC just persists the engine's output atomically and idempotently:
-- it reverses any prior settlement for the match, then applies the new wallet
-- postings, subscription hour deduction, and match status — all in one tx.
--
-- p_postings is a JSON array of pre-signed wallet deltas:
--   [{ "user_id": uuid, "type": "usage"|"investor_return",
--      "amount_paise": int (negative = debit, positive = credit), "note": text }]

create or replace function settle_match(
  p_match_id uuid,
  p_total_cost bigint,
  p_subscription_id uuid,
  p_hours_from_sub numeric,
  p_postings jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_acc uuid;
  v_bal bigint;
  rec record;
begin
  -- Resolve the match's group and authorize the caller as an admin of it.
  select group_id into v_group from matches where id = p_match_id;
  if v_group is null then
    raise exception 'Match not found';
  end if;
  if not exists (
    select 1 from group_members
    where group_id = v_group and user_id = auth.uid()
      and status = 'active' and role in ('group_admin', 'platform_admin')
  ) then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  -- 1. Reverse any prior settlement for this match (makes re-settling safe).
  update subscriptions s
  set consumed_hours = greatest(0, consumed_hours - x.h)
  from (
    select subscription_id, sum(hours_deducted) h
    from subscription_ledger where match_id = p_match_id group by subscription_id
  ) x
  where s.id = x.subscription_id;
  delete from subscription_ledger where match_id = p_match_id;
  delete from wallet_transactions where match_id = p_match_id;

  -- Recompute cached balances for the group's wallets after the delete.
  update wallet_accounts wa
  set cached_balance_paise = coalesce(
    (select sum(amount_paise) from wallet_transactions wt where wt.account_id = wa.id), 0)
  where wa.group_id = v_group;

  -- 2. Apply the new wallet postings (running balance per account).
  for rec in
    select * from jsonb_to_recordset(p_postings)
      as t(user_id uuid, type wallet_txn_type, amount_paise bigint, note text)
  loop
    insert into wallet_accounts (group_id, user_id)
    values (v_group, rec.user_id)
    on conflict (group_id, user_id) do nothing;

    select id, cached_balance_paise into v_acc, v_bal
    from wallet_accounts where group_id = v_group and user_id = rec.user_id;

    v_bal := v_bal + rec.amount_paise;
    insert into wallet_transactions (account_id, match_id, type, amount_paise, balance_after_paise, note)
    values (v_acc, p_match_id, rec.type, rec.amount_paise, v_bal, rec.note);
    update wallet_accounts set cached_balance_paise = v_bal where id = v_acc;
  end loop;

  -- 3. Deduct subscription hours (audit + running consumed total).
  if p_subscription_id is not null and p_hours_from_sub > 0 then
    insert into subscription_ledger (subscription_id, match_id, hours_deducted)
    values (p_subscription_id, p_match_id, p_hours_from_sub);
    update subscriptions
    set consumed_hours = consumed_hours + p_hours_from_sub
    where id = p_subscription_id;
  end if;

  -- 4. Mark the match settled.
  update matches
  set total_cost_paise = p_total_cost,
      status = 'settled',
      settled_at = now(),
      payment_status = 'pending'
  where id = p_match_id;
end;
$$;

grant execute on function settle_match(uuid, bigint, uuid, numeric, jsonb) to authenticated;


-- ============================================================
-- 0008_record_payment.sql
-- ============================================================
-- PlaySplit — payment recording (PRD §15). One atomic, idempotent path used by
-- both manual entry (cash/UPI/bank, admin) and the Razorpay webhook (server).
-- Records the payment and credits the player's wallet in a single transaction.

create or replace function record_payment(
  p_group uuid,
  p_user uuid,
  p_amount bigint,
  p_method payment_method,
  p_razorpay_payment_id text default null,
  p_razorpay_order_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_pay uuid;
  v_acc uuid;
  v_bal bigint;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Authorize: trusted server context (no JWT), the payer themselves, or an admin.
  if v_caller is not null
     and v_caller <> p_user
     and not exists (
       select 1 from group_members
       where group_id = p_group and user_id = v_caller
         and status = 'active' and role in ('group_admin', 'platform_admin')
     )
  then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  -- Idempotency: a Razorpay payment id is recorded at most once.
  if p_razorpay_payment_id is not null then
    select id into v_pay from payments where razorpay_payment_id = p_razorpay_payment_id;
    if v_pay is not null then
      return v_pay;
    end if;
  end if;

  insert into payments (group_id, user_id, amount_paise, method, status,
                        razorpay_payment_id, razorpay_order_id)
  values (p_group, p_user, p_amount, p_method, 'paid',
          p_razorpay_payment_id, p_razorpay_order_id)
  returning id into v_pay;

  insert into wallet_accounts (group_id, user_id)
  values (p_group, p_user) on conflict (group_id, user_id) do nothing;

  select id, cached_balance_paise into v_acc, v_bal
  from wallet_accounts where group_id = p_group and user_id = p_user;

  v_bal := v_bal + p_amount;
  insert into wallet_transactions (account_id, payment_id, type, amount_paise, balance_after_paise, note)
  values (v_acc, v_pay, 'payment', p_amount, v_bal, 'Payment received');
  update wallet_accounts set cached_balance_paise = v_bal where id = v_acc;

  return v_pay;
end;
$$;

grant execute on function record_payment(uuid, uuid, bigint, payment_method, text, text)
  to authenticated, service_role;


-- ============================================================
-- 0009_notifications.sql
-- ============================================================
-- PlaySplit — notification creation (PRD §17). SECURITY DEFINER so an admin's
-- action (settling a match) can notify other members, who can then read only
-- their own notifications (RLS notifications_select).

create or replace function create_notification(
  p_user uuid,
  p_group uuid,
  p_type text,
  p_title text,
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only members of the group can be notified, and only by a fellow member
  -- (or the trusted server). Keeps this from being abused as a generic inbox.
  if auth.uid() is not null and not exists (
    select 1 from group_members where group_id = p_group and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  insert into notifications (user_id, group_id, type, title, body)
  values (p_user, p_group, p_type, p_title, p_body);
end;
$$;

grant execute on function create_notification(uuid, uuid, text, text, text)
  to authenticated, service_role;


-- ============================================================
-- 0010_audit.sql
-- ============================================================
-- PlaySplit — audit trail (PRD §24). SECURITY DEFINER so members can append
-- audit entries (audit_log has no direct insert policy); admins read them.

create or replace function log_audit(
  p_group uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (group_id, actor_id, action, entity, entity_id, after)
  values (p_group, auth.uid(), p_action, p_entity, p_entity_id, p_after);
end;
$$;

grant execute on function log_audit(uuid, text, text, uuid, jsonb) to authenticated, service_role;


-- ============================================================
-- 0011_cricket_foundation.sql
-- ============================================================
-- PitchLive — Cricket foundation (Enhancement Phase 2).
-- New cricket domain that coexists with the existing cost-sharing tables; the
-- old "matches" remain booking/attendance sessions, "cricket_matches" are
-- Team A vs Team B games that Phase 3 will score ball-by-ball.

create type cricket_format as enum
  ('t20', 'odi', 't10', 'hundred', 'test', 'custom', 'box', 'tennis', 'unlimited');

create type cricket_match_status as enum
  ('scheduled', 'toss', 'live', 'innings_break', 'completed', 'abandoned', 'cancelled');

create type toss_decision as enum ('bat', 'bowl');

create type cricket_role as enum ('batter', 'bowler', 'allrounder', 'wk', 'wk_batter');
create type batting_style as enum ('rhb', 'lhb');
create type bowling_style as enum
  ('right_fast', 'right_medium', 'right_offspin', 'right_legspin',
   'left_fast', 'left_medium', 'left_orthodox', 'left_wrist', 'none');

-- ----------------------------------------------------------------------------
-- Teams (§6.1)
-- ----------------------------------------------------------------------------
create table cricket_teams (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  name        text not null,
  short_name  text,
  color       text default '#16a34a',
  city        text,
  logo_url    text,
  description text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_cricket_teams_group on cricket_teams(group_id);

-- ----------------------------------------------------------------------------
-- Players (§6.2). Standalone records — a cricket player need not be an app user.
-- ----------------------------------------------------------------------------
create table cricket_players (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  team_id       uuid references cricket_teams(id) on delete set null,
  user_id       uuid references profiles(id),   -- optional link to an app user
  full_name     text not null,
  jersey_number int,
  role          cricket_role not null default 'batter',
  batting       batting_style default 'rhb',
  bowling       bowling_style default 'none',
  created_at    timestamptz not null default now()
);
create index idx_cricket_players_group on cricket_players(group_id);
create index idx_cricket_players_team on cricket_players(team_id);

-- ----------------------------------------------------------------------------
-- Matches (§7) with toss (§7.1). Formats are config on the row (§5.2).
-- ----------------------------------------------------------------------------
create table cricket_matches (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references groups(id) on delete cascade,
  name              text,
  format            cricket_format not null default 't20',
  overs             int,               -- null = unlimited
  innings           int not null default 1,
  players_per_side  int not null default 11,
  max_overs_per_bowler int,
  ball_type         text default 'leather',
  team_a_id         uuid not null references cricket_teams(id),
  team_b_id         uuid not null references cricket_teams(id),
  venue             text,
  match_date        date not null,
  start_time        time,
  visibility        text not null default 'private',
  status            cricket_match_status not null default 'scheduled',
  -- toss
  toss_winner_team_id  uuid references cricket_teams(id),
  toss_decision        toss_decision,
  batting_first_team_id uuid references cricket_teams(id),
  toss_at              timestamptz,
  -- result (populated in Phase 3)
  winner_team_id       uuid references cricket_teams(id),
  result_text          text,
  player_of_match_id   uuid references cricket_players(id),
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);
create index idx_cricket_matches_group_date on cricket_matches(group_id, match_date);

-- ----------------------------------------------------------------------------
-- Match squads / playing XI (§6.3)
-- ----------------------------------------------------------------------------
create table cricket_match_players (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references cricket_matches(id) on delete cascade,
  team_id        uuid not null references cricket_teams(id) on delete cascade,
  player_id      uuid not null references cricket_players(id) on delete cascade,
  is_playing_xi  boolean not null default true,
  is_captain     boolean not null default false,
  is_wicketkeeper boolean not null default false,
  batting_order  int,
  unique (match_id, player_id)
);
create index idx_cmp_match on cricket_match_players(match_id);

-- ----------------------------------------------------------------------------
-- RLS — group-scoped; members read, admins write.
-- ----------------------------------------------------------------------------
alter table cricket_teams          enable row level security;
alter table cricket_players        enable row level security;
alter table cricket_matches        enable row level security;
alter table cricket_match_players  enable row level security;

create policy ct_select on cricket_teams for select using (is_group_member(group_id));
create policy ct_write  on cricket_teams for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy cp_select on cricket_players for select using (is_group_member(group_id));
create policy cp_write  on cricket_players for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy cm_select on cricket_matches for select using (is_group_member(group_id));
create policy cm_write  on cricket_matches for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy cmp_select on cricket_match_players for select
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_member(m.group_id)));
create policy cmp_write on cricket_match_players for all
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_admin(m.group_id)))
  with check (exists (select 1 from cricket_matches m where m.id = match_id and is_group_admin(m.group_id)));

-- Grants (RLS still gates rows).
grant select, insert, update, delete on
  cricket_teams, cricket_players, cricket_matches, cricket_match_players to authenticated;
grant select on
  cricket_teams, cricket_players, cricket_matches, cricket_match_players to anon;
grant all on
  cricket_teams, cricket_players, cricket_matches, cricket_match_players to service_role;


-- ============================================================
-- 0012_cricket_scoring.sql
-- ============================================================
-- PitchLive — Cricket live scoring (Enhancement Phase 3, §8–13).
-- Deliveries are append-only; live state is DERIVED by the (unit-tested) engine,
-- exactly like the wallet ledger. Undo = drop the last delivery.

create table cricket_innings (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references cricket_matches(id) on delete cascade,
  number          int not null default 1,
  batting_team_id uuid not null references cricket_teams(id),
  bowling_team_id uuid not null references cricket_teams(id),
  striker_id      uuid not null references cricket_players(id),
  non_striker_id  uuid not null references cricket_players(id),
  target          int,
  status          text not null default 'in_progress', -- in_progress | complete
  created_at      timestamptz not null default now(),
  unique (match_id, number)
);
create index idx_innings_match on cricket_innings(match_id);

create table cricket_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  innings_id         uuid not null references cricket_innings(id) on delete cascade,
  seq                int not null,
  bowler_id          uuid not null references cricket_players(id),
  runs_bat           int not null default 0,
  extra              text,               -- wide|noball|bye|legbye|penalty
  extra_runs         int not null default 0,
  wicket_type        text,
  wicket_out_end     text,               -- striker|nonstriker
  wicket_fielder_id  uuid references cricket_players(id),
  wicket_incoming_id uuid references cricket_players(id),
  wicket_crossed     boolean not null default false,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  unique (innings_id, seq)
);
create index idx_deliveries_innings on cricket_deliveries(innings_id, seq);

alter table cricket_innings    enable row level security;
alter table cricket_deliveries enable row level security;

-- Read: any member of the match's group (spectators/players follow live).
create policy ci_select on cricket_innings for select
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_member(m.group_id)));
create policy cd_select on cricket_deliveries for select
  using (exists (
    select 1 from cricket_innings i join cricket_matches m on m.id = i.match_id
    where i.id = innings_id and is_group_member(m.group_id)));

grant select on cricket_innings, cricket_deliveries to authenticated, anon;
grant all on cricket_innings, cricket_deliveries to service_role;

-- ----------------------------------------------------------------------------
-- Authorization helper: can this user score this match? (admin for now; Phase 4
-- adds per-match umpire assignment.)
-- ----------------------------------------------------------------------------
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_matches m
    where m.id = p_match and is_group_admin(m.group_id)
  );
$$;

create or replace function start_innings(
  p_match uuid, p_number int, p_batting uuid, p_bowling uuid,
  p_striker uuid, p_non_striker uuid, p_target int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  insert into cricket_innings (match_id, number, batting_team_id, bowling_team_id, striker_id, non_striker_id, target)
  values (p_match, p_number, p_batting, p_bowling, p_striker, p_non_striker, p_target)
  on conflict (match_id, number) do update set
    batting_team_id = excluded.batting_team_id, bowling_team_id = excluded.bowling_team_id,
    striker_id = excluded.striker_id, non_striker_id = excluded.non_striker_id, target = excluded.target
  returning id into v_id;
  update cricket_matches set status = 'live' where id = p_match;
  return v_id;
end; $$;

create or replace function record_delivery(
  p_innings uuid, p_bowler uuid, p_runs_bat int, p_extra text, p_extra_runs int,
  p_wicket_type text, p_wicket_out_end text, p_wicket_fielder uuid, p_wicket_incoming uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare v_match uuid; v_seq int;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if v_match is null then raise exception 'Innings not found'; end if;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  select coalesce(max(seq), 0) + 1 into v_seq from cricket_deliveries where innings_id = p_innings;
  insert into cricket_deliveries (innings_id, seq, bowler_id, runs_bat, extra, extra_runs,
    wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, created_by)
  values (p_innings, v_seq, p_bowler, coalesce(p_runs_bat,0), p_extra, coalesce(p_extra_runs,0),
    p_wicket_type, p_wicket_out_end, p_wicket_fielder, p_wicket_incoming, auth.uid());
  return v_seq;
end; $$;

create or replace function undo_delivery(p_innings uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_match uuid;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  delete from cricket_deliveries where id = (
    select id from cricket_deliveries where innings_id = p_innings order by seq desc limit 1);
end; $$;

create or replace function end_innings(p_innings uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_match uuid;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  update cricket_innings set status = 'complete' where id = p_innings;
  update cricket_matches set status = 'innings_break' where id = v_match;
end; $$;

create or replace function finish_match(p_match uuid, p_winner uuid, p_result text, p_pom uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  update cricket_matches set status = 'completed', winner_team_id = p_winner,
    result_text = p_result, player_of_match_id = p_pom where id = p_match;
end; $$;

grant execute on function can_score_match(uuid) to authenticated, service_role;
grant execute on function start_innings(uuid,int,uuid,uuid,uuid,uuid,int) to authenticated, service_role;
grant execute on function record_delivery(uuid,uuid,int,text,int,text,text,uuid,uuid) to authenticated, service_role;
grant execute on function undo_delivery(uuid) to authenticated, service_role;
grant execute on function end_innings(uuid) to authenticated, service_role;
grant execute on function finish_match(uuid,uuid,text,uuid) to authenticated, service_role;


-- ============================================================
-- 0013_umpires_realtime.sql
-- ============================================================
-- PitchLive — Multiple umpires, scoring control & real-time (Enhancement Phase 4, §11).

-- Match officials (§11.1). role: umpire1|umpire2|third_umpire|reserve|scorer|referee
create table cricket_officials (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references cricket_matches(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null,
  can_score  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index idx_officials_match on cricket_officials(match_id);

-- Who currently holds active scoring control (§11.4).
alter table cricket_matches add column scoring_control_user_id uuid references profiles(id);
alter table cricket_matches add column scoring_control_at timestamptz;

alter table cricket_officials enable row level security;
create policy co_select on cricket_officials for select
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_member(m.group_id)));
grant select on cricket_officials to authenticated, anon;
grant all on cricket_officials to service_role;

-- Scoring is allowed for group admins OR assigned officials with can_score.
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cricket_matches m where m.id = p_match and is_group_admin(m.group_id))
      or exists (select 1 from cricket_officials o
                 where o.match_id = p_match and o.user_id = auth.uid() and o.can_score);
$$;

create or replace function assign_official(p_match uuid, p_user uuid, p_role text, p_can_score boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from cricket_matches where id = p_match;
  if not is_group_admin(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into cricket_officials (match_id, user_id, role, can_score)
  values (p_match, p_user, p_role, p_can_score)
  on conflict (match_id, user_id) do update set role = excluded.role, can_score = excluded.can_score;
end; $$;

create or replace function remove_official(p_match uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from cricket_matches where id = p_match;
  if not is_group_admin(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from cricket_officials where match_id = p_match and user_id = p_user;
end; $$;

-- Transfer/claim scoring control (§11.4).
create or replace function take_control(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode = '42501'; end if;
  update cricket_matches set scoring_control_user_id = auth.uid(), scoring_control_at = now() where id = p_match;
end; $$;

-- Re-define record_delivery: require the caller holds control, plus an optimistic
-- sequence check to prevent duplicate/concurrent ball entry (§11.3).
drop function if exists record_delivery(uuid,uuid,int,text,int,text,text,uuid,uuid);
create or replace function record_delivery(
  p_innings uuid, p_bowler uuid, p_runs_bat int, p_extra text, p_extra_runs int,
  p_wicket_type text, p_wicket_out_end text, p_wicket_fielder uuid, p_wicket_incoming uuid,
  p_expected_seq int default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_match uuid; v_seq int; v_control uuid;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if v_match is null then raise exception 'Innings not found'; end if;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode = '42501'; end if;

  -- Scoring control: the first scorer claims it; others must take control first.
  select scoring_control_user_id into v_control from cricket_matches where id = v_match;
  if v_control is null then
    update cricket_matches set scoring_control_user_id = auth.uid(), scoring_control_at = now() where id = v_match;
  elsif v_control <> auth.uid() then
    raise exception 'Another umpire holds scoring control' using errcode = '55006';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from cricket_deliveries where innings_id = p_innings;
  if p_expected_seq is not null and p_expected_seq <> v_seq then
    raise exception 'Score changed — refresh and retry' using errcode = '40001';
  end if;

  insert into cricket_deliveries (innings_id, seq, bowler_id, runs_bat, extra, extra_runs,
    wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, created_by)
  values (p_innings, v_seq, p_bowler, coalesce(p_runs_bat,0), p_extra, coalesce(p_extra_runs,0),
    p_wicket_type, p_wicket_out_end, p_wicket_fielder, p_wicket_incoming, auth.uid());
  return v_seq;
end; $$;

grant execute on function assign_official(uuid,uuid,text,boolean) to authenticated, service_role;
grant execute on function remove_official(uuid,uuid) to authenticated, service_role;
grant execute on function take_control(uuid) to authenticated, service_role;
grant execute on function record_delivery(uuid,uuid,int,text,int,text,text,uuid,uuid,int) to authenticated, service_role;

-- Real-time: publish scoring tables so spectators & other umpires update live (§11.3, §14).
alter publication supabase_realtime add table cricket_matches;
alter publication supabase_realtime add table cricket_innings;
alter publication supabase_realtime add table cricket_deliveries;
alter publication supabase_realtime add table cricket_officials;


-- ============================================================
-- 0014_tournaments.sql
-- ============================================================
-- PitchLive — Tournaments (Enhancement Phase 5, §16).

create table tournaments (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  name       text not null,
  format     text not null default 'league', -- league|knockout|round_robin|group_knockout|custom
  status     text not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_tournaments_group on tournaments(group_id);

create table tournament_teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id       uuid not null references cricket_teams(id) on delete cascade,
  unique (tournament_id, team_id)
);

alter table cricket_matches add column tournament_id uuid references tournaments(id) on delete set null;
create index idx_matches_tournament on cricket_matches(tournament_id);

alter table tournaments      enable row level security;
alter table tournament_teams enable row level security;

create policy t_select on tournaments for select using (is_group_member(group_id));
create policy t_write  on tournaments for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy tt_select on tournament_teams for select
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_group_member(t.group_id)));
create policy tt_write on tournament_teams for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_group_admin(t.group_id)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and is_group_admin(t.group_id)));

grant select, insert, update, delete on tournaments, tournament_teams to authenticated;
grant select on tournaments, tournament_teams to anon;
grant all on tournaments, tournament_teams to service_role;




-- ============================================================================
-- 0015_pickup_cricket.sql
-- ============================================================================
-- PitchLive — Pickup cricket (Ariyalur mode).
-- Turf groups don't have fixed teams: a pool of ~40 players, and on any given
-- day 8–14 turn up and split into two ad-hoc sides. Odd numbers get a "shared"
-- player who bats & fields for BOTH sides. Late arrivals join mid-match.
--
-- Design: a pickup match still creates two real cricket_teams rows (so all the
-- existing match / innings / delivery / result machinery keeps working), but
-- the playing sides are defined by cricket_match_players, drawn from the group
-- pool (cricket_players with team_id = null). Scoring reads the per-match squad
-- instead of a permanent team roster.

-- 1. Match type flag ---------------------------------------------------------
alter table cricket_matches
  add column if not exists match_type text not null default 'standard'
    check (match_type in ('standard', 'pickup'));

-- 2. Squad table: allow a shared player on both sides + track late joiners ----
alter table cricket_match_players
  add column if not exists is_shared boolean not null default false,
  add column if not exists joined_at timestamptz not null default now();

-- The old constraint (one row per player per match) blocks the shared player,
-- who must appear on both sides. Key on (match, player, team) instead.
alter table cricket_match_players drop constraint if exists cricket_match_players_match_id_player_id_key;
do $$ begin
  alter table cricket_match_players add constraint cmp_match_player_team_uniq unique (match_id, player_id, team_id);
exception when duplicate_object then null; end $$;

-- 3. Create a whole pickup match in one shot ---------------------------------
-- Makes two side-teams, the match, and the squads (shared players land on both
-- sides, flagged is_shared). Arrays carry pool player ids in batting order.
create or replace function create_pickup_match(
  p_group        uuid,
  p_side_a_name  text,
  p_side_b_name  text,
  p_side_a       uuid[],
  p_side_b       uuid[],
  p_shared       uuid[],
  p_overs        int,
  p_match_date   date,
  p_venue        text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_a uuid; v_team_b uuid; v_match uuid;
  v_per_side int; v_pid uuid; v_ord int;
begin
  if not is_group_admin(p_group) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_a_name, ''), 'Side A'),
            upper(left(coalesce(nullif(p_side_a_name, ''), 'Side A'), 3)), '#16a34a', auth.uid())
    returning id into v_team_a;
  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_b_name, ''), 'Side B'),
            upper(left(coalesce(nullif(p_side_b_name, ''), 'Side B'), 3)), '#2563eb', auth.uid())
    returning id into v_team_b;

  -- Nominal players-per-side = larger squad incl. the shared player(s).
  v_per_side := greatest(
    coalesce(array_length(p_side_a, 1), 0),
    coalesce(array_length(p_side_b, 1), 0)
  ) + coalesce(array_length(p_shared, 1), 0);

  insert into cricket_matches (
    group_id, name, format, overs, players_per_side, match_type,
    team_a_id, team_b_id, venue, match_date, status, created_by
  ) values (
    p_group, 'Pickup game', 'custom', p_overs, greatest(v_per_side, 2), 'pickup',
    v_team_a, v_team_b, p_venue, p_match_date, 'scheduled', auth.uid()
  ) returning id into v_match;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_a, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_a, v_pid, v_ord);
  end loop;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_b, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_b, v_pid, v_ord);
  end loop;

  -- Shared player(s) go on BOTH sides, batting last, flagged.
  foreach v_pid in array coalesce(p_shared, '{}') loop
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_a, v_pid, 99, true);
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_b, v_pid, 99, true);
  end loop;

  return v_match;
end; $$;

-- 4. Add a player to a side mid-match (late arrival) -------------------------
create or replace function add_match_player(
  p_match uuid, p_team uuid, p_player uuid, p_is_shared boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare v_next int;
begin
  if not can_score_match(p_match) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select coalesce(max(batting_order), 0) + 1 into v_next
    from cricket_match_players where match_id = p_match and team_id = p_team;

  insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
    values (p_match, p_team, p_player, v_next, p_is_shared)
    on conflict (match_id, player_id, team_id) do nothing;

  -- A shared late arrival joins the other side too.
  if p_is_shared then
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      select p_match, t.id, p_player, 99, true
        from cricket_matches m
        join cricket_teams t on t.id in (m.team_a_id, m.team_b_id)
       where m.id = p_match and t.id <> p_team
      on conflict (match_id, player_id, team_id) do nothing;
  end if;
end; $$;

grant execute on function create_pickup_match(uuid,text,text,uuid[],uuid[],uuid[],int,date,text) to authenticated, service_role;
grant execute on function add_match_player(uuid,uuid,uuid,boolean) to authenticated, service_role;


-- ============================================================================
-- 0016_player_claim.sql
-- ============================================================================
-- PitchLive — Link a signed-up member to their pool player ("claim your player").
-- Pool players (cricket_players with team_id = null) are just names an admin
-- typed in. When the real person signs up, they claim that name so their login
-- maps to their on-field identity and stats. cricket_players.user_id (from 0011)
-- is the link. One player per user per group.

-- Member self-claim: link my account to an unclaimed pool player in my group.
create or replace function claim_pool_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_owner uuid;
begin
  select group_id, user_id into v_group, v_owner
    from cricket_players where id = p_player and team_id is null;
  if v_group is null then raise exception 'Player not found'; end if;
  if not is_group_member(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_owner is not null and v_owner <> auth.uid() then
    raise exception 'That player is already linked to another member';
  end if;
  -- One linked player per user per group: release any previous claim first.
  update cricket_players set user_id = null where group_id = v_group and user_id = auth.uid();
  update cricket_players set user_id = auth.uid() where id = p_player;
end; $$;

-- Admin override: link a pool player to any member, or unlink (p_user = null).
create or replace function set_player_account(p_player uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from cricket_players where id = p_player;
  if v_group is null then raise exception 'Player not found'; end if;
  if not is_group_admin(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_user is not null then
    update cricket_players set user_id = null where group_id = v_group and user_id = p_user;
  end if;
  update cricket_players set user_id = p_user where id = p_player;
end; $$;

grant execute on function claim_pool_player(uuid) to authenticated, service_role;
grant execute on function set_player_account(uuid, uuid) to authenticated, service_role;


-- ============================================================================
-- 0017_pickup_open_control.sql
-- ============================================================================
-- PitchLive — Distribute control of pickup games.
-- Any member who has CLAIMED their pool player can start and score pickup games
-- (not just admins). Pool roster editing stays admin-only. Standard (named-team)
-- matches are unchanged — still admin/official only.

-- Helper: has the caller claimed a pool player in this group?
create or replace function has_claimed_player(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_players cp
    where cp.group_id = p_group and cp.user_id = auth.uid() and cp.team_id is null
  );
$$;

-- Scoring rights: admins (any match), assigned officials (any match), and — for
-- pickup games — any member who has claimed their player.
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_matches m
    where m.id = p_match and (
      is_group_admin(m.group_id)
      or (m.match_type = 'pickup' and has_claimed_player(m.group_id))
    )
  )
  or exists (
    select 1 from cricket_officials o
    where o.match_id = p_match and o.user_id = auth.uid() and o.can_score
  );
$$;

-- Starting a pickup game: admins OR members who've claimed their player.
create or replace function create_pickup_match(
  p_group        uuid,
  p_side_a_name  text,
  p_side_b_name  text,
  p_side_a       uuid[],
  p_side_b       uuid[],
  p_shared       uuid[],
  p_overs        int,
  p_match_date   date,
  p_venue        text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_a uuid; v_team_b uuid; v_match uuid;
  v_per_side int; v_pid uuid; v_ord int;
begin
  if not (is_group_admin(p_group) or has_claimed_player(p_group)) then
    raise exception 'Only admins or members who have claimed their player can start a game'
      using errcode = '42501';
  end if;

  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_a_name, ''), 'Side A'),
            upper(left(coalesce(nullif(p_side_a_name, ''), 'Side A'), 3)), '#16a34a', auth.uid())
    returning id into v_team_a;
  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_b_name, ''), 'Side B'),
            upper(left(coalesce(nullif(p_side_b_name, ''), 'Side B'), 3)), '#2563eb', auth.uid())
    returning id into v_team_b;

  v_per_side := greatest(
    coalesce(array_length(p_side_a, 1), 0),
    coalesce(array_length(p_side_b, 1), 0)
  ) + coalesce(array_length(p_shared, 1), 0);

  insert into cricket_matches (
    group_id, name, format, overs, players_per_side, match_type,
    team_a_id, team_b_id, venue, match_date, status, created_by
  ) values (
    p_group, 'Pickup game', 'custom', p_overs, greatest(v_per_side, 2), 'pickup',
    v_team_a, v_team_b, p_venue, p_match_date, 'scheduled', auth.uid()
  ) returning id into v_match;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_a, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_a, v_pid, v_ord);
  end loop;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_b, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_b, v_pid, v_ord);
  end loop;

  foreach v_pid in array coalesce(p_shared, '{}') loop
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_a, v_pid, 99, true);
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_b, v_pid, 99, true);
  end loop;

  return v_match;
end; $$;

grant execute on function has_claimed_player(uuid) to authenticated, service_role;

create or replace function record_toss(p_match uuid, p_winner uuid, p_decision toss_decision)
returns void language plpgsql security definer set search_path = public as $$
declare v_a uuid; v_b uuid; v_first uuid;
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode = '42501'; end if;
  select team_a_id, team_b_id into v_a, v_b from cricket_matches where id = p_match;
  if v_a is null then raise exception 'Match not found'; end if;
  v_first := case when p_decision = 'bat' then p_winner
                  when p_winner = v_a then v_b else v_a end;
  update cricket_matches set
    toss_winner_team_id = p_winner, toss_decision = p_decision,
    batting_first_team_id = v_first, toss_at = now(), status = 'toss'
  where id = p_match;
end; $$;
grant execute on function record_toss(uuid, uuid, toss_decision) to authenticated, service_role;


-- ============================================================================
-- 0017_group_rules_open_scoring.sql
-- ============================================================================
-- PitchLive — Per-group cricket rules + open up who can run pickup games.
--
-- (1) groups.cricket_rules holds group-configurable rules (e.g. last-man-stands).
-- (2) Any member who has CLAIMED a pool player can start & score pickup games —
--     not just admins — so the admin isn't the bottleneck. Roster editing and
--     standard (named-team) matches stay admin-only.

-- 1. Per-group rules bag (flexible JSON so new rules don't need a migration each).
alter table groups add column if not exists cricket_rules jsonb not null default '{}'::jsonb;

-- 2. Has the caller claimed a pool player in this group?
create or replace function has_claimed_player(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_players
    where group_id = p_group and user_id = auth.uid() and team_id is null
  );
$$;

-- 3. Scoring rights: admins always; assigned officials; and — for pickup games —
--    any member who has claimed their player.
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_matches m
    where m.id = p_match
      and (is_group_admin(m.group_id)
           or (m.match_type = 'pickup' and has_claimed_player(m.group_id)))
  )
  or exists (
    select 1 from cricket_officials o
    where o.match_id = p_match and o.user_id = auth.uid() and o.can_score
  );
$$;

-- 4. Starting a pickup game: admin OR a member who has claimed their player.
create or replace function create_pickup_match(
  p_group        uuid,
  p_side_a_name  text,
  p_side_b_name  text,
  p_side_a       uuid[],
  p_side_b       uuid[],
  p_shared       uuid[],
  p_overs        int,
  p_match_date   date,
  p_venue        text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_a uuid; v_team_b uuid; v_match uuid;
  v_per_side int; v_pid uuid; v_ord int;
begin
  if not (is_group_admin(p_group) or has_claimed_player(p_group)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_a_name, ''), 'Side A'),
            upper(left(coalesce(nullif(p_side_a_name, ''), 'Side A'), 3)), '#16a34a', auth.uid())
    returning id into v_team_a;
  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_b_name, ''), 'Side B'),
            upper(left(coalesce(nullif(p_side_b_name, ''), 'Side B'), 3)), '#2563eb', auth.uid())
    returning id into v_team_b;

  v_per_side := greatest(
    coalesce(array_length(p_side_a, 1), 0),
    coalesce(array_length(p_side_b, 1), 0)
  ) + coalesce(array_length(p_shared, 1), 0);

  insert into cricket_matches (
    group_id, name, format, overs, players_per_side, match_type,
    team_a_id, team_b_id, venue, match_date, status, created_by
  ) values (
    p_group, 'Pickup game', 'custom', p_overs, greatest(v_per_side, 2), 'pickup',
    v_team_a, v_team_b, p_venue, p_match_date, 'scheduled', auth.uid()
  ) returning id into v_match;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_a, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_a, v_pid, v_ord);
  end loop;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_b, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_b, v_pid, v_ord);
  end loop;

  foreach v_pid in array coalesce(p_shared, '{}') loop
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_a, v_pid, 99, true);
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_b, v_pid, 99, true);
  end loop;

  return v_match;
end; $$;

grant execute on function has_claimed_player(uuid) to authenticated, service_role;
