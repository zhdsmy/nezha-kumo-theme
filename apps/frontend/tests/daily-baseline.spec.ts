import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

for (const missing of ["net_out_transfer", "net_in_transfer", "both"]) {
    test(`R2-FE04 shows unknown daily traffic without ${missing} baseline`, async ({ page }) => {
        await mockNezha(page)
        await page.route("**/metrics?*", (route) => {
            const metric = new URL(route.request().url()).searchParams.get("metric")!
            const absent = metric.includes("transfer") && (missing === "both" || missing === metric)
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        data_points: absent ? [] : [{ ts: Date.now() - 1000, value: 100 }],
                    },
                },
            })
        })
        await page.goto("/server/6")
        const field = page
            .locator("#node-panel-network dl > div")
            .filter({
                has: page.getByText("Today’s traffic", { exact: true }),
            })
            .locator("dd")
        await expect(page.locator("#node-panel-network")).toBeAttached()
        await page.waitForLoadState("networkidle")
        await expect(field).toHaveText("—")
        await page.goto("/")
        await page.waitForLoadState("networkidle")
        await expect(
            page
                .locator(".metric-tile")
                .filter({ has: page.getByText("Today’s traffic", { exact: true }) })
                .locator(".tile-value"),
        ).toHaveText("—")
    })
}
