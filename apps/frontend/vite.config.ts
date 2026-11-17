import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

// Proxy approach adapted from zool-theme/vite.config.ts (MIT, luoleiorg).
export default defineConfig(({ mode }) => {
    const upstream = loadEnv(mode, process.cwd(), "NKT_").NKT_UPSTREAM
    return {
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
        test: { include: ["tests/**/*.test.ts"], environment: "node" },
    }
})
