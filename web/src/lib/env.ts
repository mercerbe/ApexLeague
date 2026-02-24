import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SETTLEMENT_CRON_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  F1_RESULTS_PROVIDER: z.string().trim().optional(),
  THESPORTSDB_API_KEY: z.string().trim().optional(),
  THESPORTSDB_LEAGUE_ID: z.string().trim().optional(),
  ODDS_API_KEY: z.string().trim().min(1).optional(),
  ODDS_API_SPORT_KEY: z.string().trim().optional(),
  ODDS_API_REGIONS: z.string().trim().optional(),
  ODDS_API_MARKETS: z.string().trim().optional(),
  ODDS_API_BOOKMAKER: z.string().trim().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  INVITE_EMAIL_FROM: z.string().trim().email().optional(),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SETTLEMENT_CRON_SECRET: process.env.SETTLEMENT_CRON_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    F1_RESULTS_PROVIDER: process.env.F1_RESULTS_PROVIDER,
    THESPORTSDB_API_KEY: process.env.THESPORTSDB_API_KEY,
    THESPORTSDB_LEAGUE_ID: process.env.THESPORTSDB_LEAGUE_ID,
    ODDS_API_KEY: process.env.ODDS_API_KEY,
    ODDS_API_SPORT_KEY: process.env.ODDS_API_SPORT_KEY,
    ODDS_API_REGIONS: process.env.ODDS_API_REGIONS,
    ODDS_API_MARKETS: process.env.ODDS_API_MARKETS,
    ODDS_API_BOOKMAKER: process.env.ODDS_API_BOOKMAKER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    INVITE_EMAIL_FROM: process.env.INVITE_EMAIL_FROM,
  });
}
