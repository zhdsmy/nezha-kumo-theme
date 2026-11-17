import { expect, test } from "@playwright/test"

import frameFixture from "./fixtures/nezha-frame.json" with { type: "json" }
import groupsFixture from "./fixtures/nezha-groups.json" with { type: "json" }
import { mockNezha } from "./mock"

test("load charts round integer series, fit y-axis labels at 375 and 1440, and flip right-half tooltips", async ({
    page,
}) => {
    await mockNezha(page)
    await page.route("**/api/v1/server/6/metrics**", async (route) => {
        const url = new URL(route.request().url())
        const metric = url.searchParams.get("metric")
        const now = Math.floor(Date.now() / 30_000) * 30_000
        const start = now - 24 * 3_600_000
        const count = 289
        const data_points = Array.from({ length: count }, (_, i) => {
            const ts = start + (i * 24 * 3_600_000) / (count - 1)
            const value =
                metric === "tcp_conn"
                    ? 66.33333333333333
                    : metric === "udp_conn"
                      ? 14.666666666666666
                      : metric === "process_count"
                        ? 182.66666666666666
                        : metric === "memory"
                          ? (980 + (i % 38)) * 1024 ** 2
                          : metric === "disk"
                            ? 14.8 * 1024 ** 3
                            : metric?.includes("speed")
                              ? (420 + (i % 90)) * 1024
                              : metric === "cpu"
                                ? 24.4
                                : 0.72
            return { ts, value }
        })
        await route.fulfill({ json: { success: true, data: { data_points } } })
    })

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/server/6#load")
    await page.getByRole("button", { name: "1 h" }).click()

    const connectionsValue = page
        .locator(".chart-card")
        .filter({ hasText: "Connections" })
        .locator(".chart-heading p")
    await expect(connectionsValue).toHaveText("TCP 66 · UDP 15")

    const processesValue = page
        .locator(".chart-card")
        .filter({ hasText: "Processes" })
        .locator(".chart-heading p")
    await expect(processesValue).toHaveText("0.72 · 183")

    for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 812 })
        const bounds = await page.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLElement>(".chart-card")).map((card) => {
                const cardRect = card.getBoundingClientRect()
                const gridLine = card.querySelector<SVGLineElement>(".chart svg line")
                const lineRect = gridLine?.getBoundingClientRect()
                const yLabels = Array.from(
                    card.querySelectorAll<SVGTextElement>("g text.chart-axis"),
                ).map((t) => {
                    const r = t.getBoundingClientRect()
                    return {
                        text: t.textContent ?? "",
                        left: r.left - cardRect.left,
                        right: r.right - (lineRect?.left ?? cardRect.right),
                    }
                })
                return { count: yLabels.length, yLabels }
            }),
        )
        expect(bounds.length).toBeGreaterThanOrEqual(4)
        for (const card of bounds) {
            expect(card.count).toBeGreaterThanOrEqual(3)
            for (const label of card.yLabels) {
                expect(label.left, `${width}px label "${label.text}" clipped`).toBeGreaterThan(2)
                expect(label.right, `${width}px label "${label.text}" overlaps plot`).toBeLessThan(
                    0,
                )
                expect(label.text).not.toMatch(/\d+\.\d+\s*[KMGT]?B/)
            }
        }
    }

    const firstChart = page.locator(".chart-card .chart").first()
    const wrapBox = (await firstChart.boundingBox())!
    await page.mouse.move(wrapBox.x + wrapBox.width - 14, wrapBox.y + wrapBox.height / 2)
    const tip = firstChart.locator(".chart-tooltip")
    await expect(tip).toBeVisible()
    const tipPlacement = await firstChart.evaluate((wrap) => {
        const wrapRect = wrap.getBoundingClientRect()
        const tipRect = wrap.querySelector(".chart-tooltip")!.getBoundingClientRect()
        const crosshair = wrap.querySelector("svg > g:last-of-type > line")!
        const crossX = crosshair.getBoundingClientRect().left
        return {
            tipLeft: tipRect.left - wrapRect.left,
            tipRight: tipRect.right - wrapRect.left,
            wrapWidth: wrapRect.width,
            crossOffset: crossX - tipRect.right,
        }
    })
    expect(tipPlacement.tipLeft).toBeGreaterThanOrEqual(0)
    expect(tipPlacement.tipRight).toBeLessThanOrEqual(tipPlacement.wrapWidth)
    expect(tipPlacement.crossOffset).toBeGreaterThanOrEqual(0)
})

test("single-line sub-millisecond latency chart generates distinct y-axis ticks", async ({
    page,
}) => {
    await mockNezha(page)
    await page.route("**/api/v1/server/6/service**", async (route) => {
        const now = Date.now()
        await route.fulfill({
            json: {
                success: true,
                data: [
                    {
                        monitor_id: 1,
                        monitor_name: "Local loopback",
                        created_at: Array.from({ length: 60 }, (_, i) => now - (59 - i) * 15_000),
                        avg_delay: Array.from(
                            { length: 60 },
                            (_, i) => 0.35 + Math.sin(i / 6) * 0.25,
                        ),
                    },
                    {
                        monitor_id: 2,
                        monitor_name: "Transpacific",
                        created_at: Array.from({ length: 60 }, (_, i) => now - (59 - i) * 15_000),
                        avg_delay: Array.from({ length: 60 }, (_, i) => 140 + (i % 10)),
                    },
                ],
            },
        })
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/server/6#latency")
    await page.getByRole("button", { name: /Local loopback/ }).click()

    const yTicks = await page.locator(".chart-card g text.chart-axis").allTextContents()
    expect(yTicks.length).toBeGreaterThanOrEqual(3)
    expect(new Set(yTicks).size).toBe(yTicks.length)
    expect(yTicks.some((t) => /\d+\.\d+\s*ms/.test(t))).toBe(true)
})

test("offline node load tab shows NoData instead of infinite loading when backfill is empty", async ({
    page,
}) => {
    await mockNezha(page)
    await page.route("**/api/v1/server/44/metrics**", (route) =>
        route.fulfill({ json: { success: true, data: { data_points: [] } } }),
    )
    await page.goto("/server/44#load")
    await expect(page.getByText("No data for this range yet.")).toBeVisible()
    await expect(page.locator(".loading-state")).toHaveCount(0)
})

test("first paint avoids Nezha placeholder, wrong node header/count, and false reconnecting status", async ({
    page,
}) => {
    let releaseSettings!: () => void
    const settingsGate = new Promise<void>((resolve) => {
        releaseSettings = resolve
    })
    let liveSocket: { send: (data: string) => void; close: () => void } | null = null
    let releaseFrame!: () => void
    const frameGate = new Promise<void>((resolve) => {
        releaseFrame = resolve
    })

    const servers = structuredClone(frameFixture.servers)
    servers[0].name = "Tokyo primary"

    await page.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ json: [] }))
    await page.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path.endsWith("/setting")) {
            await settingsGate
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        config: { site_name: "Monitor Hub", language: "en" },
                        tsdb_enabled: false,
                    },
                },
            })
        }
        if (path.endsWith("/profile"))
            return route.fulfill({ status: 401, json: { success: false } })
        if (path.endsWith("/server-group")) return route.fulfill({ json: groupsFixture })
        if (path.endsWith("/service/server"))
            return route.fulfill({ json: { success: true, data: servers.map((s) => s.id) } })
        return route.fulfill({ json: { success: true, data: [] } })
    })
    await page.routeWebSocket("**/api/v1/ws/server", async (ws) => {
        liveSocket = ws
        await frameGate
        ws.send(
            JSON.stringify({
                now: Date.now(),
                servers: servers.map((s) => ({ ...s, last_active: new Date().toISOString() })),
            }),
        )
    })

    await page.goto("/server/6", { waitUntil: "domcontentloaded" })
    await expect(page.locator(".nk-shell")).toBeVisible()

    // While /api/v1/setting and initial WS frame are still in flight on a cold visit:
    expect(await page.title()).toBe("")
    await expect(page.locator(".nk-sidebar .brand")).toHaveText("")
    await expect(page.locator("main h1")).toHaveText("")
    await expect(page.locator(".nk-sidebar")).not.toContainText("(0)")
    await expect(page.locator(".connection")).toHaveAttribute("data-status", "connecting")
    await expect(page.locator(".connection")).toHaveText("Connecting")

    // Release /api/v1/setting while initial WS frame is still pending:
    releaseSettings()
    await expect(page.locator("main h1")).toHaveText("")
    await expect(page.locator(".nk-sidebar")).not.toContainText("(0)")
    await expect(page.locator(".connection")).toHaveAttribute("data-status", "connecting")

    // Deliver first WS frame -> node page & Live status; then drop socket -> Reconnecting:
    releaseFrame()
    await expect(page.locator("main h1")).toContainText("Tokyo primary")
    await expect(page).toHaveTitle("Tokyo primary · Monitor Hub")
    await expect(page.locator(".nk-sidebar .brand")).toHaveText("Monitor Hub")
    await expect(page.locator(".connection")).toHaveAttribute("data-status", "live")
    await expect(page.locator(".connection")).toHaveText("Live")

    liveSocket!.close()
    await expect(page.locator(".connection")).toHaveAttribute("data-status", "reconnecting")
    await expect(page.locator(".connection")).toHaveText("Reconnecting")

    // Repeat visit reads cached site title before /api/v1/setting or WS responds:
    const secondGate = new Promise<void>(() => {})
    await page.route("**/api/v1/setting", async () => {
        await secondGate
    })
    await page.routeWebSocket("**/api/v1/ws/server", async () => {
        await secondGate
    })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page.locator(".nk-shell")).toBeVisible()
    expect(await page.title()).toBe("Monitor Hub")
    await expect(page.locator(".nk-sidebar .brand")).toHaveText("Monitor Hub")
    await expect(page.locator(".connection")).toHaveAttribute("data-status", "connecting")
})

test("non-existent node page renders message once with back link and site document title", async ({
    page,
}) => {
    await mockNezha(page)
    await page.goto("/server/99999")
    await expect(page.locator("main h1")).toHaveText("This node does not exist or is hidden.")
    await expect(page.getByText("This node does not exist or is hidden.")).toHaveCount(1)
    expect(await page.title()).toBe("Infrastructure")

    const backLink = page.locator("main").getByRole("link", { name: "Back to list" })
    await expect(backLink).toBeVisible()
    await backLink.click()
    await expect(page).toHaveURL(/\/$/)
})

test("portalled menus and dialogs inherit Inter font and reduced-motion rules", async ({
    page,
}) => {
    await mockNezha(page)
    await page.goto("/")
    await page.locator(".sort-button").click()
    await expect(page.getByRole("menu")).toBeVisible()

    const menuFont = await page.evaluate(() => {
        const shell = getComputedStyle(document.querySelector(".nk-shell")!)
        const popup = getComputedStyle(document.querySelector('[role="menu"]')!)
        return {
            shellFamily: shell.fontFamily,
            popupFamily: popup.fontFamily,
            popupSize: popup.fontSize,
            popupSpacing: popup.letterSpacing,
            popupTransition: popup.transitionDuration,
        }
    })
    expect(menuFont.popupFamily).toBe(menuFont.shellFamily)
    expect(menuFont.popupFamily).toContain("Inter Variable")
    expect(menuFont.popupSize).toBe("14px")
    expect(menuFont.popupSpacing).toBe("-0.16px")
    expect(menuFont.popupTransition).toBe("0s")

    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    const dialogFont = await page.evaluate(() => {
        const dialog = getComputedStyle(document.querySelector('[role="dialog"]')!)
        return {
            family: dialog.fontFamily,
            transition: dialog.transitionDuration,
        }
    })
    expect(dialogFont.family).toContain("Inter Variable")
    expect(dialogFont.transition).toBe("0s")
})

test("sort button does not leave persistent tooltip after closing menu, while preserving keyboard focus tooltip", async ({
    page,
}) => {
    await mockNezha(page)
    await page.goto("/")

    const sortButton = page.locator(".sort-button")
    await sortButton.click()
    await page.getByRole("menuitemradio", { name: "Name" }).click()
    await page.keyboard.press("Escape")

    await expect(sortButton).toBeFocused()
    await expect(page.locator(".kumo-tooltip-popup[data-open]")).toHaveCount(0)

    // Tabbing away and Shift+Tabbing back restores keyboard focus tooltip:
    await page.keyboard.press("Tab")
    await expect(sortButton).not.toBeFocused()
    await page.keyboard.press("Shift+Tab")
    await expect(sortButton).toBeFocused()
    await expect(page.locator(".kumo-tooltip-popup[data-open]")).toHaveText(
        "Sort: Name (Ascending)",
    )
})

test("inline search clear label, login username autofocus, and Cmd/Ctrl+K guard while login is open", async ({
    page,
}) => {
    await mockNezha(page)
    await page.goto("/")

    // Inline search clear button uses Clear (and localized equivalent), not Close:
    await page
        .locator(".section-controls")
        .getByRole("button", { name: "Search", exact: true })
        .click()
    const clearBtn = page.locator(".search-clear")
    await expect(clearBtn).toHaveAttribute("aria-label", "Clear")
    await expect(clearBtn).toHaveAttribute("title", "Clear")

    await page.getByRole("button", { name: "Language" }).click()
    await page.getByRole("menuitem", { name: "简体中文" }).click()
    await expect(clearBtn).toHaveAttribute("aria-label", "清除")

    await page.getByRole("button", { name: "语言" }).click()
    await page.getByRole("menuitem", { name: "English" }).click()
    await clearBtn.click()

    // Login dialog focuses username input on open and ignores Cmd/Ctrl+K:
    await page.getByRole("button", { name: "Sign in" }).click()
    const usernameInput = page.getByLabel("Username")
    await expect(usernameInput).toBeFocused()

    await page.keyboard.press("Meta+k")
    await page.keyboard.press("Control+k")
    await expect(page.getByRole("dialog")).toHaveCount(1)
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Search" })).toHaveCount(0)
})
