# Deploying PlaySplit (production + friends testing)

Two pieces: **Supabase** (hosted backend) and **Vercel** (Next.js web app).
Free tiers are enough for a small testing group.

## 1. Supabase — hosted backend

1. Create a project at https://supabase.com (note the **project ref** and the **database password**).
2. From the repo root, link and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies everything in supabase/migrations/
   ```
   > Do **not** run `db reset` against production — it would wipe data and run the
   > local-only test seed. `db push` only applies migrations.
3. In the dashboard → **Project Settings → API**, copy:
   - Project URL  → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed)
4. **Auth → Providers → Email**: keep Email enabled. For frictionless friends
   testing, turn **"Confirm email" OFF** so password sign-up logs in immediately.
   (Turn it back on for real production.)
5. **Auth → URL Configuration**: set **Site URL** to your Vercel domain and add
   `https://<domain>/auth/callback` to redirect URLs.
6. (Optional) **Auth → Providers → Google**: add OAuth client id/secret to enable
   the Google button.

## 2. Vercel — web app

1. Push this repo to GitHub (already done: `Highonswift/playsplit`).
2. In Vercel → **New Project** → import the repo.
   - **Root Directory**: `apps/web`
   - Framework preset: **Next.js** (auto-detected). Build/install commands are
     auto-detected for the pnpm monorepo.
3. Add **Environment Variables** (from step 1.3):
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```
   Razorpay (optional, only if collecting online payments):
   ```
   RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET
   RAZORPAY_WEBHOOK_SECRET
   NEXT_PUBLIC_RAZORPAY_KEY_ID
   ```
4. Deploy. You get a URL like `https://playsplit.vercel.app`.

## 3. Razorpay (optional — online collection)

- Create a Razorpay account, use **test keys** first.
- Add a webhook → URL `https://<domain>/api/razorpay/webhook`, event
  `payment.captured`, secret = `RAZORPAY_WEBHOOK_SECRET`.
- Without keys, admins can still record cash/UPI/bank payments manually.

## 4. Share with friends for testing

1. Send them the Vercel URL.
2. Each friend opens it → **Create an account** (name + email + password) → they're in.
   - On mobile, "Add to Home Screen" installs it as an app (PWA).
3. You (admin) create the group in **Groups**, then share the **invite code**.
4. Friends go to **Groups → Create or join another group → Join with a code**.
5. Create a match, mark attendance, **Settle** → everyone sees their wallet share;
   record payments as they pay.

## Notes
- All money is stored as integer paise; the settlement engine is unit-tested (35 cases).
- Free Supabase email is rate-limited (~a few/hour). With email confirmation off,
  password sign-up doesn't depend on email delivery.
- To seed test users locally only: `supabase/seed.sql` runs on local `db reset`.
