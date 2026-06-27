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
