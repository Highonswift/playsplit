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
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
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
