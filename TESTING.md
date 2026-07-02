# PlaySplit — QA Test Plan

A complete guide for the testing team to validate PlaySplit end-to-end. Work
through it top to bottom; each case has **steps** and an **expected result**.
Mark each Pass / Fail and log defects using the template at the end.

---

## 1. About the app

PlaySplit helps recurring sports groups manage ground bookings, subscriptions,
attendance, fair cost-sharing, wallets, and payments. Money is always shown in
**₹ (INR)**. It's a mobile-first web app (installable as a PWA).

**Two roles:**
- **Group Admin** — creates the group, adds grounds/subscriptions, creates matches, marks attendance, settles matches, records payments.
- **Player** — joins via invite code, views matches/dashboard, sees their own wallet, pays their dues.

---

## 2. Test environment & access

| Item | Value |
|------|-------|
| App URL | `https://<your-vercel-domain>` *(filled in by the owner)* |
| Supported browsers | Latest Chrome, Safari, Edge; iOS Safari & Android Chrome |
| Screen sizes | Test both **mobile** (phone) and **desktop** (laptop) |

**You do NOT need pre-made accounts** — everyone self-registers (below). To test
multi-user flows, use 2–3 real testers, or the same person in a normal window +
an incognito/private window (each window = a different user).

> ⚠️ This is a **test build**. Use fake/small amounts. Don't enter real card or
> bank details anywhere. Online card payment (Razorpay) may be disabled — use
> "record payment" (cash/UPI) instead; see §9.

---

## 3. Getting started (every tester does this once)

| # | Step | Expected |
|---|------|----------|
| 3.1 | Open the app URL | Landing page with "Get started" / "Sign in" |
| 3.2 | Go to **Sign in → Password tab**, enter an email + password, submit (or use the sign-up flow the owner enabled) | Account created; redirected to onboarding |
| 3.3 | You have no group yet → **"Welcome to PlaySplit"** screen shows | Create / Join options visible |
| 3.4 | Go to **Settings → Your profile**, set your **Display name**, Save | Name saved; appears across the app instead of "Unnamed player" |

> If email confirmation is ON, you'll receive a verification email first. If OTP
> is used, enter the 6-digit code from your email.

---

## 4. Roles & test-team setup (recommended)

Assign one tester as **Admin** and the others as **Players**:
1. **Admin** completes §5.1 (create group) and shares the **invite code**.
2. **Players** complete §5.2 (join with code).
3. Everyone sets their display name (§3.4).

---

## 5. Groups & members

| # | Role | Step | Expected |
|---|------|------|----------|
| 5.1 | Admin | Create group: name "Saturday Cricket", sport Cricket | Lands on dashboard; you are **Group Admin**; "1 member" |
| 5.2 | Player | Onboarding → **Join with a code** → paste invite code | Joins group; dashboard shows the group; role **Player** |
| 5.3 | Any | Settings → Group & members | Roster lists all members with correct roles; admin has a crown |
| 5.4 | Admin | Copy invite code (tap the code chip) | "Copied" confirmation |
| 5.5 | Player | Try to open Grounds/Matches admin actions | Player cannot add grounds, create matches, or settle (no such buttons) |
| 5.6 | Any in 2 groups | Use the group switcher (Groups page) | Dashboard/data changes to the selected group |
| 5.7 | Negative | Join with a wrong/invalid code | Clear error "Invalid invite code" |

---

## 6. Grounds & subscriptions (Admin)

| # | Step | Expected |
|---|------|----------|
| 6.1 | Settings → Grounds & subscriptions → **Add a ground**: "Greenfield Turf", hourly rate **600** | Ground appears showing **₹600.00/h** |
| 6.2 | **Purchase a subscription**: name "July", ground Greenfield, cost **8000**, hours **20**, validity **30** days | Subscription shows **Green**, **20h of 20h**, **₹400.00/h** (8000 ÷ 20), end date 30 days out |
| 6.3 | Check the dashboard | Subscription card shows the same (Green, 20h, 30d, progress bar full) |
| 6.4 | Negative | Add ground with blank name or 0 rate | Validation error, not saved |

**Subscription status colours** (verify as hours/days change through testing):
- **Green** healthy · **Yellow** ≤5h or ≤7 days left · **Red** ≤2h or ≤2 days left · **Expired** hours=0 or past validity · **Gray** not started.

---

## 7. Matches & attendance (Admin creates; all can view)

| # | Step | Expected |
|---|------|----------|
| 7.1 | Matches → **Create a match**: today, 06:00–08:00, Greenfield, subscription "July" | Redirects to match detail; status **Scheduled**; duration **2.0h** |
| 7.2 | On match detail, tick **present** for the players who came | Present count updates; each present player shows a minutes box (defaults to 120) |
| 7.3 | Set **partial minutes** for someone (e.g. 60 for a late arrival) | Value accepted (≤ match duration) |
| 7.4 | Mark someone as **investor** (checkbox) | Flag set (matters for Investor/Hybrid models — §8) |
| 7.5 | **Save attendance** | "Saved ✓" |
| 7.6 | Player logs in and opens the match | Can view details & attendance (read-only), cannot edit or settle |

---

## 8. Settlement & cost models (the core — verify the math)

Baseline for the examples below: **Greenfield ₹600/h**, subscription **₹400/h**,
match **2 hours**. Set the group's cost model in **Settings → Cost-sharing model**
before creating/settling the match, then: create match → mark attendance → **Settle match**.

After settling: match becomes **Settled**, shows **Total cost**, a per-player
breakdown, subscription **hours reduce**, and each player's **wallet** is debited.

### 8.1 Equal split
4 players present, all 2h.
- Total = 2h × ₹400 = **₹800**
- Each owes **₹200** (800 ÷ 4). ✅ Sum of shares = ₹800 exactly.

### 8.2 Usage-based
3 players present: 120 / 60 / 60 minutes.
- Total = **₹800**
- Shares proportional to minutes → **₹400 / ₹200 / ₹200**. ✅ Sum = ₹800.

### 8.3 Investor model
2 investors + 2 occasional, all 2h. (Tick "investor" for the two investors.)
- Occasional pay hourly: 2h × ₹600 = **₹1,200 each**
- Investors pay sub-rate ₹800, then get a share of the premium the occasional
  players paid → net **₹400 each**.

### 8.4 Hybrid model
Same 2 investors + 2 occasional, all 2h.
- Occasional (pay-per-use): **₹1,200 each**
- Investors split their sub-cost equally, minus premium → **₹400 each**.

| # | Step | Expected |
|---|------|----------|
| 8.5 | After 8.1 settle, open **Wallet** as a present player | Balance shows **owes ₹200** (or your model's share) with a "Match usage" transaction |
| 8.6 | Check **Grounds & subscriptions** | Subscription hours dropped by 2 (e.g. 20h → 18h) |
| 8.7 | **Re-settle** the same match is not offered once settled | No double-charge; totals unchanged (idempotent) |
| 8.8 | Settle a match with **no subscription** selected | Whole match charged at the **₹600/h** ground rate |
| 8.9 | Negative | Try to settle with **no one marked present** | Blocked with "mark at least one player present" |

> The key correctness check: **the sum of everyone's shares always equals the
> match Total cost — to the paise.** If it ever doesn't, that's a defect.

---

## 9. Wallet & payments

| # | Role | Step | Expected |
|---|------|------|----------|
| 9.1 | Player | Wallet after a settled match | Shows **Outstanding** (red) = your share; transaction list has the usage debit |
| 9.2 | Admin | Wallet → **Collections** | Lists every member and who owes what |
| 9.3 | Admin | **Record a payment** for a member who owes (e.g. ₹200, Cash) | Their balance drops to **₹0** ("Credit balance"); a "+₹200 Payment" entry appears; shows under "Recent payments" |
| 9.4 | Player | After admin records their payment | Their wallet shows ₹0 and a "Payment received" notification |
| 9.5 | Player | If online payment is enabled: **Pay now** | Razorpay checkout opens; on success balance clears. *(If disabled, expect a "not configured" message — use 9.3 instead.)* |

---

## 10. Dashboard & reports

| # | Step | Expected |
|---|------|----------|
| 10.1 | Dashboard after some matches/payments | **Pending payments**, **Collection rate %**, **Attendance %**, **Savings**, **Upcoming matches** all reflect real data |
| 10.2 | Savings value | ≈ (₹600 − ₹400) × hours consumed (the money saved vs hourly) |
| 10.3 | Reports → Payment collection | Collected vs Outstanding and % match the wallet totals |
| 10.4 | Reports → Subscription utilization | Shows consumed/purchased hours and any expired hours |
| 10.5 | Reports → Attendance | Per-player match counts look correct |
| 10.6 | Reports → Wallet statement | Every member's balance is listed |

---

## 11. Notifications

| # | Step | Expected |
|---|------|----------|
| 11.1 | Player, after a match is settled | A **bell badge** shows an unread count; Notifications page has "Match settled" |
| 11.2 | Player, after admin records their payment | "Payment received" notification appears |
| 11.3 | Tap **Mark all read** | Badge clears |

---

## 12. PWA (install & offline)

| # | Step | Expected |
|---|------|----------|
| 12.1 | Mobile browser → menu → **Add to Home Screen** | Installs with the green "P" icon; opens full-screen (no browser bar) |
| 12.2 | Open the installed app, browse a few pages, then enable **Airplane mode** and navigate | An **"You're offline"** page appears instead of a browser error |
| 12.3 | Desktop Chrome | An **install** icon appears in the address bar |

---

## 13. Responsive / cross-device

| # | Step | Expected |
|---|------|----------|
| 13.1 | Use the app on a **phone** | Bottom navigation bar; content stacks in one/two columns; nothing overflows sideways |
| 13.2 | Use on a **laptop** | Left sidebar navigation; wider layout; same features |
| 13.3 | Rotate phone / resize window | Layout adapts smoothly |

---

## 14. Security & multi-tenant isolation (important)

| # | Step | Expected |
|---|------|----------|
| 14.1 | Player opens **Wallet** | Sees **only their own** balance & transactions (not other members') |
| 14.2 | Two different groups (e.g. two testers each create their own) | Neither can see the other group's members, grounds, matches, or wallets |
| 14.3 | Player attempts admin actions via the UI | No admin controls are available |
| 14.4 | Sign out | Returns to login; protected pages redirect to login if visited afterward |

---

## 15. Suggested full end-to-end scenario (multi-user)

Run this with **1 admin + 2 players** for a realistic pass:
1. Admin creates group, shares code. Both players join and set names.
2. Admin adds a ground and buys a 20h subscription.
3. Admin creates a 2-hour match, marks all 3 present, settles (Equal model).
4. Each player checks their wallet shows the correct owed amount.
5. Admin records a cash payment from one player; that player's balance clears and they get a notification.
6. Everyone checks the dashboard + reports reflect the activity.
7. One player installs the PWA and tests offline.

---

## 16. Known limitations (not bugs)
- **Online card payments (Razorpay)** work only if test keys are configured; otherwise use admin "record payment".
- **Subscription expiry** is processed by a scheduled job (daily) — status colours still update live on screen.
- **Phone-OTP / Google / Apple** sign-in may be disabled depending on the environment; email/password is the primary test path.

---

## 17. Bug report template

Please log each issue with:

```
Title:            <short summary>
Severity:         Blocker / Major / Minor / Cosmetic
Role & account:   Admin or Player, which email
Device/browser:   e.g. iPhone 14, Safari  /  Windows, Chrome
Steps to reproduce:
  1.
  2.
  3.
Expected result:
Actual result:
Screenshot/video: <attach>
Money values involved (if any): amounts, cost model, subscription
```

**Priorities to watch closely:** any case where **money doesn't add up**
(shares ≠ total, wrong balance, double charge), where a user **sees another
user's/group's data**, or where **settlement/payment fails**.
