# Platform Setup Checklist (Your Side)

Date: 2026-02-22

## 1. Supabase
1. Create a new Supabase project (prod region close to primary users).
2. Save these values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `SUPABASE_PROJECT_REF`
3. In Supabase Auth:
- Enable Google provider.
- Set site URL(s):
  - Local: `http://localhost:3000`
  - Preview/Prod: your Vercel domains
- Add redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://<your-domain>/auth/callback`
4. Turn on Realtime for `league_messages` when table exists.
5. Keep SQL editor access ready for migrations (or Supabase CLI if you prefer).

## 2. Google Cloud Console (OAuth)
1. Create/select a Google Cloud project.
2. Configure OAuth consent screen:
- App name, support email, developer email
- Add scopes: `email`, `profile`, `openid`
3. Create OAuth client credentials (Web application).
4. Add authorized origins:
- `http://localhost:3000`
- `https://<your-vercel-domain>`
5. Add authorized redirect URIs:
- `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
6. Copy:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
7. Put these in Supabase Google provider settings.

## 3. Vercel
1. Create a Vercel project linked to this repo.
2. Add environment variables for Preview + Production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ODDS_API_KEY`
- `F1_RESULTS_API_KEY`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
3. Set build command defaults from Next.js scaffold.
4. Add production custom domain once ready.

## 4. Odds + Results APIs
1. Choose and register odds provider (The Odds API or equivalent with motorsport coverage).
2. Choose and register race-results source (official or reputable feed).
3. Save and test keys:
- `ODDS_API_KEY`
- `F1_RESULTS_API_KEY`
4. Confirm rate limits and per-minute quotas.

## 5. Push Notifications (Web Push)
1. Generate VAPID key pair:
```bash
npx web-push generate-vapid-keys
```
2. Save:
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (e.g., `mailto:you@domain.com`)

## 6. Domain + Redirect Hygiene
1. Decide canonical app URLs now (local, preview, prod).
2. Keep Google OAuth, Supabase redirect URLs, and Vercel domains aligned exactly.
3. Any mismatch here will break login flow.

## 7. Secrets Handling
- Never expose service-role, Google secret, or VAPID private key in client bundles.
- Only `NEXT_PUBLIC_*` variables are allowed client-side.
