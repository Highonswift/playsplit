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
