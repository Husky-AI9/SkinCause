import { expect, test } from "@playwright/test";

test("analyze skin opens a prepared demo scan and workspace navigation", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Routine" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Scan" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Experiment" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveCount(0);

  await page.getByRole("link", { name: "Analyze skin" }).click();
  await expect(page).toHaveURL(/scan\/new/);
  await expect(page.getByRole("button", { name: "Upload your image" })).toBeVisible();
  await page.getByRole("button", { name: "Use demo image" }).click();
  await expect(page.getByRole("img", { name: "Prepared synthetic skin-analysis test face" })).toBeVisible();
  await expect(page.getByText("skincause-asian-skin-test.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live execution log" })).toBeVisible();
  await expect(page.getByText(/\[client\] validated image\/png;/)).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze demo image" })).toBeEnabled();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit demo" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Redness and texture trend" })).toBeVisible();
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

test("authentication screen exposes sign-in and account creation states", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Sign in to SkinCause" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("tab", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
});
