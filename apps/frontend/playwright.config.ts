import { defineConfig } from "@playwright/test"

const port = Number(process.env.NKT_PORT) || 5301
const url = `http://127.0.0.1:${port}`

export default defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.ts",
    workers: 1,
    use: {
        baseURL: url,
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
    },
    webServer: {
        command: process.env.NKT_PORT
            ? `vite --host 127.0.0.1 --port ${port} --strictPort`
            : "pnpm dev",
        url,
        reuseExistingServer: !process.env.CI && !process.env.NKT_PORT,
    },
})
