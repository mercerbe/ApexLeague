import { getServerEnv } from "@/lib/env";

export function getInternalAuthSecret() {
  const env = getServerEnv();
  return env.SETTLEMENT_CRON_SECRET ?? env.CRON_SECRET ?? null;
}

export function isAuthorizedInternalRequest(request: Request) {
  const configuredSecret = getInternalAuthSecret();

  if (!configuredSecret) {
    return { ok: false as const, reason: "Internal secret is not configured." };
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-settlement-secret") ?? request.headers.get("x-cron-secret");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const suppliedSecret = bearerSecret ?? headerSecret;

  if (!suppliedSecret || suppliedSecret !== configuredSecret) {
    return { ok: false as const, reason: "Unauthorized" };
  }

  return { ok: true as const, secret: configuredSecret };
}
