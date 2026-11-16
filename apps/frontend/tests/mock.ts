import type { Page } from "@playwright/test"

import frameFixture from "./fixtures/nezha-frame.json" with { type: "json" }
import groups from "./fixtures/nezha-groups.json" with { type: "json" }

export async function mockNezha(
    page: Page,
    {
        loggedIn = false,
        empty = false,
        fail = false,
        noHistory = false,
        stableNode = false,
        allOnline = false,
        highDiskRatio,
        price = "USD 12.00",
        customCode,
    }: {
        loggedIn?: boolean
        empty?: boolean
        fail?: boolean
        noHistory?: boolean
        stableNode?: boolean
        allOnline?: boolean
        highDiskRatio?: number
        price?: string
        customCode?: string
    } = {},
) {
    const startedAt = Date.now()
    let signedIn = loggedIn
    const metricNow = Math.floor(Date.now() / 30_000) * 30_000
    const servers = structuredClone(frameFixture.servers)
    servers.forEach((s, i) => {
        s.name =
            i === 0
                ? "Tokyo production — long server name for responsive truncation"
                : `Server ${String(i + 1).padStart(2, "0")}`
        Object.assign(s, {
            public_note: JSON.stringify({
                billingDataMod: {
                    amount: i === 1 ? "0" : price,
                    cycle: "Year",
                    endDate: "2031-05-01T00:00:00+08:00",
                    autoRenewal: "1",
                },
                planDataMod: {
                    trafficVol: "1TB/Month",
                    trafficType: "2",
                    bandwidth: "1 Gbps",
                    IPv4: "1",
                    IPv6: "1",
                    extra: "Public server information",
                },
            }),
        })
        if (s.state && s.host) {
            s.state.cpu = 12 + i
            s.state.net_out_transfer = 100 * 1024 ** 3 + 2881 * 1024 ** 2
            s.state.net_in_transfer = 100 * 1024 ** 3 + 2881 * 1024 ** 2
            if (highDiskRatio !== undefined && i === 2)
                s.state.mem_used = (s.host.mem_total ?? 0) * 0.4
            s.state.disk_used = (s.host.disk_total ?? 0) * (i === 2 ? (highDiskRatio ?? 0.8) : 0.35)
        }
    })
    await page.route("https://api.frankfurter.dev/**", (route) =>
        route.fulfill({
            json: [
                { base: "USD", quote: "CNY", date: "2026-11-16", rate: 7 },
                { base: "USD", quote: "HKD", date: "2026-11-16", rate: 7.8 },
                { base: "USD", quote: "JPY", date: "2026-11-16", rate: 150 },
                { base: "USD", quote: "EUR", date: "2026-11-16", rate: 0.9 },
            ],
        }),
    )
    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url())
        const path = url.pathname
        if (path.endsWith("/login")) {
            signedIn = true
            return route.fulfill({ json: { success: true } })
        }
        if (fail) return route.fulfill({ status: 503, json: { success: false } })
        if (path.endsWith("/profile"))
            return route.fulfill({
                status: signedIn ? 200 : 401,
                json: { success: signedIn, data: { username: "fixture" } },
            })
        if (path.endsWith("/setting"))
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        config: {
                            site_name: "Infrastructure",
                            language: "en",
                            oauth2_providers: ["GitHub", "Google"],
                            ...(customCode !== undefined ? { custom_code: customCode } : {}),
                        },
                        tsdb_enabled: !noHistory,
                    },
                },
            })
        if (path.endsWith("/server-group")) return route.fulfill({ json: groups })
        if (path.endsWith("/service/server"))
            return route.fulfill({ json: { success: true, data: servers.map((s) => s.id) } })
        if (path.endsWith("/metrics")) {
            const metric = url.searchParams.get("metric")
            const period = url.searchParams.get("period")
            const hours = period === "30d" ? 720 : period === "7d" ? 168 : 24
            const start = metricNow - hours * 3_600_000
            const count = hours === 24 ? 2881 : hours === 168 ? 1009 : 721
            const data_points = Array.from({ length: count }, (_, i) => {
                const ts = start + (i * hours * 3_600_000) / (count - 1)
                const wave = 20 + Math.sin(i / 13) * 10 + Math.cos(i / 7) * 4
                const value =
                    metric === "memory"
                        ? 256 * 1024 ** 2 + wave * 1024 ** 2
                        : metric === "disk"
                          ? 5 * 1024 ** 3
                          : metric?.includes("transfer")
                            ? 100 * 1024 ** 3 + i * 1024 ** 2
                            : metric?.includes("speed")
                              ? wave * 100000
                              : metric === "cpu"
                                ? wave
                                : metric === "load1"
                                  ? wave / 30
                                  : wave * 2
                return { ts, value }
            })
            return route.fulfill({ json: { success: true, data: { data_points } } })
        }
        if (path.endsWith("/service")) {
            const now = Date.now()
            return route.fulfill({
                json: {
                    success: true,
                    data: [1, 2, 3].map((id) => ({
                        monitor_id: id,
                        monitor_name: ["Tokyo", "Singapore", "Los Angeles"][id - 1],
                        created_at: Array.from({ length: 600 }, (_, i) => now - (599 - i) * 6000),
                        avg_delay: Array.from({ length: 600 }, (_, i) =>
                            i === 330 ? 1200 : 20 * id + Math.sin(i / 15) * 8,
                        ),
                    })),
                },
            })
        }
        if (path.includes("/oauth2/"))
            return route.fulfill({
                json: { success: true, data: { redirect: "https://auth.example.test/authorize" } },
            })
        return route.fulfill({ json: { success: true, data: [] } })
    })
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        let count = 0
        const frame = () => {
            const now = Date.now()
            const active = empty
                ? []
                : servers.map((s, i) => ({
                      ...s,
                      public_note:
                          count === 0
                              ? (s as typeof s & { public_note: string }).public_note
                              : undefined,
                      last_active: new Date(
                          (stableNode && i === 1 ? startedAt : now) -
                              (!allOnline && i === 19 ? 100000 : 0),
                      ).toISOString(),
                      state: {
                          ...s.state,
                          net_in_speed:
                              (s.state?.net_in_speed ?? 0) + (stableNode && i === 1 ? 0 : count),
                          cpu: 12 + i + (stableNode && i === 1 ? 0 : count % 4),
                      },
                  }))
            ws.send(JSON.stringify({ now, servers: active }))
            count++
        }
        frame()
        const timer = setInterval(frame, 2000)
        timer.unref()
        ws.onClose(() => clearInterval(timer))
    })
}
