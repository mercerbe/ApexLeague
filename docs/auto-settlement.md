# Automatic Result Ingestion and Settlement

This project now supports automated race result ingestion (OpenF1) and auto-settlement via cron.

## Internal endpoints

- `POST /api/internal/races/:raceId/ingest-results`
- `POST /api/internal/races/:raceId/settle`
- `GET /api/internal/cron/settle-races`

All three require internal auth secret:

- `Authorization: Bearer <SETTLEMENT_CRON_SECRET>`
  or
- `x-settlement-secret: <SETTLEMENT_CRON_SECRET>`

`CRON_SECRET` is also supported as a fallback if `SETTLEMENT_CRON_SECRET` is not set.

## OpenF1 ingestion behavior

`ingest-results`:

1. finds the closest OpenF1 `Race` session for the local race
2. ensures session is finalized (`date_end <= now`)
3. fetches:
- `/session_result`
- `/drivers`
- `/laps`
4. maps market `selection_key` -> driver
5. writes `race_results` rows at `revision = races.result_revision + 1` with keys:
- `selection:<selection_key>` = `won|lost|void`

## Cron orchestrator behavior

`settle-races`:

1. selects races with `status in ('locked','settling')` and `start_time <= now`
2. runs `ingest-results` for each race
3. if finalized, runs `settle` for that race
4. returns JSON summary for successes/pending/failures

## Vercel cron

File: `web/vercel.json`

Configured schedule:

- every 10 minutes: `*/10 * * * *`

Path:

- `/api/internal/cron/settle-races`

## Required environment variables

Set in Vercel (Production and Preview as needed):

- `SETTLEMENT_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `F1_RESULTS_PROVIDER=openf1`

Optional fallback:

- `CRON_SECRET`
