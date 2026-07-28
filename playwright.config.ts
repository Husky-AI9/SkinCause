import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    env: {
      ...process.env,
      YOUCAM_MOCK_MODE: process.env.LIVE_YOUCAM_E2E === "true" ? "false" : "true",
      OPENAI_MOCK_MODE: process.env.LIVE_OPENAI_E2E === "true" ? "false" : "true"
    },
    reuseExistingServer: true,
    timeout: 120_000
  }
});
