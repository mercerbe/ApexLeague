# Step 3 Bootstrap Plan (App Initialization)

Date: 2026-02-22

## Current Status
- Automated scaffold from this environment is blocked by network restrictions (cannot reach npm registry).
- Command to run on your machine:

```bash
npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

## Immediate Follow-up in `web/`
Run after scaffold:

```bash
cd web
npm install @supabase/supabase-js @supabase/ssr zod
```

## Base Project Structure (target)
- `src/app/(public)/page.tsx` landing + Google sign in
- `src/app/(authed)/profile/page.tsx`
- `src/app/(authed)/leagues/page.tsx`
- `src/app/(authed)/league/[id]/page.tsx`
- `src/app/(authed)/races/[raceId]/bets/page.tsx`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/validation/`
- `src/app/api/`

## Environment Variables
Use the root `.env.example` in this repo as the source of truth.
