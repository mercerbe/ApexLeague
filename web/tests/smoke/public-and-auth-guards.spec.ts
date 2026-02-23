import { test, expect } from "@playwright/test";

test.describe("public shell and auth guards", () => {
  test("landing page renders core CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /APEX/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In With Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leagues Hub" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "How It Works" })).toBeVisible();
  });

  test("protected pages redirect unauthenticated users to landing", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Sign In With Google" })).toBeVisible();
  });

  test("login route starts OAuth redirect", async ({ request }) => {
    const response = await request.get("/auth/login?next=/profile", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);

    const location = response.headers()["location"];
    expect(location).toBeTruthy();
    expect(location).toContain("supabase");
  });

  test("marketplace API is publicly readable", async ({ request }) => {
    const response = await request.get("/api/league-marketplace");
    expect(response.status()).toBe(200);
    const payload = (await response.json()) as { leagues?: unknown[] };
    expect(Array.isArray(payload.leagues)).toBeTruthy();
  });

  test("leaderboard API is publicly readable", async ({ request }) => {
    const response = await request.get("/api/leaderboard");
    expect(response.status()).toBe(200);
    const payload = (await response.json()) as { top_users?: unknown[]; top_leagues?: unknown[] };
    expect(Array.isArray(payload.top_users)).toBeTruthy();
    expect(Array.isArray(payload.top_leagues)).toBeTruthy();
  });
});
