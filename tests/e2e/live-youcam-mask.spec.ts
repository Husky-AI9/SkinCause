import { expect, test } from "@playwright/test";
import path from "node:path";

test("renders live YouCam concern masks for the prepared synthetic face", async ({ page }, testInfo) => {
  test.skip(process.env.LIVE_YOUCAM_E2E !== "true", "Set LIVE_YOUCAM_E2E=true for a paid provider validation.");
  test.setTimeout(180_000);

  await page.goto("/");
  await page.getByRole("link", { name: "Analyze skin" }).click();
  await page.getByRole("button", { name: "Use demo image" }).click();
  await expect(page.getByRole("img", { name: "Prepared synthetic skin-analysis test face" })).toBeVisible();
  await page.getByRole("button", { name: "Analyze demo image" }).click();

  await expect(page.getByText("Scan complete")).toBeVisible({ timeout: 150_000 });
  const redness = page.getByRole("button", { name: "Redness" });
  await expect(redness).toBeVisible();
  await expect(page.getByRole("button", { name: "Texture" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pores" })).toBeVisible();
  await expect(page.getByText("Facial segmentation", { exact: true })).toBeVisible();
  await expect(page.getByText("3 provider mask overlays", { exact: true })).toBeVisible();
  await expect(page.getByText("Live YouCam response", { exact: true })).toBeVisible();
  await expect(page.getByText("Live YouCam v2.1 response", { exact: true })).toBeVisible();
  await expect(page.getByText(/\[youcam\] POST \/s2s\/v2\.1\/file\/skin-analysis -> 200/)).toBeVisible();
  await expect(page.getByText(/\[youcam\] POST \/s2s\/v2\.1\/task\/skin-analysis -> 200/)).toBeVisible();
  await expect(page.getByText(/\[youcam\] provider status=success/)).toBeVisible();
  await expect(page.getByText(/\[youcam\] response normalized: pores=64 texture=44 redness=32; masks=3/)).toBeVisible();
  const scoreSummary = page.getByTestId("provider-score-summary");
  await expect(scoreSummary.getByText("Pores", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("64", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("Texture", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("44", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("Redness", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("32", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("Elevated concern", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("Moderate concern", { exact: true })).toBeVisible();
  await expect(scoreSummary.getByText("Mild concern", { exact: true })).toBeVisible();
  await expect(page.getByText(/Highlights show AI-observed cosmetic patterns/)).toBeVisible();
  await expect(page.getByText(/Example visualization for the fictional demo scan/i)).toHaveCount(0);

  await redness.click();
  await expect(redness).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /Redness visual pattern overlay/ })).toBeVisible();
  await page.getByRole("button", { name: "Texture" }).click();
  await expect(page.getByRole("img", { name: /Texture visual pattern overlay/ })).toBeVisible();
  await page.getByRole("button", { name: "Pores" }).click();
  await expect(page.getByRole("img", { name: /Pores visual pattern overlay/ })).toBeVisible();

  await page.screenshot({
    path: path.resolve("test-results", `live-youcam-mask-${testInfo.project.name}.png`),
    fullPage: true
  });

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Exit demo" }).click();
});
