import { expect, test } from "@playwright/test"

import fixture from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

test.use({ timezoneId: "Asia/Taipei", locale: "en-US" })

test("FE06 refreshes the overview across local midnight and expires old peaks", async ({
    page,
}) => {
    const before = new Date("2026-11-17T23:59:50+08:00").getTime()
    const midnight = new Date("2026-11-18T00:00:00+08:00").getTime()
    await page.clock.install({ time: before })
    await mockNezha(page)
    let current = before
    let requests = 0
    await page.route("**/metrics?*", (route) => {
        requests++
        const metric = new URL(route.request().url()).searchParams.get("metric")!
        const counter = metric.includes("transfer")
        const points =
            current < midnight
                ? [
                      { ts: before - 86_395_000, value: counter ? 1000 : 9999 },
                      { ts: midnight - 86_400_000, value: counter ? 1000 : 10 },
                      { ts: before - 1000, value: counter ? 1500 : 10 },
                  ]
                : [
                      { ts: midnight, value: counter ? 1600 : 20 },
                      { ts: midnight + 1000, value: counter ? 1700 : 30 },
                  ]
        return route.fulfill({ json: { success: true, data: { data_points: points } } })
    })
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        const send = () =>
            ws.send(
                JSON.stringify({
                    now: current,
                    servers: [
                        {
                            ...fixture.servers[0],
                            id: 6,
                            last_active: new Date(current).toISOString(),
                            state: {
                                net_out_transfer: current < midnight ? 1500 : 1800,
                                net_in_transfer: current < midnight ? 1500 : 1800,
                                net_out_speed: 40,
                                net_in_speed: 40,
                            },
                        },
                    ],
                }),
            )
        send()
        ws.onMessage(() => {})
        const timer = setInterval(send, 100)
        timer.unref()
        ws.onClose(() => clearInterval(timer))
    })
    await page.goto("/server/6")
    const traffic = page
        .locator("#node-panel-network dl > div")
        .filter({ has: page.getByText("Today’s traffic", { exact: true }) })
        .locator("dd")
    const peak = page
        .locator("#node-panel-network dl > div")
        .filter({ has: page.getByText("Peak (24 h)", { exact: true }) })
        .locator("dd")
    await expect(traffic).toHaveText("1000 B")
    await expect.poll(() => requests).toBe(4)
    current = midnight + 2000
    await page.clock.runFor(12_000)
    await expect.poll(() => requests).toBeGreaterThan(4)
    await expect(traffic).toHaveText("400 B")
    await expect(peak).not.toContainText("KB/s")
})
