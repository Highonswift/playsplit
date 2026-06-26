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
