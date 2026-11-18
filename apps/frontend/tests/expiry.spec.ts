import { type Page, type WebSocketRoute, expect, test } from "@playwright/test"

import frameFixture from "./fixtures/nezha-frame.json" with { type: "json" }
import groups from "./fixtures/nezha-groups.json" with { type: "json" }

interface BillingSpec {
    id: number
    name: string
    amount?: string
    cycle?: string
    endDate?: string
    autoRenewal?: string
}

async function setupExpiryFleet(
    page: Page,
    specs: BillingSpec[],
    initialNow: number,
    lang = "zh-CN",
) {
    await page.addInitScript((l) => {
        localStorage.setItem("nkt:language", l)
    }, lang)

    const servers = specs.map((spec, idx) => {
        const base = structuredClone(frameFixture.servers[idx % frameFixture.servers.length])
        base.id = spec.id
        base.name = spec.name
        base.display_index = specs.length - idx
        if (base.state && base.host) {
            base.state.cpu = 18
            base.state.mem_used = Math.floor((base.host.mem_total ?? 1) * 0.35)
            base.state.disk_used = Math.floor((base.host.disk_total ?? 1) * 0.4)
            base.state.net_out_transfer = 20 * 1024 ** 3
            base.state.net_in_transfer = 20 * 1024 ** 3
        }
        return Object.assign(base, {
            public_note: JSON.stringify({
                billingDataMod: {
                    amount: spec.amount ?? "$10",
                    cycle: spec.cycle ?? "Month",
                    endDate: spec.endDate ?? "",
                    autoRenewal: spec.autoRenewal ?? "0",
                },
                planDataMod: {
                    trafficVol: "1TB/Month",
                    trafficType: "2",
                    bandwidth: "1 Gbps",
                    IPv4: "1",
                    IPv6: "1",
                },
            }),
        })
    })

    await page.route("https://api.frankfurter.dev/**", (route) =>
        route.fulfill({
            json: [
                { base: "USD", quote: "CNY", date: "2026-11-16", rate: 7.2 },
                { base: "USD", quote: "HKD", date: "2026-11-16", rate: 7.8 },
                { base: "USD", quote: "JPY", date: "2026-11-16", rate: 150 },
            ],
        }),
    )

    await page.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path.endsWith("/profile"))
            return route.fulfill({ status: 401, json: { success: false } })
        if (path.endsWith("/setting"))
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        config: { site_name: "Kumo Monitor", language: lang },
                        tsdb_enabled: false,
                    },
                },
            })
        if (path.endsWith("/server-group")) return route.fulfill({ json: groups })
        if (path.endsWith("/service/server"))
            return route.fulfill({ json: { success: true, data: servers.map((s) => s.id) } })
        return route.fulfill({ json: { success: true, data: [] } })
    })

    let currentNow = initialNow
    const sockets = new Set<WebSocketRoute>()
    const buildFrame = (atMs: number, includeNotes: boolean) =>
        JSON.stringify({
            now: atMs,
            servers: servers.map((s) => ({
                ...s,
                public_note: includeNotes ? s.public_note : undefined,
                last_active: new Date(atMs).toISOString(),
            })),
        })

    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        sockets.add(ws)
        ws.send(buildFrame(currentNow, true))
        ws.onClose(() => sockets.delete(ws))
    })

    return {
        pushFrame(atMs: number) {
            currentNow = atMs
            const payload = buildFrame(atMs, false)
            for (const ws of sockets) ws.send(payload)
        },
    }
}

test("shows 7-day expiry attention, rolled auto-renewal, unknown-cycle auto-renew, expiry sorting, and NodePage dates", async ({
    page,
}) => {
    const fixedNow = new Date(2026, 10, 18, 10, 0, 0).getTime()
    await page.clock.setFixedTime(fixedNow)

    await setupExpiryFleet(
        page,
        [
            {
                id: 101,
                name: "JP Tokyo Edge",
                cycle: "Month",
                endDate: "2026-11-23 18:00:00",
                autoRenewal: "0",
            },
            {
                id: 102,
                name: "HK Relay Auto",
                cycle: "Month",
                endDate: "2026-08-20 12:00:00",
                autoRenewal: "1",
            },
            {
                id: 103,
                name: "SG Custom Auto",
                cycle: "CustomPlan",
                endDate: "2025-05-01 00:00:00",
                autoRenewal: "1",
            },
            {
                id: 104,
                name: "US Legacy Expired",
                cycle: "Year",
                endDate: "2026-11-10 00:00:00",
                autoRenewal: "0",
            },
            {
                id: 105,
                name: "DE Archive LongTerm",
                cycle: "OneTime",
                endDate: "0000-00-00 00:00:00",
                autoRenewal: "0",
            },
        ],
        fixedNow,
    )

    await page.goto("/")

    // Attention trigger: only JP Tokyo Edge (5 days left) and US Legacy Expired count (2 total)
    const trigger = page.locator(".status-trigger")
    await expect(trigger).toContainText("2 个需要注意")
    await trigger.click()
    const menuItems = page.locator('[role="menuitem"]')
    await expect(menuItems).toHaveCount(2)
    await expect(menuItems.nth(0)).toContainText("JP Tokyo Edge")
    await expect(menuItems.nth(0)).toContainText("5 天后到期")
    await expect(menuItems.nth(1)).toContainText("US Legacy Expired")
    await expect(menuItems.nth(1)).toContainText("已过期")
    await page.keyboard.press("Escape")

    // Card expiry values and color levels
    const expiryDd = (id: number) =>
        page.locator(`[data-server="${id}"] .card-facts div`).last().locator("dd")

    await expect(expiryDd(101)).toHaveText("5 天后")
    await expect(expiryDd(101)).toHaveAttribute("data-level", "danger")

    // HK Relay Auto rolled from 2026-08-20 -> 2026-11-20 (2 days), neutral color (no data-level)
    await expect(expiryDd(102)).toHaveText("2 天后续费")
    await expect(expiryDd(102)).not.toHaveAttribute("data-level")

    // SG Custom Auto has unrecognized cycle -> 自动续费, neutral color
    await expect(expiryDd(103)).toHaveText("自动续费")
    await expect(expiryDd(103)).not.toHaveAttribute("data-level")

    await expect(expiryDd(104)).toHaveText("已过期")
    await expect(expiryDd(104)).toHaveAttribute("data-level", "danger")

    await expect(expiryDd(105)).toHaveText("长期")
    await expect(expiryDd(105)).not.toHaveAttribute("data-level")

    // Sort by expiry ascending: 104 (Nov 10) -> 102 (Nov 20 next renewal!) -> 101 (Nov 23) -> 103 & 105 (dateless, by id)
    await page.locator(".sort-button").click()
    await page.getByRole("menuitemradio", { name: "到期时间" }).click()
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-server]")).toHaveCount(5)
    expect(
        await page
            .locator("[data-server]")
            .evaluateAll((els) => els.map((e) => e.getAttribute("data-server"))),
    ).toEqual(["104", "102", "101", "103", "105"])

    // NodePage shows rolled next-renewal date for HK Relay Auto
    await page.locator('[data-server="102"] .card-name').click()
    await expect(page).toHaveURL(/\/server\/102$/)
    const billingPanel = page.locator("#node-panel-billing")
    const expectedDate = new Date(2026, 10, 20, 12, 0, 0).toLocaleDateString("zh-CN")
    await expect(billingPanel).toContainText(`${expectedDate} · 2 天后续费`)

    // NodePage omits date for unrecognized-cycle auto-renew node
    await page.goto("/server/103")
    const expiryRow103 = page
        .locator("#node-panel-billing .info-section div")
        .filter({ has: page.locator("dt", { hasText: "到期" }) })
        .locator("dd")
    await expect(expiryRow103).toHaveText("自动续费")
})

test("updates countdowns, attention status, and renewal dates live across midnight and renewal moments without reload", async ({
    page,
}) => {
    const t0 = new Date(2026, 10, 18, 23, 59, 50).getTime()
    await page.clock.setFixedTime(t0)

    const fleet = await setupExpiryFleet(
        page,
        [
            {
                id: 201,
                name: "Eight-to-Seven Node",
                cycle: "Month",
                endDate: "2026-11-26 18:00:00",
                autoRenewal: "0",
            },
            {
                id: 202,
                name: "One-to-Today Node",
                cycle: "Month",
                endDate: "2026-11-19 20:00:00",
                autoRenewal: "0",
            },
            {
                id: 203,
                name: "Midday Auto Renew",
                cycle: "Month",
                endDate: "2026-11-19 12:00:00",
                autoRenewal: "1",
            },
        ],
        t0,
    )

    await page.goto("/")

    const expiryDd = (id: number) =>
        page.locator(`[data-server="${id}"] .card-facts div`).last().locator("dd")

    // Before midnight (Nov 18 23:59:50): 201 is 8 days (warn, not attention), 202 is 1 day (attention), 203 renews in 1 day
    await expect(expiryDd(201)).toHaveText("8 天后")
    await expect(expiryDd(201)).toHaveAttribute("data-level", "warn")
    await expect(expiryDd(202)).toHaveText("1 天后")
    await expect(expiryDd(203)).toHaveText("1 天后续费")
    await expect(page.locator(".status-trigger")).toContainText("1 个需要注意")

    // Cross local midnight -> Nov 19 00:00:05 + push live WS frame (no reload!)
    const tMidnight = new Date(2026, 10, 19, 0, 0, 5).getTime()
    await page.clock.setFixedTime(tMidnight)
    fleet.pushFrame(tMidnight)

    await expect(expiryDd(201)).toHaveText("7 天后")
    await expect(expiryDd(201)).toHaveAttribute("data-level", "danger")
    await expect(expiryDd(202)).toHaveText("今天")
    await expect(expiryDd(203)).toHaveText("今天续费")
    await expect(page.locator(".status-trigger")).toContainText("2 个需要注意")

    await page.locator(".status-trigger").click()
    await expect(page.locator('[role="menuitem"]').nth(0)).toContainText("7 天后到期")
    await expect(page.locator('[role="menuitem"]').nth(1)).toContainText("今天到期")
    await page.keyboard.press("Escape")

    // Cross 203's renewal timestamp -> Nov 19 12:00:05 + push live WS frame (no reload!)
    const tRenewed = new Date(2026, 10, 19, 12, 0, 5).getTime()
    await page.clock.setFixedTime(tRenewed)
    fleet.pushFrame(tRenewed)

    await expect(expiryDd(203)).toHaveText("30 天后续费")
    await expect(expiryDd(203)).not.toHaveAttribute("data-level")
    await expect(page.locator(".status-trigger")).toContainText("2 个需要注意")
})
