# AGENT.md

## Formula 1 Betting Game -- 2026 Season

Generated: 2026-02-22T19:13:35.977152

------------------------------------------------------------------------

# TABLE OF CONTENTS

1.  Original Product Prompt\
2.  Full Conversation Transcript\
3.  Consolidated Technical Specification\
4.  Architecture Overview\
5.  Points Engine Specification\
6.  Database Schema\
7.  Settlement Flow\
8.  Product Philosophy

------------------------------------------------------------------------

# 1. ORIGINAL PRODUCT PROMPT

I want to build a Formula 1 betting game for the 2026 season. This
should leverage the best sports betting odds API to figure out how many
points a user can get in return for each bet they place for each race
during the season. The app should be a PWA that can be installed on
iPhones and Android, with push notifications about races and bets
placed. We'll also use OAuth for the login, letting users login with
Gmail. The initial page should be a simple OAuth login with a sort
description of how the game is played: A user can login, either start or
join a league and place 'bets' on each race to score points when they
place a winning bet. When a user logs in they will be directed to their
profile where they can set a handle, add a short bio and see any
historical data of their bets along with the stats of any league they're
currently in. The other main public view should be a list of all the
active leagues that are available to join, along with some data/summary
cards that show the upcoming race popular bets and odds. We might also
add a news feed in there that hooks into an F1 news API so users can do
research from this public league/information view. The other view will
be a form that let's a user create a new league that has a name,
description, icon for the league and the ability to invite people to
join the league. You can invite people by either searching users already
on the platform OR if someone is not on the platform, send them an email
invite that directs them to create an account on the app. Once a user is
in a league, we'll review the gameplay. Every time there's an upcoming
race in the 2026 season, a user will get x number (maybe 100?) of points
to place bets across all the available bets we've fetched from the Odds
API for that race. After the race concludes, the user will get the
amount of points returned to them based on the odds for each
prediction/bet they got correct. these points get added to their season
total. Every race the user will restart with the same number of points
to bet so it's an even playing field each week. The winner of the league
will be the person who's earned the most points at the end of the
season. There will also be a 'winner of the race' award given after each
race to the person in the league who earned the most points from their
bets on that race. The last feature is I want a chat within each league
so those users in a league together can chat with each other for fun. I
think that's everything we need to get started.

------------------------------------------------------------------------

# 2. FULL CONVERSATION TRANSCRIPT

## User

Let's knock out the points engine, it should mirror the odds we retrieve
from the odds API

## Assistant

Provided full sportsbook-mirroring points engine specification
including: - Decimal conversion - Net profit calculation - Snapshot odds
rule - Race reset logic - Race winner logic - Exploit considerations -
Settlement flow - Multi-bet example

## User

let's design the Supabase schema for everything we need in the App

## Assistant

Provided full production-ready Supabase schema including: - profiles -
races - markets - leagues - league_members - league_invites - bets -
race_results - league_messages - notifications - news_articles - RLS
strategy - Settlement transaction structure - Indexing strategy

## User

Let's take everything we've talked about so far and write a very
detailed AGENT.md file, including my initial prompt

## Assistant

Generated structured AGENT.md specification including: - Original
prompt - Product vision - Architecture - APIs - Points engine - Schema -
Settlement flow - Roadmap

## User

Make the full prompt and conversation a downloadable AGENT.md file

## Assistant

Generated downloadable AGENT.md file.

## User

let's do the first 2 bullet points

------------------------------------------------------------------------

# 3. CONSOLIDATED TECHNICAL SPECIFICATION

## Core Stack

Frontend: Next.js (App Router), Tailwind, PWA\
Backend: Supabase (Postgres + Auth + Realtime + Edge Functions)\
Hosting: Vercel\
Auth: Google OAuth\
Push: Web Push API (iOS 16.4+ supported)

------------------------------------------------------------------------

# 4. ARCHITECTURE OVERVIEW

-   Snapshot odds at bet placement
-   Backend-enforced race lock
-   100 point reset each race
-   Server-side settlement
-   Row-level security everywhere
-   No real money

------------------------------------------------------------------------

# 5. POINTS ENGINE SPECIFICATION

Each race: - User receives 100 points - Allocate across bets - Lock at
race.lock_time

Formula: Return = stake × decimal_odds\
Net Profit = Return − Stake

If lost: Net Profit = −stake

If void: Net Profit = 0

SeasonPoints += Sum(NetProfit per race)

------------------------------------------------------------------------

# 6. DATABASE SCHEMA

Tables:

profiles\
races\
markets\
leagues\
league_members\
league_invites\
bets\
race_results\
league_messages\
notifications\
news_articles

All relations enforced via UUID FKs.

------------------------------------------------------------------------

# 7. SETTLEMENT FLOW

1.  Fetch official race results\
2.  Insert into race_results\
3.  Select pending bets\
4.  Compute net_profit\
5.  Update bets\
6.  Aggregate race totals\
7.  Update league_members\
8.  Determine race winner\
9.  Mark race complete\
10. Commit transaction

------------------------------------------------------------------------

# 8. PRODUCT PHILOSOPHY

-   Real odds realism\
-   Equal bankroll per race\
-   Skill-based weekly volatility\
-   Social league competition\
-   Transparent math\
-   Scalable system design

------------------------------------------------------------------------

END OF FILE
