# Settlement Skeleton (Manual Trigger)

Endpoint:

- `POST /api/internal/races/:raceId/settle`

Authentication:

- Header `Authorization: Bearer <SETTLEMENT_CRON_SECRET>`
  or
- Header `x-settlement-secret: <SETTLEMENT_CRON_SECRET>`

Required env var:

- `SETTLEMENT_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

## Race Result Input Contract

The skeleton infers outcomes from `race_results` rows at the latest `revision`.

Supported result formats:

1. `result_key = 'winning_selection_key'`, `result_value = '<selection_key>'`
2. `result_key = 'winning_selection_keys'`, `result_value = '["key1","key2"]'` or `key1,key2`
3. `result_key = 'void_selection_key'`, `result_value = '<selection_key>'`
4. `result_key = 'void_selection_keys'`, `result_value = '["key1","key2"]'` or `key1,key2`
5. `result_key = 'selection:<selection_key>'`, `result_value = 'won' | 'void' | 'true' | '1'`

## What the endpoint does

1. Verifies secret auth
2. Ensures race exists and is not already settled
3. Moves race status to `settling`
4. Loads pending bets for the race
5. Resolves each pending bet to `won` / `lost` / `void`
6. Writes `gross_return`, `net_profit`, `settled_at`
7. Aggregates net profit per league-member and updates `league_members.season_points`
8. Upserts `race_league_winners`
9. Marks race `settled` and stamps `result_revision`

## Notes

- This is a skeleton implementation and not fully transactional.
- Re-running after completion is safe (`status=settled` returns early).
- If you need strict transaction guarantees, next step is moving settlement logic into a Postgres function/RPC.
