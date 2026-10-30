import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1,
  use: { baseURL: "http://localhost:3100", viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --port 3100", url: "http://localhost:3100", reuseExistingServer: false, timeout: 120_000, env: { NEXT_PUBLIC_AI_MODE: "live", OPENAI_API_KEY: "" } },
});
