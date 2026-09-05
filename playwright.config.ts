import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests", testMatch: "**/*.spec.ts", workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", channel: "msedge", headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: {
    command: "npm run start -- --port 3100", url: "http://127.0.0.1:3100", timeout: 60000,
    env: { DEMO_DB_PATH: path.join(process.cwd(), "test-results", `browser-${Date.now()}.sqlite`) }
  }
});
