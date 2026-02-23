# Step 5 Regression Runbook (Post-Deploy)

## Scope
Use this runbook to verify Apex League is still aligned with the main product goals after each deployment.

Base URL (production):
- `https://apex-league-three.vercel.app`

## Goal Matrix (Current State)
1. OAuth login: **Implemented**
2. Create profile: **Partial** (profile row auto-created; no full profile editor yet)
3. Join league: **Implemented**
4. Create league + Gmail invites: **Partial** (invite link flow implemented; no outbound Gmail sending yet)
5. 2026 schedule + 100-token betting: **Implemented** (depends on seeded races/markets)
6. League chat/feed: **Implemented**
7. League leaderboard: **Partial** (standings list exists, limited presentation)
8. Marketing landing page + F1 animation: **Partial** (basic page exists, no rich animation/gamification narrative yet)
9. Group marketplace / cross-league standings feed: **Not implemented**

## Regression Checklist

### 1) OAuth login
- Open `/`
- Click `Continue with Google`
- Complete Google OAuth
- Expected: redirected to `/profile` and session persists

### 2) Profile
- Navigate to `/profile`
- Expected now: page loads with placeholder content
- Gap to track: editable profile fields (handle, bio, avatar)

### 3) League join flow
- Navigate to `/leagues`
- Join a public league
- Expected: redirected to `/league/{id}`, membership banner appears

### 4) League create + invite flow
- On `/leagues`, create a new league
- On `/league/{id}`, use invite form with a valid email
- Expected: invite token/link appears in UI and in invite history
- Current limitation: no SMTP/Gmail delivery; invite URL is generated and shareable manually

### 5) Races + betting bankroll
- Navigate to `/races`
- Confirm 2026 races render
- Open one race market screen `/races/{raceId}/bets`
- Place stakes across markets
- Expected:
  - total pending + new stakes cannot exceed 100 tokens
  - API rejects over-allocation with `STAKE_LIMIT_EXCEEDED`
  - placed bets appear in "Your Bets"

### 6) Chat/feed in league
- Navigate to `/league/{id}`
- Confirm "League Feed" module renders for league members
- Post a new message in the feed
- Expected:
  - message is persisted and appears in the timeline
  - non-members see a join-required prompt instead of feed content

### 7) League leaderboard
- On `/league/{id}`
- Expected: standings section renders members with points
- Gap to track: richer ranking UX and usernames instead of sliced UUIDs

### 8) Landing page quality
- Open `/` signed out
- Expected now: basic hero with OAuth CTA
- Gap to track: richer gamification explanation and F1 animations

### 9) Group marketplace / cross-league standings
- Search nav/pages for cross-league board
- Expected now: no dedicated feature
- Mark as known gap

## API Smoke Endpoints
- `GET /api/leagues?visibility=public`
- `GET /api/races?season=2026`
- `GET /api/races/{raceId}/markets`
- `GET /api/races/{raceId}/bets/me?league_id={leagueId}` (requires auth)
- `POST /api/races/{raceId}/bets` (requires auth)
- `POST /api/leagues/{leagueId}/join` (requires auth)
- `POST /api/leagues/{leagueId}/invites` (requires auth)
- `GET /api/leagues/{leagueId}/messages?limit=50` (requires auth + membership)
- `POST /api/leagues/{leagueId}/messages` (requires auth + membership)

## Exit Criteria
- No production 5xx on core pages (`/`, `/leagues`, `/league/{id}`, `/races`, `/races/{raceId}/bets`)
- OAuth works end-to-end
- Betting cap (100 tokens) enforced
- No regressions in create/join/invite flows
- Known gaps captured as backlog items (not silent failures)
