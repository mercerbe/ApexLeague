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
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    INVITE_EMAIL_FROM: process.env.INVITE_EMAIL_FROM,
  });
}
