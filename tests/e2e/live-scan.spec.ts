import { expect, test } from "@playwright/test";
import path from "node:path";

test("uploads a real face image and renders live YouCam results", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const faceImage = path.resolve(process.cwd(), "test_data", "asian-skin-test-v3.png");
  const providerResponses: number[] = [];

  page.on("response", (response) => {
    if (response.url().includes("/api/v1/scans/")) providerResponses.push(response.status());
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Analyze skin" }).click();
  await expect(page).toHaveURL(/scan\/new/);
  await expect(page.getByRole("button", { name: "Upload your image" })).toBeEnabled();
  await page.getByLabel("Choose a JPG or PNG image").setInputFiles(faceImage);
  await expect(page.getByText("asian-skin-test-v3.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Analyze image" }).click();

  await expect(page.getByText("Scan complete")).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(/Redness|Texture|Pores/).first()).toBeVisible();
  await expect(page.getByText("Agent test mode", { exact: true })).toBeVisible();
  await expect(page.getByText(/\[agent\] deterministic test task created/)).toBeVisible();
  await expect(page.getByText(/\[agent\] test output normalized:/)).toBeVisible();
  await expect(page.getByText("Agent test result", { exact: true })).toBeVisible();
  await expect(page.getByText("Location data was not returned for this scan. Scores remain available.")).toBeVisible();
  await expect(page.getByText("Analyze image")).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("skincause-active-scan"))).toBeNull();
  expect(providerResponses).toContain(200);

  await page.screenshot({
    path: path.resolve("test-results", `live-scan-${testInfo.project.name}.png`),
    fullPage: true
  });
});
