-- PlaySplit local seed — runs automatically on `supabase db reset`.
-- Two test users (password: Playsplit@123). Profiles are auto-created by the
-- on_auth_user_created trigger. Fixed UUIDs keep them stable across resets.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', '9df2e12b-acfd-4c84-942d-44087d2faabd',
   'authenticated', 'authenticated', 'admin@playsplit.test',
   crypt('Playsplit@123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin"}', false, false),
  ('00000000-0000-0000-0000-000000000000', '4f726760-e6c6-4835-a5b6-b4ee22ce8d94',
   'authenticated', 'authenticated', 'player@playsplit.test',
   crypt('Playsplit@123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Player"}', false, false)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), '9df2e12b-acfd-4c84-942d-44087d2faabd', 'admin@playsplit.test', 'email',
   '{"sub":"9df2e12b-acfd-4c84-942d-44087d2faabd","email":"admin@playsplit.test"}', now(), now(), now()),
  (gen_random_uuid(), '4f726760-e6c6-4835-a5b6-b4ee22ce8d94', 'player@playsplit.test', 'email',
   '{"sub":"4f726760-e6c6-4835-a5b6-b4ee22ce8d94","email":"player@playsplit.test"}', now(), now(), now())
on conflict do nothing;
