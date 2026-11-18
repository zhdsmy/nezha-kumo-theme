import { expect, test } from "@playwright/test"

import fixture from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

test.describe("Visual review F1–F10 fixes", () => {
    test("F1: disconnected state marks main area stale immediately and stays visible with collapsed sidebar", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.addInitScript(() => {
            localStorage.setItem("nkt:sidebar-collapsed", "true")
        })
        await mockNezha(page)
        let activeWs: { close: () => void } | null = null
        let allowReconnect = false
        await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
            if (activeWs && !allowReconnect) {
                ws.close({ code: 1006, reason: "offline" })
                return
            }
            activeWs = ws
            ws.send(JSON.stringify({ now: Date.now(), servers: fixture.servers }))
        })

        await page.goto("/")
        await expect(page.locator("[data-server]").first()).toBeVisible()
        await expect(page.locator('.nk-sidebar[data-state="collapsed"]')).toBeVisible()
        const bwTile = page.locator(".metric-tile", { hasText: "Bandwidth" })
        await expect(bwTile.locator(".tile-sub")).toHaveText("Live")

        // Drop socket: without waiting 5s, main area & topbar show reconnecting and stale state
        activeWs!.close()
        await expect(page.locator(".disconnect-banner")).toBeVisible({ timeout: 1500 })
        await expect(page.locator(".topbar-reconnect")).toBeVisible()
        await expect(bwTile.locator(".tile-sub")).toContainText(/Reconnecting.*\d{2}:\d{2}/)
        await expect(page.locator("[data-server][data-stale]").first()).toBeVisible()

        // Reconnect restores Live state
        allowReconnect = true
        await expect(page.locator(".disconnect-banner")).toBeHidden({ timeout: 10_000 })
        await expect(bwTile.locator(".tile-sub")).toHaveText("Live")
        await expect(page.locator("[data-server][data-stale]")).toHaveCount(0)
    })
})
