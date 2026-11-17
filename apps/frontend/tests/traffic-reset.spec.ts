import { expect, test } from "@playwright/test"

import fixture from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

test("FE07 home preserves observed traffic across reset before history refresh", async ({
    page,
}) => {
    await mockNezha(page)
    const now = Date.now()
    await page.route("**/metrics?*", (route) =>
        route.fulfill({
            json: { success: true, data: { data_points: [{ ts: now - 1000, value: 1000 }] } },
        }),
    )
    let send!: (total: number) => void
    let report = now
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        send = (total) =>
            ws.send(
                JSON.stringify({
                    now: ++report,
                    servers: [
                        {
                            ...fixture.servers[0],
                            id: 6,
                            last_active: new Date(report).toISOString(),
                            state: { net_out_transfer: total, net_in_transfer: 0 },
                        },
                    ],
                }),
            )
        send(1000)
    })
    await page.goto("/")
    const tile = page
        .locator(".metric-tile")
        .filter({ has: page.getByText("Today’s traffic", { exact: true }) })
    await expect(tile.locator(".tile-value")).toHaveText("0 B")
    send(1500)
    await expect(tile.locator(".tile-value")).toHaveText("500 B")
    send(100)
    await expect(tile.locator(".tile-value")).toHaveText("600 B")
    send(200)
    await expect(tile.locator(".tile-value")).toHaveText("700 B")
})
