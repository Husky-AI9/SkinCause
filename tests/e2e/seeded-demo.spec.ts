import { expect, test } from "@playwright/test";

test("analyze skin opens a prepared demo scan and workspace navigation", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Acne plan" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Scan" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Experiment" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveCount(0);

  await page.getByRole("link", { name: "Start acne analysis" }).click();
  await expect(page).toHaveURL(/scan\/new/);
  await expect(page.getByRole("button", { name: "Upload your image" })).toBeVisible();
  await page.getByRole("button", { name: "Use demo image" }).click();
  const preview = page.getByRole("img", { name: "Prepared synthetic skin-analysis test face" });
  await expect(preview).toBeVisible();
  const [previewBounds, captureBounds] = await Promise.all([
    preview.boundingBox(),
    page.locator(".capture-zone").boundingBox()
  ]);
  expect(previewBounds).not.toBeNull();
  expect(captureBounds).not.toBeNull();
  expect(Math.abs(previewBounds!.height - captureBounds!.height)).toBeLessThanOrEqual(2);
  await expect(page.getByText("skincause-asian-skin-test.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live execution log" })).toBeVisible();
  await expect(page.getByText(/\[client\] validated image\/png;/)).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze demo image" })).toBeEnabled();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await expect(page.getByRole("link", { name: "Acne plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit demo" })).toBeVisible();

  await page.getByRole("link", { name: "Acne plan" }).click();
  await expect(page.getByRole("heading", { name: "Visible acne-pattern trend" })).toBeVisible();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await page.getByRole("link", { name: /Open acne plan/ }).click();
  await expect(page.getByRole("heading", { name: "Turn the acne scan into one affordable, testable plan" })).toBeVisible();
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

test("experiment studio suggests a replacement and generates an illustration", async ({ page }) => {
  await page.goto("/experiments/new?from=brightening-serum-elimination");
  await expect(
    page.getByRole("heading", { name: "Turn the acne scan into one affordable, testable plan" })
  ).toBeVisible();

  await page.getByRole("button", { name: "AI routine suggestion" }).click();
  await expect(page.getByText("Replace one product", { exact: true })).toBeVisible();
  await expect(page.getByText("Suggested candidate", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Demo catalog Fragrance-free barrier moisturizer", { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Price:.*Target: \$25 or less/)).toBeVisible();
  await expect(page.getByText(/Nutrition context/).first()).toBeVisible();
  await expect(page.getByLabel("Suspect product")).toHaveValue("__ai_candidate_product__");
  await expect(page.getByRole("button", { name: "Add / replace product" })).toHaveClass(/is-active/);
  await expect(page.getByLabel("Redness")).toBeChecked();
  await expect(page.getByLabel("Texture")).toBeChecked();

  await page.getByRole("button", { name: "Generate illustration" }).click();
  await expect(
    page.getByRole("img", {
      name: "AI-generated illustrative skin appearance based on recorded cosmetic measurements"
    })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("AI-generated illustration", { exact: true })).toBeVisible();
});
