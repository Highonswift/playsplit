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
