import { test, expect } from "@playwright/test";

test("shows a locked demo list with editable vertical and status", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));

  await page.goto("/");
  const response = await page.request.post("/api/demos", {
    data: {
      company: "Inline Roofing Co",
      contact: "Alex Test",
      demoDate: "2026-09-20",
      demoTime: "10:00",
      timeZone: "America/Toronto",
      status: "Upcoming",
      phoneCallId: "a0a0dd04-dab8-4c48-a255-8707faa1f56f",
      companyId: "11111111-1111-4111-8111-111111111111"
    }
  });
  expect(response.ok()).toBe(true);
  await page.reload();

  await expect(page.getByRole("button", { name: /Import/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Export/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add demo" })).toHaveCount(0);
  await expect(page.locator("thead")).not.toBeVisible();

  await page.getByLabel("Search demos").fill("Inline Roofing Co");
  const row = page.locator("tbody tr").first();
  await expect(row).toContainText("Inline Roofing Co");
  await expect(row).toContainText("Alex Test");
  await expect(row.getByLabel("Company")).toHaveCount(0);
  await expect(row.getByLabel("Contact")).toHaveCount(0);
  await expect(row.getByLabel("Demo date")).toHaveCount(0);
  await expect(row).toContainText("Sep 20 10:00 AM America/Toronto");

  await expect(row.getByRole("link", { name: "Open lead for Inline Roofing Co" })).toHaveText("Inline Roofing Co");
  await expect(row.getByRole("link", { name: "Open lead for Inline Roofing Co" })).toHaveAttribute("href", /queue\?from=CallLog&companyId=11111111-1111-4111-8111-111111111111/);
  await expect(row.getByRole("link", { name: "Open recording for Inline Roofing Co" })).toBeVisible();
  await expect(row.getByRole("link", { name: "Open recording for Inline Roofing Co" })).toHaveAttribute("href", /call-log\/a0a0dd04-dab8-4c48-a255-8707faa1f56f/);
  await row.getByLabel("Vertical for Inline Roofing Co").selectOption("Roofing");
  await row.getByLabel("Status for Inline Roofing Co").selectOption("Performed");

  await page.reload();
  await page.getByLabel("Search demos").fill("Inline Roofing Co");
  await expect(page.locator("tbody tr").first().getByLabel("Vertical for Inline Roofing Co")).toHaveValue("Roofing");
  await expect(page.getByLabel("Status for Inline Roofing Co")).toHaveValue("Performed");
  await page.getByLabel("From date").fill("2026-09-01");
  await page.getByLabel("To date").fill("2026-09-30");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
