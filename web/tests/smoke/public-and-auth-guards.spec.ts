import { test, expect } from "@playwright/test";

test.describe("public shell and auth guards", () => {
  test("landing page renders core CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /APEX/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In With Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse Marketplace" })).toBeVisible();
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

  test("internal marketplace API requires auth", async ({ request }) => {
    const response = await request.get("/api/league-marketplace");
    expect(response.status()).toBe(401);
  });
});
