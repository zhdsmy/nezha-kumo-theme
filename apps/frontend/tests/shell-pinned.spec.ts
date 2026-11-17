import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

// The sidebar and the top bar must stay on screen while the page scrolls, without relying on
// position: sticky (it breaks in some mobile browsers).
const boxes = () => {
    const rect = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left) }
    }
    return {
        sidebar: rect('.nk-sidebar [data-sidebar="content-container"]'),
        footer: rect(".nk-sidebar-footer"),
        topbar: rect(".nk-topbar"),
        main: rect(".nk-main"),
        position: [
            getComputedStyle(document.querySelector(".nk-sidebar")!).position,
            getComputedStyle(document.querySelector(".nk-topbar")!).position,
        ],
        height: window.innerHeight,
        scrollY: Math.round(window.scrollY),
    }
}

for (const width of [768, 867, 1440]) {
    test(`sidebar and top bar stay pinned while the page scrolls at ${width}px`, async ({
        page,
    }) => {
        await mockNezha(page)
        await page.setViewportSize({ width, height: 670 })
        await page.goto("/")
        await expect(page.locator("[data-server]").first()).toBeVisible()

        const before = await page.evaluate(boxes)
        expect(before.position).not.toContain("sticky")
        expect(before.topbar).toMatchObject({ top: 0, bottom: 58, left: 260 })
        expect(before.main.top).toBe(58)

        await page.evaluate(() => window.scrollTo(0, 400))
        const after = await page.evaluate(boxes)
        expect(after.scrollY).toBe(400)
        expect(after.sidebar).toMatchObject({ top: 0, bottom: after.height, left: 0 })
        expect(after.footer.bottom).toBe(after.height)
        expect(after.topbar).toMatchObject({ top: 0, bottom: 58, left: 260 })

        await page.locator(".nk-sidebar-footer button").first().click()
        await expect.poll(async () => (await page.evaluate(boxes)).topbar.left).toBe(57)
        const collapsed = await page.evaluate(boxes)
        expect(collapsed.sidebar).toMatchObject({ top: 0, bottom: collapsed.height })
        expect(collapsed.main.left).toBe(57)
    })
}

test("drawer mode keeps the top bar pinned at full width", async ({ page }) => {
    await mockNezha(page)
    await page.setViewportSize({ width: 375, height: 670 })
    await page.goto("/")
    await expect(page.locator("[data-server]").first()).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 400))
    const state = await page.evaluate(() => {
        const r = document.querySelector(".nk-topbar")!.getBoundingClientRect()
        return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width) }
    })
    expect(state).toEqual({ top: 0, left: 0, width: 375 })
})
