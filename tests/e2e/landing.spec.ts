import { expect, test } from "@playwright/test";
import path from "node:path";

test("landing page presents the scan-led editorial experience", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "A clearer acne plan.", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: /standardized cosmetic scan/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start acne analysis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acne plan" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Scan. Recommend. Simulate. Verify." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /See the acne pattern/i })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: path.resolve("test-results", `landing-${testInfo.project.name}.png`),
    fullPage: true
  });
});
