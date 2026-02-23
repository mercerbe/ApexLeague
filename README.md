# Apex League

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-111111?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?style=for-the-badge&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-1B7F5B?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-2D79C7?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel)](https://vercel.com/)

A Formula 1 2026 season prediction game built as an installable web app. Users sign in with Google, join leagues, place point-based race bets, and compete on season standings using real odds snapshots.

## Highlights

- Google OAuth authentication via Supabase Auth
- League-based competition with race-by-race point bankroll resets
- Odds snapshot model for deterministic, auditable settlement
- Row-Level Security (RLS) policy model for data isolation
- Next.js App Router architecture prepared for PWA rollout

## Core Gameplay Model

- Every race, each user gets a 100-point bankroll.
- Users distribute points across available race markets.
- Bets lock at `race.lock_time`.
- Settlement uses odds captured at placement time.

Scoring:

- Win: `(stake * decimal_odds) - stake`
- Loss: `-stake`
- Void: `0`

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4 | UI, routing, server/client rendering |
| Backend | Supabase Postgres + Auth + Realtime + Edge Functions (planned usage) | Data, auth, realtime and jobs |
| Security | Supabase RLS + policy helpers | Per-user and per-league authorization |
| Validation | Zod | Runtime input validation |
| Hosting | Vercel | CI/CD + deployment |
| Integrations | Google OAuth, Odds API, OpenF1 | Identity, odds ingestion, race data |

## Repository Structure

```text
.
├── AGENT.md                         # Product and architecture brief
├── docs/
│   ├── 00-platform-setup-checklist.md
│   ├── 01-mvp-scope-v1.md
│   ├── 02-technical-spec-v1.md
│   ├── 03-bootstrap-plan.md
│   └── 04-rls-access-model-v1.md
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql            # Base schema
│       └── 0002_rls_policies.sql    # RLS helper functions and policies
└── web/                             # Next.js application
```

## Local Setup

### 1. Prerequisites

- Node.js 20+ recommended
- npm 10+
- Supabase project configured
- Google OAuth app configured in Google Cloud and Supabase

### 2. Install dependencies

```bash
cd web
npm install
```

### 3. Configure environment

Create `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
F1_RESULTS_PROVIDER=openf1
RESEND_API_KEY=
INVITE_EMAIL_FROM=invites@yourdomain.com
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the client.
- `F1_RESULTS_PROVIDER=openf1` is the current integration direction.
- Invite delivery uses Resend when `RESEND_API_KEY` and `INVITE_EMAIL_FROM` are set.

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Authentication Flow (Current)

- `GET /auth/login` starts Google OAuth via Supabase
- Google returns to Supabase callback
- Supabase redirects to `/auth/callback`
- App exchanges code for session and redirects to `/profile`
- `(authed)` route group is session-gated server-side

## Database Setup

Apply migrations in order from `supabase/migrations/`:

1. `0001_init.sql`
2. `0002_rls_policies.sql`
3. `0003_invite_email_delivery.sql`

These establish:

- core domain tables (`profiles`, `races`, `markets`, `leagues`, `bets`, etc.)
- helper authorization SQL functions
- RLS policies by table and actor type

## Available Scripts

Run from `web/`.

| Script | Command | Description |
| --- | --- | --- |
| Development | `npm run dev` | Starts Next.js dev server |
| Build | `npm run build` | Production build (type checks + route build) |
| Start | `npm run start` | Runs the production server |
| Lint | `npm run lint` | ESLint checks |

## Deployment (Vercel)

Set Vercel project **Root Directory** to:

```text
web
```

Required Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your deployed domain in production)
- `SUPABASE_SERVICE_ROLE_KEY`
- `ODDS_API_KEY` (when odds ingestion is enabled)
- `F1_RESULTS_PROVIDER` (currently `openf1`)
- `RESEND_API_KEY` and `INVITE_EMAIL_FROM` (for invite email delivery)

## Product Documentation

Primary planning and architecture references:

- `AGENT.md`
- `docs/01-mvp-scope-v1.md`
- `docs/02-technical-spec-v1.md`
- `docs/04-rls-access-model-v1.md`

## Current Status

Completed:

- MVP scope/spec docs
- Initial schema migration
- Initial RLS policy migration
- Next.js app bootstrap
- Supabase + Google OAuth route wiring
- Auth-protected app route group

In progress:

- Core API routes for leagues, bets, and race markets
- Odds ingestion and settlement workflows
- PWA manifest/service worker and push notifications
