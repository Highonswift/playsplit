# PlaySplit

Smart Sports Subscription & Expense Management Platform — a transparent,
automated alternative to Excel sheets and WhatsApp reminders for recurring
sports groups (cricket first, extensible).

Built as a **mobile-first responsive Next.js PWA** backed by **Supabase**, with
a pure, fully-tested **settlement engine** as its core. Native mobile (Expo)
is a later phase; the monorepo is structured to add it cleanly.

## Monorepo layout

```
playsplit/
  apps/web/            Next.js 15 (App Router) PWA — Tailwind, responsive shell
  packages/core/       Settlement engine: pure TS + 35 Vitest cases (no I/O)
  supabase/            Postgres schema, RLS policies, config
  tsconfig.base.json   Shared TS config
  turbo.json           Turborepo pipeline
```

## The settlement engine (`packages/core`)

The product's spine (PRD §28). Pure, deterministic, exhaustively unit-tested:

- **Hour deduction** with dual hour/time expiry (PRD §10) and hourly-rate overflow.
- **Four cost-sharing models** (PRD §11): Equal, Usage-based, Investor, Hybrid —
  each conserving money to the paise via a largest-remainder allocator.
- **Wallet postings** + a human-readable settlement explanation (dispute elimination).
- **Idempotent** by `matchId`: re-settling yields byte-identical postings.

All money is integer **paise**; never floating-point rupees.

```bash
pnpm --filter @playsplit/core test        # 35 tests
```

## Data model & security (`supabase/`)

- 15 tables, 9 enums, append-only wallet ledger, full audit trail.
- **Row Level Security** on every table: multi-tenant by `group_id`, role-gated
  (`platform_admin` / `group_admin` / `player`) via non-recursive
  `SECURITY DEFINER` helpers. Verified: non-members see nothing.
- Privileged settlement/payment writes use the service-role key in server actions.

## Getting started

```bash
pnpm install

# 1. Local Supabase (needs Docker Desktop running)
npx supabase start                         # applies migrations in supabase/migrations
cp apps/web/.env.example apps/web/.env.local   # local defaults are pre-filled

# 2. Web app
pnpm --filter @playsplit/web dev           # http://localhost:3000
```

Routes: `/` landing · `/login` (phone OTP / email / Google / Apple) ·
`/dashboard` (auth-gated group dashboard) · `/demo` (public seeded preview).

## Status

| Milestone | State |
|-----------|-------|
| M0 Monorepo + tooling | ✅ done |
| M0 Supabase schema + RLS | ✅ done & verified |
| M0 Next.js PWA shell + auth | ✅ done & verified (desktop + mobile) |
| M4 Settlement engine | ✅ done, 35 tests green |
| M1–M3 Groups / grounds / subscriptions / matches / attendance | ⏳ next |
| M5–M7 Payments / dashboards / reports / polish | ⏳ planned |

See the approved plan for the full Phase 1 MVP scope.
