import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

// Proxy approach adapted from zool-theme/vite.config.ts (MIT, luoleiorg).
const git = (args: string) => {
    try {
        return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .trim()
    } catch {
        return null
    }
}

// Footer build stamp. A clean tagged build shows the plain version; anything else is a dev build.
// Builds without .git (git archive) pass NKT_VERSION / NKT_COMMIT.
function buildStamp() {
    const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
    const dirty = !!git("status --porcelain")
    const tagged =
        process.env.GITHUB_REF_TYPE === "tag" || git("describe --exact-match --tags HEAD")
    const version = process.env.NKT_VERSION || `${pkg.version}${tagged && !dirty ? "" : "-dev"}`
    const commit =
        process.env.NKT_COMMIT ||
        `${git("rev-parse --short HEAD") ?? "unknown"}${dirty ? "-dirty" : ""}`
    return { __KUMO_VERSION__: JSON.stringify(version), __KUMO_COMMIT__: JSON.stringify(commit) }
}

export default defineConfig(({ mode }) => {
    const upstream = loadEnv(mode, process.cwd(), "NKT_").NKT_UPSTREAM
    return {
        define: buildStamp(),
        plugins: [tailwindcss(), react()],
        resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
        server: {
            proxy: upstream
                ? {
                      "/api": {
                          target: upstream,
                          changeOrigin: true,
                          ws: true,
                          headers: { Origin: upstream, Referer: `${upstream}/` },
                          // The development upstream is always read-only, including auth flows.
                          bypass(req, res) {
                              if (res && req.method !== "GET" && req.method !== "HEAD") {
                                  res.writeHead(405, { "content-type": "application/json" })
                                  res.end(
                                      JSON.stringify({
                                          success: false,
                                          error: "Read-only development proxy",
                                      }),
                                  )
                                  return false
                              }
                          },
                      },
                  }
                : undefined,
        },
        optimizeDeps: {
            include: [
                "@cloudflare/kumo/components/command-palette",
                "@cloudflare/kumo/components/switch",
            ],
        },
        build: {
            manifest: true,
            sourcemap: false,
            rolldownOptions: {
                output: {
                    codeSplitting: {
                        groups: [{ name: "vendor", tags: ["$initial"] }],
                    },
                },
            },
        },
        // Fixtures use +08:00 dates and day counts follow the local calendar, so pin the zone.
        test: {
            include: ["tests/**/*.test.ts"],
            environment: "node",
            env: { TZ: "Asia/Shanghai" },
        },
    }
})
