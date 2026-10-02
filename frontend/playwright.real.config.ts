import { defineConfig } from "@playwright/test";

// Explicit opt-in only. The workflow owns an isolated backend/database on 8000
// and builds Next in local-demo mode before starting this real-browser case.
export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "**/real-campaign.spec.ts",
  outputDir: "real-test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0, // Never repeat real research automatically.
  timeout: 360_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "real-playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3001",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
    trace: "on",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "real-ontario-campaign" }],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001/workspace",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      SIGNALFOUNDRY_MODE: "local-demo",
      NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "local-demo",
      API_BASE_URL: "http://127.0.0.1:8000",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
