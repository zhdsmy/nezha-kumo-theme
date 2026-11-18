import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

test("R07 keeps the active peer visible after the sidebar gets shorter", async ({ page }) => {
    await mockNezha(page, { allOnline: true })
    await page.route("**/api/v1/server-group", (route) =>
        route.fulfill({ json: { success: true, data: [] } }),
    )
    await page.setViewportSize({ width: 1440, height: 1150 })
    await page.goto("/server/6")
    const peers = page.locator('.nk-sidebar [data-value="context"] nav a')
    await peers.last().click()
    const active = peers.last()
    await expect(active).toHaveAttribute("aria-current", "page")
    await page.setViewportSize({ width: 1440, height: 520 })
    await expect(active).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
})
