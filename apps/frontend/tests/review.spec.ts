import { type Page, expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

declare global {
    interface Window {
        __nktRenders: Record<string, number>
    }
}

async function instrumentRenders(page: Page) {
    await page.addInitScript(() => {
        window.__nktRenders = {}
    })
    // Count function entries in served development modules; no instrumentation ships in the app.
    const modules: Record<string, string[]> = {
        "NodeCharts.tsx": ["LoadCharts", "PingChart"],
        "Chart.tsx": ["downsample"],
        "HomePage.tsx": ["ServerCard"],
        "Actions.tsx": ["Actions"],
    }
    await page.route("**/src/**/*.tsx*", async (route) => {
        const names = modules[new URL(route.request().url()).pathname.split("/").at(-1)!]
        if (!names) return route.continue()
        const response = await route.fetch()
        let body = await response.text()
        for (const name of names) {
            const pattern = new RegExp(`(function ${name}\\([^)]*\\)\\s*\\{)`)
            expect(body).toMatch(pattern)
            const key = name === "ServerCard" ? `'ServerCard:' + node.id` : JSON.stringify(name)
            body = body.replace(
                pattern,
                `$1 window.__nktRenders[${key}] = (window.__nktRenders[${key}] || 0) + 1;`,
            )
        }
        await route.fulfill({ response, body })
    })
}
const counts = (page: Page) => page.evaluate(() => ({ ...window.__nktRenders }))
const fullSparks = async (page: Page, count: number) => {
    await expect(page.locator(".spark")).toHaveCount(count)
    await expect
        .poll(() =>
            page
                .locator(".spark path[stroke]")
                .evaluateAll((paths) =>
                    paths.every((p) => (p as SVGPathElement).getBBox().width > 280),
                ),
        )
        .toBe(true)
    expect(
        await page
            .locator(".spark")
            .evaluateAll((sparks) =>
                sparks.every(
                    (spark) =>
                        spark.getBoundingClientRect().top >=
                        spark.previousElementSibling!.getBoundingClientRect().bottom,
                ),
            ),
    ).toBe(true)
}

const expectCostButtonAligned = async (page: Page) => {
    const metrics = await page.evaluate(() => {
        const h1 = document.querySelector(".nk-page h1")!.getBoundingClientRect()
        const btn = document.querySelector(".nk-page-actions .cost-button")!.getBoundingClientRect()
        const content = document.querySelector(".nk-page-content")!.getBoundingClientRect()
        return {
            centerDiff: Math.abs(h1.top + h1.height / 2 - (btn.top + btn.height / 2)),
            gap: btn.left - h1.right,
            rightDiff: Math.abs(content.right - btn.right),
        }
    })
    expect(metrics.centerDiff).toBeLessThanOrEqual(4)
    expect(metrics.gap).toBeGreaterThan(0)
    expect(metrics.rightDiff).toBeLessThanOrEqual(2)
}

test.beforeEach(async ({ page }) => {
    await mockNezha(page)
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
})

test("compact tiles and full seeded sparks fit the first phone screen; numbers stay complete", async ({
    page,
}) => {
    await mockNezha(page, { price: "CNY 22656.00" })
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/")
    await fullSparks(page, 4)
    await expect(page.locator(".metric-tile").first().locator(".spark")).toBeVisible()
    expect(
        await page
            .locator("[data-server]")
            .first()
            .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(900)
    expect(
        await page
            .locator(".metric-grid")
            .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length),
    ).toBe(2)
    await expect(page.locator(".nk-page-eyebrow")).toHaveCount(0)
    await expect(page.locator(".nk-page-description")).toHaveCount(0)
    await expect(page.locator(".status-headline")).toHaveCount(0)
    await expect(page.locator(".nk-page-actions .cost-button")).toBeVisible()
    await expectCostButtonAligned(page)
    await expect(page.locator(".topbar-title")).toHaveText("Infrastructure")
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator(".topbar-title")).toBeHidden()
    await expectCostButtonAligned(page)
    const usdPrice = page.locator(".card-facts dd").filter({ hasText: "$269.71/mo" }).first()
    await expect(usdPrice).toBeVisible()
    await expect(page.locator(".cost-button .cost-value")).toContainText("$")
    // the fee sits beside the title; its menu sets period only while currency follows interface language
    await page.locator(".cost-button").click()
    await expect(page.getByRole("menuitemradio")).toHaveCount(2)
    await page.getByRole("menuitemradio", { name: "Yearly", exact: true }).click()
    await expect(page.locator(".cost-button")).toContainText("Yearly fees")
    await expect(usdPrice).toHaveCount(0)
    await page.getByRole("menuitemradio", { name: "Monthly", exact: true }).click()
    await expect(page.locator(".cost-button")).toContainText("Monthly fees")
    await page.keyboard.press("Escape")
    for (const [buttonLabel, menuLabel, symbol, cardSample] of [
        ["Language", "简体中文", "¥", "¥1,888.00/月"],
        ["语言", "繁體中文（香港）", "HK$", "HK$2,103.77/月"],
        ["語言", "繁體中文（台灣）", "NT$", "NT$8,091.43/月"],
        ["語言", "日本語", "JP¥", "JP¥40,457/月"],
        ["言語", "English", "$", "$269.71/mo"],
    ] as const) {
        await page.getByRole("button", { name: buttonLabel, exact: true }).click()
        await page.getByRole("menuitemradio", { name: menuLabel, exact: true }).click()
        await expect(page.locator(".cost-button .cost-value")).toContainText(symbol)
        const price = page.locator(".card-facts dd").filter({ hasText: cardSample }).first()
        await expect(price).toBeVisible()
        expect(await price.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
    }
    await page.setViewportSize({ width: 375, height: 900 })
    const expectInlineNodeStatus = async (expectedText: string) => {
        await expect(page.locator(".nk-page-eyebrow")).toHaveCount(0)
        await expect(page.locator(".nk-page-description")).toHaveCount(0)
        await expect(page.locator(".nk-page-actions .status")).toHaveText(expectedText)
        const box = await page.evaluate(() => {
            const h1 = document.querySelector(".nk-page h1")!.getBoundingClientRect()
            const badge = document
                .querySelector(".nk-page-actions .status")!
                .getBoundingClientRect()
            return {
                overlap: Math.min(h1.bottom, badge.bottom) - Math.max(h1.top, badge.top),
                firstLineCenterDiff: Math.abs(h1.top + 12.5 - (badge.top + badge.height / 2)),
                gap: badge.left - h1.right,
                fitsViewport: badge.right <= window.innerWidth,
                noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
            }
        })
        expect(box.overlap).toBeGreaterThan(0)
        expect(box.firstLineCenterDiff).toBeLessThanOrEqual(3)
        expect(box.gap).toBeGreaterThan(0)
        expect(box.fitsViewport).toBe(true)
        expect(box.noOverflow).toBe(true)
    }
    await page.goto("/server/6")
    await expect(page.locator(".spark")).toHaveCount(0)
    await expect(page.locator(".topbar-title")).toHaveText("Infrastructure")
    await expectInlineNodeStatus("Online")
    expect(
        await page
            .locator(".node-info-panel[data-active]")
            .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(900)
    await page.goto("/server/44")
    await expectInlineNodeStatus("Offline")
    await page.goto("/server/6#load")
    await expect(page.locator(".spark")).toHaveCount(0)
    await expect(page.locator(".chart svg")).toHaveCount(7)
    expect(
        await page
            .locator(".chart")
            .first()
            .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(900)
})

test("online nodes tile lists attention and offline reasons and opens node details", async ({
    page,
}) => {
    await page.goto("/")
    const offlineTrigger = page.locator(".metric-tile").first().locator(".status-trigger")
    await expect(offlineTrigger).toHaveText("1 offline · 1 needs attention")
    await expect(offlineTrigger).toHaveAttribute("data-level", "danger")
    await offlineTrigger.click()
    await expect(page.getByRole("menuitem", { name: /Server 20.*Offline/ })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /Server 03.*Disk 80%/ })).toBeVisible()
    await page.keyboard.press("Escape")

    await mockNezha(page, { allOnline: true, highDiskRatio: 0.92 })
    await page.goto("/")
    const warnTrigger = page.locator(".metric-tile").first().locator(".status-trigger")
    await expect(warnTrigger).toHaveText("1 needs attention")
    await expect(warnTrigger).toHaveAttribute("data-level", "warn")
    await warnTrigger.click()
    const item = page.getByRole("menuitem", { name: /Server 03.*Disk 92%/ })
    await expect(item).toBeVisible()
    await item.click()
    await expect(page).toHaveURL(/\/server\/19$/)
    await expect(page.getByRole("heading", { name: /Server 03$/ })).toBeVisible()
})

test("daily traffic includes available nodes and reports partial coverage", async ({ page }) => {
    await page.route("**/server/6/metrics*", async (route) => {
        if (!new URL(route.request().url()).searchParams.get("metric")?.includes("transfer"))
            return route.fallback()
        await route.fulfill({ json: { success: true, data: { data_points: [] } } })
    })
    await page.goto("/")
    const tile = page
        .locator(".metric-tile")
        .filter({ has: page.getByText("Today’s traffic", { exact: true }) })
    await expect(tile.locator(".tile-sub")).toContainText("19/20 nodes")
    await expect(tile.locator(".tile-value")).not.toHaveText("—")
})

test("unchanged rows and closed search actions do not render on live frames", async ({ page }) => {
    await mockNezha(page, { stableNode: true })
    await instrumentRenders(page)
    await page.goto("/")
    await fullSparks(page, 4)
    await page.waitForTimeout(250)
    const before = await counts(page)
    await page.waitForTimeout(2200)
    const after = await counts(page)
    expect(after["ServerCard:2"]).toBe(before["ServerCard:2"])
    expect(after.Actions).toBe(before.Actions)
    expect(after["ServerCard:6"]).toBeGreaterThan(before["ServerCard:6"])
})

test("24h, 7d and 30d charts and downsampling do not recompute for live frames", async ({
    page,
}) => {
    await mockNezha(page, { loggedIn: true })
    await instrumentRenders(page)
    await page.goto("/server/6#load")
    await expect(page.locator(".chart svg")).toHaveCount(7)
    for (const name of ["1 d", "7 d", "30 d"]) {
        await page.getByRole("tab", { name, exact: true }).click()
        await expect(page.locator(".chart svg")).toHaveCount(7)
        await page.mouse.move(0, 0)
        await page.waitForTimeout(250)
        const before = await counts(page)
        await page.waitForTimeout(2200)
        const after = await counts(page)
        console.log(
            JSON.stringify({
                range: name,
                chart: "LoadCharts",
                before: before.LoadCharts,
                after: after.LoadCharts,
                samplesBefore: before.downsample,
                samplesAfter: after.downsample,
            }),
        )
        expect(after.LoadCharts, name).toBe(before.LoadCharts)
        expect(after.downsample, name).toBe(before.downsample)
    }
    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    for (const name of ["1 d", "7 d", "30 d"]) {
        await page.getByRole("tab", { name, exact: true }).click()
        await expect(page.locator(".node-ping-list button")).toHaveCount(3)
        await page.mouse.move(0, 0)
        await page.waitForTimeout(250)
        const before = await counts(page)
        await page.waitForTimeout(2200)
        const after = await counts(page)
        console.log(
            JSON.stringify({
                range: name,
                chart: "PingChart",
                before: before.PingChart,
                after: after.PingChart,
                samplesBefore: before.downsample,
                samplesAfter: after.downsample,
            }),
        )
        expect(after.PingChart, name).toBe(before.PingChart)
        expect(after.downsample, name).toBe(before.downsample)
    }
})

test("cold node overview never blocks on metrics and load shows loading while live history is backfilled", async ({
    page,
}) => {
    await page.route("**/metrics*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        await route.fallback()
    })
    await page.goto("/server/6")
    await expect(page.locator(".node-live-strip")).toBeVisible()
    await expect(page.locator(".loading-state")).toHaveCount(0)
    await page.goto("/server/6#load")
    await expect(page.locator(".loading-state")).toBeVisible()
    await expect(page.getByText("No data for this range yet.", { exact: true })).toHaveCount(0)
    await expect(page.locator(".chart svg")).toHaveCount(7)
})

test("cold home requests one profile and exactly five series per node with at most four in flight", async ({
    page,
}) => {
    let active = 0,
        peak = 0,
        finished = 0,
        profiles = 0
    const tracked = new Set<import("@playwright/test").Request>()
    page.on("request", (r) => {
        if (!r.url().includes("/api/v1/") && !r.url().includes("api.frankfurter.dev")) return
        tracked.add(r)
        active++
        peak = Math.max(peak, active)
        if (r.url().includes("/profile")) profiles++
    })
    const complete = (r: import("@playwright/test").Request) => {
        if (tracked.delete(r)) {
            active--
            finished++
        }
    }
    page.on("requestfinished", complete)
    page.on("requestfailed", complete)
    await page.goto("/")
    await expect.poll(() => finished).toBe(104)
    expect(profiles).toBe(1)
    expect(peak).toBeLessThanOrEqual(4)
    // Overview and report history reuse the already-cached 1d speed/transfer/CPU series.
    await page.locator('[data-server="6"] a').click()
    await expect(page.getByText("Public server information")).toBeVisible()
    const loaded = finished
    await page.getByRole("tab", { name: "Reporting history", exact: true }).click()
    await expect(page.getByText(/\d+(?:\.\d+)?% · \d+\/\d+ hours?/)).toBeVisible()
    await page.getByRole("tab", { name: "Overview", exact: true }).click()
    await expect(page.getByText("Public server information")).toBeVisible()
    await page.waitForTimeout(100)
    expect(finished).toBe(loaded)
})
