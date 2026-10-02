import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:4302";

export default defineConfig({
  testDir: "./browser-tests",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: origin,
    browserName: "chromium",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1188",
      testIgnore: "**/carousel-motion.spec.ts",
      use: { viewport: { width: 1188, height: 900 } },
    },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 960 } } },
    {
      name: "mobile-360",
      testIgnore: "**/carousel-motion.spec.ts",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-390",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-768",
      testIgnore: "**/carousel-motion.spec.ts",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
  // CI builds first in local-demo mode. Never reuse another task's running server.
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4302",
    url: origin,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      SIGNALFOUNDRY_MODE: "local-demo",
      NEXT_PUBLIC_SIGNALFOUNDRY_MODE: "local-demo",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
