import { type Page, expect, test, webkit } from "@playwright/test"

import { mockNezha } from "./mock"

async function assertNodeTabsUnified(page: Page, baseURL: string) {
    await mockNezha(page)

    const tabSpecs = [
        { hash: "overview", label: "Overview" },
        { hash: "load", label: "Load" },
        { hash: "latency", label: "Latency" },
        { hash: "history", label: "Reporting history" },
    ] as const

    for (const width of [375, 867, 952, 1440] as const) {
        await page.setViewportSize({ width, height: 800 })
        for (const tab of tabSpecs) {
            await page.goto(`${baseURL}/server/6#${tab.hash}`)
            await expect(page.getByRole("tab", { name: tab.label, exact: true })).toHaveAttribute(
                "aria-selected",
                "true",
            )

            if (tab.hash === "overview") {
                await expect(page.locator(".node-info-grid")).toBeVisible()
            } else if (tab.hash === "load") {
                await expect(page.locator(".chart-card").first()).toBeVisible()
            } else if (tab.hash === "latency") {
                await expect(page.locator('.chart-card [role="switch"]')).toBeVisible()
            } else {
                await expect(page.locator(".hour-grid-rows")).toBeVisible()
            }

            // No visible heading inside .nk-main may repeat the active page tab name
            const visibleHeadings = await page.evaluate(() => {
                const main = document.querySelector(".nk-main")!
                return Array.from(main.querySelectorAll<HTMLElement>("h1, h2, h3, h4"))
                    .filter((el) => {
                        const style = getComputedStyle(el)
                        const rect = el.getBoundingClientRect()
                        return (
                            style.display !== "none" &&
                            style.visibility !== "hidden" &&
                            rect.width > 0 &&
                            rect.height > 0
                        )
                    })
                    .map((el) => (el.textContent ?? "").trim())
            })
            expect(
                visibleHeadings,
                `@${width} #${tab.hash} should not repeat tab title "${tab.label}"`,
            ).not.toContain(tab.label)

            // Shell scroll invariant & zero horizontal overflow
            const scrollMetrics = await page.evaluate(() => ({
                docOverflowY: getComputedStyle(document.documentElement).overflowY,
                docScrollTop: document.scrollingElement?.scrollTop ?? 0,
                overflowX:
                    document.documentElement.scrollWidth - document.documentElement.clientWidth,
            }))
            expect(scrollMetrics.docScrollTop).toBe(0)
            expect(scrollMetrics.overflowX).toBeLessThanOrEqual(0)
        }
    }

    // Overview narrow (375) vs wide (1440): card headings & accessible region names
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(`${baseURL}/server/6#overview`)
    await expect(page.locator(".node-subtabs")).toBeVisible()
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeHidden()
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeHidden()
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "System", exact: true })).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator(".node-subtabs")).toBeHidden()
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible()

    // Latency at 375: single-line .chart-heading with pluralized line count + interactive shave Switch
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(`${baseURL}/server/6#latency`)
    await expect(page.locator(".section-heading")).toHaveCount(0)
    const pingRegion = page.getByRole("region", { name: "3 lines", exact: true })
    await expect(pingRegion).toBeVisible()
    const shaveSwitch = pingRegion.getByRole("switch")
    await expect(shaveSwitch).toBeVisible()
    await expect(pingRegion.locator('button[aria-label="More information"]')).toBeVisible()

    const headingSingleLine = await pingRegion.locator(".chart-heading").evaluate((el) => {
        const h3 = el.querySelector("h3")!.getBoundingClientRect()
        const right = el.querySelector(":scope > div")!.getBoundingClientRect()
        const box = el.getBoundingClientRect()
        return {
            sameRow: Math.abs(h3.top + h3.height / 2 - (right.top + right.height / 2)) < 8,
            noOverlap: h3.right <= right.left + 1,
            fitsInCard: right.right <= box.right + 1 && h3.left >= box.left - 1,
        }
    })
    expect(headingSingleLine).toEqual({ sameRow: true, noOverlap: true, fitsInCard: true })

    const beforeClick = await shaveSwitch.getAttribute("aria-checked")
    await shaveSwitch.click()
    const afterClick = await shaveSwitch.getAttribute("aria-checked")
    expect(afterClick).not.toBe(beforeClick)
    await shaveSwitch.focus()
    await page.keyboard.press("Space")
    expect(await shaveSwitch.getAttribute("aria-checked")).toBe(beforeClick)

    // Reporting history (logged out -> recordHours=24 -> Last 24 hours) + Reporting rate card header
    await page.goto(`${baseURL}/server/6#history`)
    await expect(page.locator(".section-heading")).toHaveCount(0)
    await expect(page.locator(".chart-toolbar")).toContainText("Last 24 hours")
    await expect(page.locator(".chart-toolbar > button")).toBeVisible()
    const rateRegion = page.getByRole("region", { name: "Reporting rate", exact: true })
    await expect(rateRegion).toBeVisible()
    await expect(rateRegion.locator(".chart-heading")).toContainText(
        /\d+(?:\.\d+)?% · \d+\/\d+ hours?/,
    )
    await expect(rateRegion.locator(".hour-grid-cell").first()).toBeVisible()

    // Sign in -> recordHours=720 -> reportHours=168 -> Last 7 days & zh-CN 最近 7 天
    await page.route("**/api/v1/profile", (route) =>
        route.fulfill({ status: 200, json: { success: true, data: { username: "fixture" } } }),
    )
    await page.reload()
    await expect(page.locator(".chart-toolbar")).toContainText("Last 7 days")

    await page.evaluate(() => localStorage.setItem("nkt:language", "zh-CN"))
    await page.reload()
    await expect(page.locator(".chart-toolbar")).toContainText("最近 7 天")
    await expect(page.getByRole("region", { name: "上报率", exact: true })).toContainText(
        /\d+(?:\.\d+)?% · \d+\/\d+ 小时/,
    )
    await page.goto(`${baseURL}/server/6#latency`)
    await expect(page.getByRole("region", { name: "3 条线路", exact: true })).toBeVisible()
    await page.evaluate(() => localStorage.removeItem("nkt:language"))
    await page.reload()
}

test("NodePage 4 tabs unified structure, non-duplicate headings, and accessible card headers (Chromium)", async ({
    page,
    baseURL,
}) => {
    await assertNodeTabsUnified(page, baseURL!)
})

test("NodePage 4 tabs unified structure and foldable 375 -> 952 -> 375 live resize without reload (WebKit)", async ({
    baseURL,
}) => {
    const browser = await webkit.launch()
    try {
        const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
        const page = await context.newPage()
        await assertNodeTabsUnified(page, baseURL!)

        // Foldable live resize without reload: 375x667 -> 952x670 -> 375x667 on Overview and Latency
        for (const section of ["overview", "latency"] as const) {
            await page.setViewportSize({ width: 375, height: 667 })
            await page.goto(`${baseURL}/server/6#${section}`)

            if (section === "overview") {
                await expect(page.locator(".node-subtabs")).toBeVisible()
                await expect(
                    page.getByRole("heading", { name: "System", exact: true }),
                ).toBeHidden()

                // Unfold to 952x670 without reload
                await page.setViewportSize({ width: 952, height: 670 })
                await expect(page.locator(".node-subtabs")).toBeHidden()
                await expect(
                    page.getByRole("heading", { name: "System", exact: true }),
                ).toBeVisible()
                await expect(
                    page.getByRole("heading", { name: "Network", exact: true }),
                ).toBeVisible()
                await expect(
                    page.getByRole("heading", { name: "Billing", exact: true }),
                ).toBeVisible()

                // Fold back to 375x667 without reload
                await page.setViewportSize({ width: 375, height: 667 })
                await expect(page.locator(".node-subtabs")).toBeVisible()
                await expect(
                    page.getByRole("heading", { name: "System", exact: true }),
                ).toBeHidden()
            } else {
                await expect(page.locator('.chart-card [role="switch"]')).toBeVisible()

                // Unfold to 952x670 without reload
                await page.setViewportSize({ width: 952, height: 670 })
                await expect(page.locator('.chart-card [role="switch"]')).toBeVisible()
                const wideOverflow = await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth - document.documentElement.clientWidth,
                )
                expect(wideOverflow).toBeLessThanOrEqual(0)

                // Fold back to 375x667 without reload
                await page.setViewportSize({ width: 375, height: 667 })
                const foldedCheck = await page.evaluate(() => {
                    const heading = document.querySelector(".chart-card .chart-heading")!
                    const h3 = heading.querySelector("h3")!.getBoundingClientRect()
                    const right = heading.querySelector(":scope > div")!.getBoundingClientRect()
                    return {
                        overflow:
                            document.documentElement.scrollWidth -
                            document.documentElement.clientWidth,
                        sameRow:
                            Math.abs(h3.top + h3.height / 2 - (right.top + right.height / 2)) < 8,
                        noOverlap: h3.right <= right.left + 1,
                    }
                })
                expect(foldedCheck.overflow).toBeLessThanOrEqual(0)
                expect(foldedCheck.sameRow).toBe(true)
                expect(foldedCheck.noOverlap).toBe(true)
            }
        }
        await context.close()
    } finally {
        await browser.close()
    }
})
