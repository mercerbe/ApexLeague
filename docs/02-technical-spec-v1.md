# Apex League Technical Spec v1

Date: 2026-02-22

## Architecture
- Frontend: Next.js App Router + TypeScript + Tailwind
- Backend: Supabase Postgres + Auth + Realtime + Edge Functions
- Hosting: Vercel
- External APIs: Odds provider (markets), F1 results provider (race outcomes)

## Core Domain Entities
- `profiles`: user metadata and handle
- `races`: schedule, status, lock window
- `markets`: odds snapshots for race outcomes
- `leagues`: group competition container
- `league_members`: membership + cumulative points
- `league_invites`: email invites + token lifecycle
- `bets`: user bet placements and settlement outcome
- `race_results`: canonical outcomes for settlement
- `league_messages`: chat
- `push_subscriptions`: browser push endpoints/keys

## State Machines

### Race Lifecycle
1. `scheduled` -> future race, bets open
2. `locked` -> reached `lock_time`, no new bets
3. `settling` -> results present, settlement running
4. `settled` -> all related bets resolved

Transition rules
- `scheduled -> locked` when `now >= lock_time`
- `locked -> settling` when official result ingested
- `settling -> settled` when all pending bets for race are resolved in one transaction

### Bet Lifecycle
1. `pending` -> accepted before lock
2. `won` / `lost` / `void` -> final state after settlement

Constraints
- `placed_at < race.lock_time`
- `sum(stake by user,race) <= 100`
- `decimal_odds_snapshot > 1.0`

## API Surface (v1)

### Auth/Profile
- `GET /api/me`
- `PATCH /api/me`

### Leagues
- `GET /api/leagues?visibility=public`
- `POST /api/leagues`
- `POST /api/leagues/:leagueId/join`
- `POST /api/leagues/:leagueId/invites`
- `GET /api/leagues/:leagueId`
- `GET /api/leagues/:leagueId/standings`

### Races/Markets
- `GET /api/races?status=scheduled|locked|settled`
- `GET /api/races/:raceId/markets`

### Bets
- `POST /api/races/:raceId/bets`
- `GET /api/races/:raceId/bets/me`
- `GET /api/leagues/:leagueId/bets/me`

### Settlement (internal)
- `POST /api/internal/races/:raceId/settle`

### Chat
- Realtime subscription on `league_messages`
- `POST /api/leagues/:leagueId/messages`

## Key Request/Response Contracts

### Place Bets
`POST /api/races/:raceId/bets`

Request:
```json
{
  "bets": [
    {
      "market_id": "uuid",
      "selection_key": "max_verstappen_win",
      "stake": 25
    }
  ]
}
```

Validation:
- `bets` length >= 1
- each `stake` integer > 0
- aggregate race stake including existing pending bets <= 100
- race status must be `scheduled`

Response:
```json
{
  "race_id": "uuid",
  "accepted_bets": [
    {
      "bet_id": "uuid",
      "status": "pending",
      "stake": 25,
      "decimal_odds_snapshot": "2.40"
    }
  ],
  "remaining_points": 75
}
```

### Settle Race (internal)
`POST /api/internal/races/:raceId/settle`

Request:
```json
{
  "idempotency_key": "race-<race_id>-<revision>",
  "source": "official_results"
}
```

Response:
```json
{
  "race_id": "uuid",
  "settled_bets": 372,
  "status": "settled"
}
```

## Non-Functional Requirements
- Idempotent settlement operation per race
- Server-authoritative scoring only
- RLS on all user-facing tables
- Auditability: every bet stores odds snapshot, market snapshot reference, timestamps

## Error Codes (initial)
- `RACE_LOCKED`
- `RACE_NOT_FOUND`
- `MARKET_NOT_FOUND`
- `STAKE_LIMIT_EXCEEDED`
- `BET_ALREADY_SETTLED`
- `UNAUTHORIZED`
