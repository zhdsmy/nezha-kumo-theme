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

    test("F2: 320px viewport keeps server count unoccluded, search close button inside dialog, and long billing tag wrapped", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 320, height: 667 })
        await mockNezha(page)
        const servers = structuredClone(fixture.servers).map((s, i) => ({
            ...s,
            last_active: new Date().toISOString(),
            public_note: JSON.stringify({
                billingDataMod: { amount: "USD 12.00", cycle: "Year" },
                planDataMod: {
                    extra: i === 0 ? `tag_${"a".repeat(114)}` : "Public server information",
                },
            }),
        }))
        await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
            ws.send(JSON.stringify({ now: Date.now(), servers }))
        })

        await page.goto("/")
        await expect(page.locator("[data-server]").first()).toBeVisible()
        await expect(page.locator(".section-heading h2")).toContainText(String(servers.length))

        // 1. Server count in .section-heading h2 must not be overlapped by .section-controls
        await expect
            .poll(() =>
                page.locator(".section-heading").evaluate((section) => {
                    const count = section.querySelector("h2 .num")!.getBoundingClientRect()
                    const search = section
                        .querySelector(".section-controls > button")!
                        .getBoundingClientRect()
                    return (
                        count.right <= search.left ||
                        search.right <= count.left ||
                        count.bottom <= search.top ||
                        search.bottom <= count.top
                    )
                }),
            )
            .toBe(true)

        // 2. Search palette close button stays completely inside the dialog at 320px
        await page.keyboard.press("Meta+k")
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await dialog.getByRole("combobox").fill("Server")
        const dialogBox = await dialog.boundingBox()
        const closeBox = await dialog.locator(".dialog-close-btn").boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(closeBox).not.toBeNull()
        expect(closeBox!.x + closeBox!.width).toBeLessThanOrEqual(
            dialogBox!.x + dialogBox!.width + 1,
        )

        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()

        // 3. Long spaceless billing tag wraps inside .nk-main without horizontal overflow
        const firstHref = await page.locator("a[href^='/server/']").first().getAttribute("href")
        await page.goto(firstHref!)
        await page.locator("#node-subtab-billing").click()
        await expect(page.locator("#node-panel-billing")).toContainText("aaaa")
        const mainScrollWidth = await page.locator(".nk-main").evaluate((el) => el.scrollWidth)
        expect(mainScrollWidth).toBeLessThanOrEqual(320)
    })

    test("F3: 18-line latency tooltip fits without mid-line clipping, memory shows Swap legend, and load/processes match curves", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
        await mockNezha(page)
        const servers = structuredClone(fixture.servers).map((s) => ({
            ...s,
            last_active: new Date().toISOString(),
            host: { ...s.host, swap_total: 2 * 1024 ** 3 },
            state: { ...s.state, swap_used: 512 * 1024 ** 2, load_1: 0.03, process_count: 183 },
        }))
        await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
            ws.send(JSON.stringify({ now: Date.now(), servers }))
        })
        await page.route("**/api/v1/server/6/metrics**", async (route) => {
            const metric = new URL(route.request().url()).searchParams.get("metric")
            const now = Math.floor(Date.now() / 30_000) * 30_000
            const pts = Array.from({ length: 60 }, (_, i) => ({
                ts: now - (59 - i) * 60_000,
                value:
                    metric === "load1"
                        ? 0.03
                        : metric === "process_count"
                          ? 183
                          : metric === "swap"
                            ? 512 * 1024 ** 2
                            : metric === "memory"
                              ? 1024 ** 3
                              : 20,
            }))
            await route.fulfill({ json: { success: true, data: { data_points: pts } } })
        })
        await page.route("**/api/v1/server/6/service**", async (route) => {
            const now = Math.floor(Date.now() / 30_000) * 30_000
            const created_at = Array.from({ length: 60 }, (_, i) => now - (59 - i) * 60_000)
            await route.fulfill({
                json: {
                    success: true,
                    data: Array.from({ length: 18 }, (_, idx) => ({
                        monitor_id: idx + 1,
                        monitor_name: `Probe-${String(idx + 1).padStart(2, "0")}`,
                        created_at,
                        avg_delay: Array.from({ length: 60 }, () => 10 + idx),
                    })),
                },
            })
        })

        // 1. 18-line latency tooltip shows all 18 lines without clipping any row
        await page.goto("/server/6#latency")
        const latSvg = page.locator(".chart svg").first()
        await expect(latSvg).toBeVisible()
        const box = await latSvg.boundingBox()
        await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5)
        const tooltip = page.locator(".chart-tooltip").first()
        await expect(tooltip).toBeVisible()
        await expect(tooltip).toContainText("Probe-01")
        await expect(tooltip).toContainText("Probe-18")
        const { rowCount, clippedRows } = await tooltip.evaluate((tip) => {
            const tipRect = tip.getBoundingClientRect()
            const rows = Array.from(
                tip.querySelectorAll(".chart-series-label"),
                (label) => label.parentElement!,
            )
            return {
                rowCount: rows.length,
                clippedRows: rows.filter(
                    (r) => r.getBoundingClientRect().bottom > tipRect.bottom + 1,
                ).length,
            }
        })
        expect(rowCount).toBe(18)
        expect(clippedRows).toBe(0)

        // 2. Load tab: Memory has Swap legend; Load (1m) preserves 0.03; Processes has its own matching card & curve
        await page.goto("/server/6#load")
        await page.getByRole("tab", { name: "1 h" }).click()
        const memCard = page.locator(".chart-card", { hasText: "Memory" })
        await expect(memCard.locator(".chart-heading")).toContainText("Swap")
        await expect(memCard.locator(".chart-heading span[aria-hidden]")).toHaveCount(2)

        const loadCard = page.locator(".chart-card", { hasText: "Load (1m)" })
        await expect(loadCard.locator(".chart-heading p")).toHaveText("0.03")
        await expect(loadCard.locator("svg path[fill='none']")).toHaveCount(1)

        const procCard = page.locator(".chart-card", { hasText: "Processes" })
        await expect(procCard.locator(".chart-heading p")).toHaveText("183")
        await expect(procCard.locator("svg path[fill='none']")).toHaveCount(1)
    })
})
