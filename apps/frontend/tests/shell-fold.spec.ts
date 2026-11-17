import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

// After folding a foldable phone the viewport is narrow before Kumo's JS switches to the drawer.
// In that moment a desktop sidebar must not take width from the content area.
test("a desktop sidebar is hidden by CSS below the sidebar breakpoint", async ({ page }) => {
    await mockNezha(page)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")
    await expect(page.locator("[data-server]").first()).toBeVisible()
    const state = await page.evaluate(() => {
        const aside = document.createElement("aside")
        aside.className = "nk-sidebar"
        aside.style.width = "260px"
        aside.style.flexShrink = "0"
        document.querySelector(".nk-shell-body")!.before(aside)
        const result = {
            display: getComputedStyle(aside).display,
            main: Math.round(document.querySelector(".nk-main")!.getBoundingClientRect().width),
            tile: Math.round(
                document.querySelector(".metric-tile")!.getBoundingClientRect().height,
            ),
        }
        aside.remove()
        return result
    })
    expect(state.display).toBe("none")
    expect(state.main).toBe(375)
    expect(state.tile).toBeLessThan(160)
})
