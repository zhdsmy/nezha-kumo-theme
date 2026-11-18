import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

test("F11 aligns wide topbar actions to the current page width", async ({ page }) => {
    await mockNezha(page)
    for (const path of ["/", "/server/29"]) {
        await page.goto(path)
        await page
            .locator(path === "/" ? "[data-server]" : ".node-info-grid")
            .first()
            .waitFor()
        for (const width of [1440, 1920, 2560]) {
            await page.setViewportSize({ width, height: 900 })
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const right = (selector: string) =>
                            document.querySelector(selector)!.getBoundingClientRect().right
                        const target =
                            innerWidth === 1440 ? innerWidth - 16 : right(".nk-page-heading")
                        return Math.abs(right(".nk-topbar-actions") - target)
                    }),
                )
                .toBeLessThanOrEqual(1)
        }
    }
})

test("F11 shows two load charts at 1024 and one below it", async ({ page }) => {
    await mockNezha(page)
    await page.goto("/server/29#load")
    const charts = page.locator(".chart-grid:not([aria-hidden])")
    await charts.locator(".chart-card").first().waitFor()
    for (const [width, columns] of [
        [952, 1],
        [1023, 1],
        [1024, 2],
        [1280, 2],
    ]) {
        await page.setViewportSize({ width, height: 768 })
        await expect
            .poll(() =>
                charts.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length),
            )
            .toBe(columns)
    }
})
