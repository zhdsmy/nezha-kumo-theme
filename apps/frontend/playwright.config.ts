import { defineConfig } from "@playwright/test"

export default defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.ts",
    workers: 1,
    use: {
        baseURL: "http://127.0.0.1:5301",
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
    },
    webServer: {
        command: "pnpm dev",
        url: "http://127.0.0.1:5301",
        reuseExistingServer: !process.env.CI,
    },
})
