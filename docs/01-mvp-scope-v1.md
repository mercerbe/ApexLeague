# Apex League MVP Scope v1

Date: 2026-02-22

## Product Goal
Ship an installable PWA for the 2026 Formula 1 season where authenticated users compete in private/public leagues by placing point-based predictions on race markets and earning season points based on real odds.

## Included in MVP (v1)
1. Authentication
- Google OAuth login via Supabase Auth
- Basic profile bootstrap on first login

2. User profile
- Handle (unique), bio, avatar URL
- View personal betting history and season points summary

3. Leagues
- Create league (name, description, icon URL, privacy)
- Join public league
- Invite by email token link
- League members and standings view

4. Races and markets
- Display 2026 race calendar
- Upcoming race detail with available betting markets from odds provider
- Lock bets at `race.lock_time`

5. Betting gameplay
- 100 points allocated per user per race
- Multi-bet placement across available markets
- Stake validation: total stake per race cannot exceed 100
- Snapshot odds saved at placement time

6. Settlement and scoring
- Server-side settlement after race final results
- Net profit scoring model:
  - win: `(stake * decimal_odds) - stake`
  - loss: `-stake`
  - void: `0`
- League and season standings updated transactionally
- Race winner per league assigned

7. League chat
- Realtime message feed inside each league

8. PWA baseline
- Installable on iOS/Android
- Manifest + service worker + offline shell for core routes

## Excluded from MVP (post-v1)
- Real-money wallet/payments
- Advanced social features (reactions, follows, DMs)
- Multi-provider odds failover
- Admin dashboards beyond minimal ops tooling
- Complex promo/achievements system
- Native mobile apps

## MVP Success Criteria
- User can sign in with Google, create or join a league, place bets before lock, and see standings update after settlement.
- Scoring is deterministic, auditable, and reproducible from stored bet snapshots.
- PWA passes installability checks and serves cached shell offline.
