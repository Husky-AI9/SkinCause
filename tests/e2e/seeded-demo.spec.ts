import { expect, test } from "@playwright/test";

test("seeded demo opens a completed investigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "View seeded demo" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: "Good morning, investigator." })).toBeVisible();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await page.getByRole("link", { name: /Open result/ }).click();
  await expect(page.getByText("Strong association").first()).toBeVisible();
  await expect(page.getByText(/not proof of causation/i).first()).toBeVisible();
});

test("consent gates the guided flow", async ({ page }) => {
  await page.goto("/consent");
  const continueButton = page.getByRole("button", { name: /Continue to routine/ });
  await expect(continueButton).toBeDisabled();
  await page.getByLabel(/I understand the cosmetic-only scope/).check();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page).toHaveURL(/onboarding/);
});

test("mobile pages do not scroll horizontally", async ({ page }) => {
  await page.goto("/dashboard");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
