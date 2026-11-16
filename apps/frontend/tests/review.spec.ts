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

test.beforeEach(async ({ page }) => {
    await mockNezha(page)
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
})

test("compact tiles and full seeded sparks fit the first phone screen; numbers stay complete", async ({
    page,
}) => {
    await mockNezha(page, { price: "CNY 22656.00" })
    await page.addInitScript(() => {
        localStorage.setItem("nkt:currency", "CNY")
        localStorage.setItem("nkt:period", "month")
    })
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/")
    await fullSparks(page, 3)
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
    await expect(page.locator(".nk-page-actions .cost-button")).toBeVisible()
    await expect(page.locator(".topbar-title")).toHaveText("Infrastructure")
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator(".topbar-title")).toBeHidden()
    const price = page.locator(".card-facts dd").filter({ hasText: "¥1,888.00/mo" }).first()
    await expect(price).toBeVisible()
    expect(await price.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
    // the fee sits beside the title; its menu sets currency and period in place
    await expect(page.locator(".cost-button .cost-value")).toContainText("¥")
    await page.locator(".cost-button").click()
    await page.getByRole("menuitemradio", { name: "Yearly", exact: true }).click()
    await expect(page.locator(".cost-button")).toContainText("Yearly fees")
    await expect(price).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/server/6")
    await expect(page.locator(".spark")).toHaveCount(0)
    await expect(page.locator(".topbar-title")).toHaveText("Infrastructure")
    expect(
        await page
            .locator(".node-info-panel[data-active]")
            .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(900)
    await page.goto("/server/6#load")
    await expect(page.locator(".spark")).toHaveCount(0)
    await expect(page.locator(".chart svg")).toHaveCount(6)
    expect(
        await page
            .locator(".chart")
            .first()
            .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(900)
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
    await fullSparks(page, 3)
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
    await expect(page.locator(".chart svg")).toHaveCount(6)
    for (const name of ["1 d", "7 d", "30 d"]) {
        await page.getByRole("button", { name, exact: true }).click()
        await expect(page.locator(".chart svg")).toHaveCount(6)
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
        await page.getByRole("button", { name, exact: true }).click()
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
    await expect(page.locator(".chart svg")).toHaveCount(6)
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
    await expect(page.getByText(/hours reported/)).toBeVisible()
    await page.getByRole("tab", { name: "Overview", exact: true }).click()
    await expect(page.getByText("Public server information")).toBeVisible()
    await page.waitForTimeout(100)
    expect(finished).toBe(loaded)
})
