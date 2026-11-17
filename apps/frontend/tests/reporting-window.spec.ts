import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

test.use({ timezoneId: "Asia/Taipei", locale: "en-US" })
for (const hours of [24, 168]) {
    test(`R2-FE06 clips the rolling ${hours} hour window before calendar rows`, async ({
        page,
    }) => {
        const now = new Date("2026-11-18T01:10:00+08:00").getTime()
        await page.clock.setFixedTime(now)
        await mockNezha(page, { loggedIn: hours === 168 })
        let omitCurrentHour = false
        await page.route("**/metrics?*", (route) =>
            route.fulfill({
                json: {
                    success: true,
                    data: {
                        data_points: Array.from({ length: hours + 5 }, (_, i) => ({
                            ts: now - (hours + 2 - i) * 3600000,
                            value: 20,
                        })).filter((p) => !omitCurrentHour || p.ts < now),
                    },
                },
            }),
        )
        await page.goto("/server/6#history")
        const report = page.getByRole("region", { name: "Reporting rate", exact: true })
        // Both partial boundary hours intersect the rolling window.
        await expect(report.locator(".hour-grid-cell.bg-kumo-success")).toHaveCount(hours + 1)
        await expect(report).toContainText(`${hours}/${hours}`)
        await expect(report.locator(".hour-grid-rows > div")).toHaveCount(hours / 24 + 1)
        const stamped = await report
            .locator(".hour-grid-cell[title]")
            .evaluateAll((cells) => cells.map((c) => c.getAttribute("title")))
        expect(stamped[0]).toContain(hours === 24 ? "11/17 01:00" : "11/11 01:00")
        expect(stamped.at(-1)).toContain("11/18 01:00")
        await expect(report.locator('.hour-grid-cell[title$="22:00"]')).toHaveCount(hours / 24)
        omitCurrentHour = true
        await page.locator(".chart-toolbar button").click()
        await expect(report).toContainText(`${(hours - 1 / 6).toFixed(1)}/${hours}`)
    })
}
