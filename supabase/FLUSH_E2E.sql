-- Flush all PitchLive E2E test data (run in Supabase → SQL Editor).
-- Deleting the group cascades every group-scoped row (grounds, subscriptions,
-- sessions, attendance, wallets, payments, cricket teams/players/matches/innings/
-- deliveries/officials, tournaments, notifications, audit). Deleting the users
-- cascades their profiles.

delete from public.groups where name = 'E2E TEST GROUP';
delete from auth.users where email in ('e2e-test@highonswift.com', 'e2e-run@highonswift.com');
