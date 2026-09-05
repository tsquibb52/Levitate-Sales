import { test, expect } from "@playwright/test";

test("add and edit demos directly in the list", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add demo" })).toBeVisible();
  await expect(page.getByText("SALES OPERATIONS")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Import/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Export/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Add demo" }).click();
  await expect(page.getByRole("status")).toContainText("Demo added");

  const row = page.locator("tbody tr").first();
  await row.getByLabel("Company").fill("Inline Test Co");
  await row.getByLabel("Company").blur();
  await expect(page.getByRole("status")).toContainText("Saved");

  await row.getByLabel("Contact").fill("Alex Test");
  await row.getByLabel("Contact").blur();
  await row.getByLabel("Demo date").fill("2026-09-20");
  await row.getByLabel("Demo date").blur();
  await row.getByLabel("Lead link").fill("https://example.com/lead");
  await row.getByLabel("Lead link").blur();
  await row.getByLabel("Vertical").fill("Roofing");
  await row.getByLabel("Vertical").blur();
  await row.getByLabel("AE").fill("Taylor");
  await row.getByLabel("AE").blur();
  await page.getByLabel("Status for Inline Test Co").selectOption("Showed");

  await page.reload();
  await page.getByLabel("Search demos").fill("Inline Test Co");
  const savedRow = page.locator("tbody tr").first();
  await expect(savedRow.getByLabel("Company")).toHaveValue("Inline Test Co");
  await expect(savedRow.getByLabel("Vertical")).toHaveValue("Roofing");
  await expect(savedRow.getByLabel("AE")).toHaveValue("Taylor");
  await expect(page.getByLabel("Status for Inline Test Co")).toHaveValue("Showed");
  await expect(page.getByRole("link", { name: "Open" })).toHaveAttribute("target", "_blank");

  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
