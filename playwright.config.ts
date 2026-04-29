import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "admin",      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" } },
    { name: "finance",    use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/finance.json" } },
    { name: "operations", use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/operations.json" } },
    { name: "support",    use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/support.json" } },
  ],
});
