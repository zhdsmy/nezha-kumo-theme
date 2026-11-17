import { type Page, expect, test, webkit } from "@playwright/test"

import { mockNezha } from "./mock"

async function scrollPageBy(page: Page, deltaY: number) {
    return page.evaluate((dy) => {
        const main = document.getElementById("main-content")
        if (main && main.scrollHeight > main.clientHeight + 1) {
            main.scrollTop += dy
            return main.scrollTop
        }
        window.scrollBy(0, dy)
        return window.scrollY
    }, deltaY)
}

async function assertHitAreaAtLeast32(page: Page, selector: string, label: string) {
    const res = await page.evaluate((sel) => {
        const el = document.querySelector<HTMLElement>(sel)
        if (!el) return { found: false, w: 0, h: 0, cornersHit: false }
        el.scrollIntoView({ block: "center", inline: "center" })
        const r = el.getBoundingClientRect()
        if (r.width >= 31.5 && r.height >= 31.5) {
            return { found: true, w: r.width, h: r.height, cornersHit: true }
        }
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const offsets = [
            [-15, -15],
            [15, -15],
            [-15, 15],
            [15, 15],
            [0, -15.5],
            [0, 15.5],
            [-15.5, 0],
            [15.5, 0],
        ] as const
        const cornersHit = offsets.every(([dx, dy]) => {
            const hit = document.elementFromPoint(cx + dx, cy + dy)
            return Boolean(hit && (hit === el || el.contains(hit)))
        })
        return { found: true, w: r.width, h: r.height, cornersHit }
    }, selector)
    expect(res.found, `${label} (${selector}) should exist`).toBe(true)
    expect(
        res.cornersHit,
        `${label} (${selector}) hit area < 32x32 (visual ${res.w.toFixed(1)}x${res.h.toFixed(1)})`,
    ).toBe(true)
}

test.describe("Native Kumo parts & mobile/WebKit polish", () => {
    test("1. CommandPalette is lazy-loaded, supports arrow/Enter navigation, preserves tab hash, and shows empty state", async ({
        page,
    }) => {
        const requestedUrls: string[] = []
        page.on("request", (req) => requestedUrls.push(req.url()))
        await mockNezha(page)

        await page.goto("/")
        await expect(page.locator(".card-name").first()).toBeVisible()
        expect(requestedUrls.some((u) => /SearchPalette/i.test(u))).toBe(false)

        // Open via Cmd/Ctrl+K; first item highlighted, arrow keys move highlight, empty state works
        await page.keyboard.press("Control+k")
        const dialog = page.locator('[role="dialog"]:has(.nk-search-palette)')
        await expect(dialog).toBeVisible()
        expect(requestedUrls.some((u) => /SearchPalette/i.test(u))).toBe(true)

        const items = dialog.locator(".search-result")
        await expect(items.first()).toHaveAttribute("data-highlighted", "")
        await page.keyboard.press("ArrowDown")
        await expect(items.nth(1)).toHaveAttribute("data-highlighted", "")

        const input = dialog.getByRole("combobox")
        await input.fill("definitely-no-matching-node-xyz")
        await expect(dialog).toContainText(/No matching nodes/i)

        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()

        // Navigate to node #load, reopen search, verify query cleared & Enter preserves #load
        await page.goto("/server/6#load")
        await expect(page.locator(".chart-toolbar")).toBeVisible()
        await page.locator(".sidebar-search").click()
        await expect(dialog).toBeVisible()
        await expect(input).toHaveValue("")
        await input.fill("Server 02")
        await expect(items.first()).toContainText("Server 02")
        await page.keyboard.press("Enter")
        await expect(page).toHaveURL(/\/server\/25#load$/)
    })

    test("2. SkeletonLine loading states match loaded outer widths (0px shift) and stay visible in dark mode", async ({
        page,
    }) => {
        let releaseSetting!: () => void
        const gate = new Promise<void>((r) => {
            releaseSetting = r
        })
        await mockNezha(page)
        await page.route(
            "**/api/v1/setting",
            async (route) => {
                await gate
                await route.fallback()
            },
            { times: 1 },
        )
        await page.addInitScript(() => {
            localStorage.setItem("nkt:appearance", "dark")
        })

        await page.goto("/")
        await expect(page.locator(".loading-state[role='status']")).toBeVisible()
        const skelMetrics = await page.evaluate(() => {
            const tile = document.querySelector<HTMLElement>(".metric-tile")!
            const cards = document.querySelector<HTMLElement>(".server-cards")!
            const line = document.querySelector<HTMLElement>(".skeleton-line")!
            return {
                tileW: tile.getBoundingClientRect().width,
                tileH: tile.getBoundingClientRect().height,
                cardsW: cards.getBoundingClientRect().width,
                bg: getComputedStyle(line).backgroundColor,
            }
        })
        expect(skelMetrics.bg).not.toBe("rgba(0, 0, 0, 0)")

        releaseSetting()
        await expect(page.locator(".fleet-table, .server-cards .card-name").first()).toBeVisible()
        const loadedMetrics = await page.evaluate(() => {
            const tile = document.querySelector<HTMLElement>(".metric-tile")!
            const cards = document.querySelector<HTMLElement>(".server-cards")!
            return {
                tileW: tile.getBoundingClientRect().width,
                tileH: tile.getBoundingClientRect().height,
                cardsW: cards.getBoundingClientRect().width,
            }
        })
        expect(Math.abs(loadedMetrics.tileW - skelMetrics.tileW)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(loadedMetrics.tileH - skelMetrics.tileH)).toBeLessThanOrEqual(1)
        expect(Math.abs(loadedMetrics.cardsW - skelMetrics.cardsW)).toBeLessThanOrEqual(0.5)
    })

    test("3 & 4. Range segmented Tabs keyboard switch, shared range, RefreshButton, and stale chart dimming", async ({
        page,
    }) => {
        await mockNezha(page, { loggedIn: true })
        await page.goto("/server/6#load")
        const rangeTabs = page.locator('.chart-toolbar [role="tab"]')
        await expect(rangeTabs.first()).toBeVisible()

        // Switch to 24h (index 3, period=1d) so historical charts render
        await rangeTabs.nth(3).click()
        await expect(page.locator(".chart svg").first()).toBeVisible()
        const initialSvgCount = await page.locator(".chart svg").count()
        expect(initialSvgCount).toBeGreaterThanOrEqual(4)

        // Hold 7d (index 4, period=7d) metrics request and switch via keyboard ArrowRight: old charts stay visible & dimmed
        let releaseMetrics!: () => void
        const hold = new Promise<void>((r) => {
            releaseMetrics = r
        })
        await page.route("**/api/v1/server/6/metrics*period=7d*", async (route) => {
            await hold
            await route.fallback()
        })

        await rangeTabs.nth(3).focus()
        await page.keyboard.press("ArrowRight")
        await expect(rangeTabs.nth(4)).toHaveAttribute("aria-selected", "true")
        await expect(page.locator(".chart-grid").locator("..")).toHaveClass(/opacity-50/)
        expect(await page.locator(".chart svg").count()).toBe(initialSvgCount)

        releaseMetrics()
        await expect(page.locator(".chart-grid").locator("..")).not.toHaveClass(/opacity-50/)

        // Shared range carries over to Latency tab
        await page.locator('.nk-page-tabs [role="tab"]').nth(2).click()
        await expect(page.locator('.chart-toolbar [role="tab"]').nth(4)).toHaveAttribute(
            "aria-selected",
            "true",
        )
    })

    test("5 & 6. InputGroup inline search, disconnect Banner appear/recover, and ErrorBanner retry", async ({
        page,
    }) => {
        await page.clock.install()
        let activeWs: { close: () => void } | null = null
        await mockNezha(page)
        await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
            activeWs = ws
            ws.send(
                JSON.stringify({
                    now: Date.now(),
                    servers: [
                        {
                            id: 6,
                            name: "Tokyo-01",
                            country_code: "jp",
                            last_active: new Date().toISOString(),
                            public_note: JSON.stringify({
                                planDataMod: { trafficVol: "2TB", trafficType: "2" },
                            }),
                            host: { mem_total: 2e9, disk_total: 20e9 },
                            state: {
                                cpu: 15,
                                mem_used: 1e9,
                                disk_used: 5e9,
                                net_in_transfer: 200e9,
                                net_out_transfer: 300e9,
                            },
                        },
                    ],
                }),
            )
        })

        await page.goto("/")
        await expect(page.locator(".card-name").first()).toBeVisible()

        // Inline search InputGroup
        await page.locator(".section-controls button").first().click()
        const inputGroup = page.locator(".inline-search")
        await expect(inputGroup).toBeVisible()
        const searchInput = inputGroup.locator("input")
        await searchInput.fill("Tokyo")
        await expect(page.locator(".search-clear")).toBeVisible()
        await page.locator(".search-clear").click()
        await expect(inputGroup).toBeHidden()

        // Simulate WebSocket drop > 5s -> disconnect Banner appears -> reconnect -> disappears
        await page.evaluate(() => {
            const CurrentWS = window.WebSocket
            ;(window as unknown as { __wsOffline?: boolean }).__wsOffline = true
            window.WebSocket = new Proxy(CurrentWS, {
                construct(target, args) {
                    if ((window as unknown as { __wsOffline?: boolean }).__wsOffline) {
                        throw new Error("offline")
                    }
                    return Reflect.construct(target, args)
                },
            })
        })
        activeWs!.close()
        await expect(page.locator('.connection[data-open="false"]')).toBeAttached()
        await page.clock.fastForward(5_200)
        await expect(page.locator(".disconnect-banner")).toBeVisible()

        await page.evaluate(() => {
            ;(window as unknown as { __wsOffline?: boolean }).__wsOffline = false
        })
        await page.clock.fastForward(16_000)
        await expect(page.locator(".disconnect-banner")).toBeHidden()

        // Also check cumulative quota meter aria-valuetext on node overview
        await page.locator(".card-name").first().click()
        await expect(page.locator('.quota-track[role="meter"]')).toHaveAttribute(
            "aria-valuetext",
            /\//,
        )
    })

    test("7, 8 & 11. RadioGroup menus, Button loading, Dialog.Close, LinkButton, Switch, and Meter ARIA", async ({
        page,
    }) => {
        await mockNezha(page)
        await page.goto("/")
        await expect(page.locator(".card-name").first()).toBeVisible()

        // Meter ARIA role & valuetext
        const firstMeter = page.locator('.server-card .meter[role="meter"]').first()
        await expect(firstMeter).toHaveAttribute("aria-valuemin", "0")
        await expect(firstMeter).toHaveAttribute("aria-valuemax", "100")
        const valueText = await firstMeter.getAttribute("aria-valuetext")
        expect(valueText).toMatch(/%/)

        // Appearance & Language RadioGroup menus
        await page.getByRole("button", { name: /Appearance/i }).click()
        await expect(page.locator('[role="menuitemradio"][aria-checked="true"]')).toHaveCount(1)
        await page.getByRole("menuitemradio", { name: "Dark" }).click()
        await expect(page.locator("html")).toHaveAttribute("data-mode", "dark")

        await page.getByRole("button", { name: /Language/i }).click()
        await expect(page.locator('[role="menuitemradio"][aria-checked="true"]')).toHaveCount(1)
        await page.keyboard.press("Escape")

        // Login dialog: Dialog.Close + Button loading -> LinkButton after sign-in
        let releaseLogin!: () => void
        const loginGate = new Promise<void>((r) => {
            releaseLogin = r
        })
        await page.route(
            "**/api/v1/login",
            async (route) => {
                await loginGate
                await route.fallback()
            },
            { times: 1 },
        )

        await page.getByRole("button", { name: /Sign in/i }).click()
        const loginDialog = page.getByRole("dialog")
        await expect(loginDialog).toBeVisible()
        await loginDialog.locator(".dialog-close").click()
        await expect(loginDialog).toBeHidden()

        await page.getByRole("button", { name: /Sign in/i }).click()
        await loginDialog.getByLabel(/Username/i).fill("admin")
        await loginDialog.getByLabel(/Password/i).fill("secret")
        const submitBtn = loginDialog.locator('button[type="submit"]')
        await submitBtn.click()
        await expect(submitBtn).toBeDisabled()
        await expect(submitBtn).toHaveAttribute("aria-label", /Signing in/i)
        releaseLogin()
        await expect(loginDialog).toBeHidden()
        await expect(page.locator('.nk-topbar-actions a[href="/dashboard"]')).toBeVisible()

        // Node latency shave Switch
        await page.goto("/server/6#latency")
        const shaveSwitch = page.getByRole("switch")
        await expect(shaveSwitch).toBeVisible()
        const wasChecked = await shaveSwitch.getAttribute("aria-checked")
        await shaveSwitch.click()
        expect(await shaveSwitch.getAttribute("aria-checked")).not.toBe(wasChecked)
    })

    test("9. 375px mobile tap targets are all at least 32x32 px", async ({ page }) => {
        await mockNezha(page, { highDiskRatio: 0.95 })
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto("/")
        await expect(page.locator(".card-name").first()).toBeVisible()

        await assertHitAreaAtLeast32(page, ".card-name", "Card title link")
        await assertHitAreaAtLeast32(page, ".status-trigger", "Attention trigger")

        // Compact view row title link
        await page.locator(".view-switch button").nth(1).click()
        await expect(page.locator(".fleet-table")).toBeVisible()
        await assertHitAreaAtLeast32(
            page,
            ".fleet-table .server-name > a",
            "Compact list row title link",
        )

        // Mobile drawer brand link & drawer close button
        await page.locator(".nk-drawer-trigger").click()
        await expect(page.locator(".nk-sidebar[data-mobile]")).toBeVisible()
        await assertHitAreaAtLeast32(
            page,
            ".nk-sidebar[data-mobile] .brand",
            "Mobile sidebar brand link",
        )
        await assertHitAreaAtLeast32(
            page,
            '.nk-sidebar[data-mobile] [data-sidebar="close"]',
            "Mobile drawer close button",
        )
        await page.locator('.nk-sidebar[data-mobile] [data-sidebar="close"]').click()

        // CommandPalette close button & LoginDialog close button
        await page.keyboard.press("Control+k")
        await expect(page.locator(".dialog-close-btn")).toBeVisible()
        await assertHitAreaAtLeast32(page, ".dialog-close-btn", "CommandPalette close button")
        await page.keyboard.press("Escape")

        await page.getByRole("button", { name: /Sign in/i }).click()
        await expect(page.locator(".dialog-close")).toBeVisible()
        await assertHitAreaAtLeast32(page, ".dialog-close", "LoginDialog close button")
        await page.locator(".dialog-close").click()

        // Node page tabs, range tabs, refresh buttons, and latency filter items
        await page.goto("/server/6#load")
        await expect(page.locator('.chart-toolbar [role="tab"]').first()).toBeVisible()
        await assertHitAreaAtLeast32(page, '.nk-page-tabs [role="tab"]', "Node page tab")
        await assertHitAreaAtLeast32(page, '.chart-toolbar [role="tab"]', "Range switch tab")
        await assertHitAreaAtLeast32(page, ".chart-toolbar > button", "Toolbar RefreshButton")

        await page.goto("/server/6#latency")
        await expect(page.locator(".node-ping-row").first()).toBeVisible()
        await assertHitAreaAtLeast32(page, ".node-ping-row", "Latency line filter button")

        await page.goto("/server/6#history")
        await expect(page.locator(".section-heading > button")).toBeVisible()
        await assertHitAreaAtLeast32(page, ".section-heading > button", "Section RefreshButton")
    })

    test("10 & Gate 3. WebKit rapid range/page navigation has 0 unhandled rejections and foldable 867/952/zoomed layouts hold", async ({
        baseURL,
    }) => {
        const browser = await webkit.launch()
        try {
            const configs = [
                {
                    name: "867px",
                    viewport: { width: 867, height: 900 },
                    deviceScaleFactor: 2,
                    hasTouch: false,
                    isMobile: false,
                    metaWidth: null,
                },
                {
                    name: "952px",
                    viewport: { width: 952, height: 900 },
                    deviceScaleFactor: 2,
                    hasTouch: false,
                    isMobile: false,
                    metaWidth: null,
                },
                {
                    name: "zoomed-foldable-952",
                    viewport: { width: 667, height: 469 },
                    deviceScaleFactor: 3,
                    hasTouch: true,
                    isMobile: true,
                    metaWidth: 952,
                },
            ] as const

            for (const cfg of configs) {
                const context = await browser.newContext({
                    baseURL,
                    viewport: cfg.viewport,
                    deviceScaleFactor: cfg.deviceScaleFactor,
                    hasTouch: cfg.hasTouch,
                    isMobile: cfg.isMobile,
                    reducedMotion: "reduce",
                })
                const page = await context.newPage()
                const unhandled: string[] = []
                page.on("pageerror", (err) => unhandled.push(`pageerror: ${err.message}`))
                await page.addInitScript(() => {
                    ;(window as unknown as { __unhandled: string[] }).__unhandled = []
                    window.addEventListener("unhandledrejection", (ev) => {
                        ;(window as unknown as { __unhandled: string[] }).__unhandled.push(
                            String(ev.reason),
                        )
                    })
                })
                await mockNezha(page, { loggedIn: true })
                // Add slight delay on metrics to ensure in-flight requests get canceled during rapid switches
                await page.route("**/api/v1/server/*/metrics*", async (route) => {
                    await new Promise((r) => setTimeout(r, 60))
                    await route.fallback()
                })

                await page.goto("/")
                if (cfg.metaWidth) {
                    await page.evaluate((w) => {
                        const meta = document.querySelector('meta[name="viewport"]')
                        if (meta) meta.setAttribute("content", `width=${w}, initial-scale=1`)
                    }, cfg.metaWidth)
                }
                await expect(page.locator(".card-name").first()).toBeVisible()

                const topBefore = await page.evaluate(() => {
                    const topbar = document.querySelector<HTMLElement>(".nk-topbar")!
                    const sidebar = document.querySelector<HTMLElement>(
                        ".nk-sidebar:not([data-mobile]) .nk-sidebar-inner",
                    )
                    return {
                        topbarTop: topbar.getBoundingClientRect().top,
                        sidebarTop: sidebar ? sidebar.getBoundingClientRect().top : 0,
                        overflow:
                            document.documentElement.scrollWidth -
                            document.documentElement.clientWidth,
                    }
                })
                expect(topBefore.overflow, `${cfg.name} horizontal overflow`).toBeLessThanOrEqual(1)

                const scrolled = await scrollPageBy(page, 260)
                expect(scrolled).toBeGreaterThan(0)
                const topAfter = await page.evaluate(() => {
                    const topbar = document.querySelector<HTMLElement>(".nk-topbar")!
                    const sidebar = document.querySelector<HTMLElement>(
                        ".nk-sidebar:not([data-mobile]) .nk-sidebar-inner",
                    )
                    return {
                        topbarTop: topbar.getBoundingClientRect().top,
                        sidebarTop: sidebar ? sidebar.getBoundingClientRect().top : 0,
                        overflow:
                            document.documentElement.scrollWidth -
                            document.documentElement.clientWidth,
                    }
                })
                expect(Math.abs(topAfter.topbarTop - topBefore.topbarTop)).toBeLessThanOrEqual(1)
                expect(Math.abs(topAfter.sidebarTop - topBefore.sidebarTop)).toBeLessThanOrEqual(1)
                expect(topAfter.overflow).toBeLessThanOrEqual(1)

                // Check menu & CommandPalette positioning while scrolled
                await page.getByRole("button", { name: /Appearance/i }).click()
                const menuBox = await page.locator('[role="menu"]').first().boundingBox()
                expect(menuBox).not.toBeNull()
                expect(menuBox!.x).toBeGreaterThanOrEqual(0)
                await page.keyboard.press("Escape")

                await page.keyboard.press("Control+k")
                const dlg = page.locator('[role="dialog"]:has(.nk-search-palette)')
                await expect(dlg).toBeVisible()
                const dlgBox = await dlg.boundingBox()
                expect(dlgBox).not.toBeNull()
                expect(dlgBox!.x).toBeGreaterThanOrEqual(0)
                await page.keyboard.press("Escape")

                // Rapid range & page switches while metrics are in-flight
                await page.locator(".card-name").first().click()
                await page.locator('.nk-page-tabs [role="tab"]').nth(1).click()
                const ranges = page.locator('.chart-toolbar [role="tab"]')
                await expect(ranges.first()).toBeVisible()
                await ranges.nth(1).click()
                await ranges.nth(2).click()
                await ranges.nth(3).click()
                await page.locator('.nk-page-tabs [role="tab"]').nth(2).click()
                await page.goto("/")
                await expect(page.locator(".card-name").first()).toBeVisible()

                const winUnhandled = await page.evaluate(
                    () => (window as unknown as { __unhandled: string[] }).__unhandled ?? [],
                )
                expect([...unhandled, ...winUnhandled], `${cfg.name} unhandled errors`).toEqual([])

                await context.close()
            }
        } finally {
            await browser.close()
        }
    })
})
