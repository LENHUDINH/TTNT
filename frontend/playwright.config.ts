import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: process.env.E2E_BASE_URL??"http://127.0.0.1:5173",
    headless: true,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "../docs/test-results/browser.json" }],
  ],
});
