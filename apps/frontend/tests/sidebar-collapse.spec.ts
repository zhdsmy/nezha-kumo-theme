import { type Page, expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

interface FrameSample {
    t: number
    sidebarWidth: number
    overflowX: boolean
    logoX: number
    searchIconX: number
    triggerX: number
    iconXs: number[]
    itemYs: number[]
    labelVisibleWidth: number
    footerVisibleWidth: number
    runningAnimations: number
}

async function sampleSidebarTransition(
    page: Page,
    triggerLabel: "Collapse navigation" | "Expand navigation",
    targetWidth: number,
): Promise<FrameSample[]> {
    const sampling = page.evaluate(async (expectedWidth) => {
        const samples: FrameSample[] = []
        const start = performance.now()
        const snap = (): FrameSample => {
            const aside = document.querySelector<HTMLElement>("aside.nk-sidebar")!
            const logo = aside.querySelector<SVGElement>(".brand svg")!
            const searchSvg = aside.querySelector<SVGElement>(".sidebar-search > svg")
            const trigger = aside.querySelector<HTMLElement>(
                '.nk-sidebar-footer [data-sidebar="trigger"]',
            )!
            const activeView = aside.querySelector<HTMLElement>(
                '[data-sidebar="sliding-view"]:not([inert])',
            )!
            const icons = Array.from(activeView.querySelectorAll<HTMLElement>(".nk-nav-icon"))
            const buttons = Array.from(
                activeView.querySelectorAll<HTMLElement>('[data-sidebar="menu-button"]'),
            )
            const firstBtn = buttons[0]!
            const firstLabel = firstBtn.querySelector<HTMLElement>(".nk-nav-label")!
            const btnRect = firstBtn.getBoundingClientRect()
            const lblRect = firstLabel.getBoundingClientRect()
            const labelVisibleWidth = Math.max(
                0,
                Math.min(btnRect.right, lblRect.right) - Math.max(btnRect.left, lblRect.left),
            )
            const footer = aside.querySelector<HTMLElement>(".nk-sidebar-footer")!
            const footerContent = aside.querySelector<HTMLElement>(".nk-footer-content")!
            const fRect = footer.getBoundingClientRect()
            const fcRect = footerContent.getBoundingClientRect()
            const footerVisibleWidth = Math.max(
                0,
                Math.min(fRect.right - 1, fcRect.right) - Math.max(fRect.left, fcRect.left),
            )
            const runningAnimations = aside
                .getAnimations({ subtree: true })
                .filter((a) => a.playState === "running").length
            return {
                t: Math.round(performance.now() - start),
                sidebarWidth: aside.getBoundingClientRect().width,
                overflowX: document.documentElement.scrollWidth > window.innerWidth,
                logoX: logo.getBoundingClientRect().left,
                searchIconX: searchSvg ? searchSvg.getBoundingClientRect().left : 0,
                triggerX: trigger.getBoundingClientRect().left,
                iconXs: icons.map(
                    (el) => (el.firstElementChild ?? el).getBoundingClientRect().left,
                ),
                itemYs: buttons.map((el) => el.getBoundingClientRect().top),
                labelVisibleWidth,
                footerVisibleWidth,
                runningAnimations,
            }
        }
        samples.push(snap())
        let settled = 0
        while (performance.now() - start < 1500) {
            await new Promise((r) => setTimeout(r, 28))
            const s = snap()
            samples.push(s)
            if (Math.abs(s.sidebarWidth - expectedWidth) < 0.5 && s.runningAnimations === 0) {
                settled += 1
                if (settled >= 2 && samples.length >= 4) break
            } else {
                settled = 0
            }
        }
        return samples
    }, targetWidth)

    await page.getByRole("button", { name: triggerLabel }).click()
    return sampling
}

function maxSpread(values: number[]): number {
    return Math.max(...values) - Math.min(...values)
}

test.describe("Sidebar native Kumo collapse, search slot, and mobile parity", () => {
    test.use({ reducedMotion: "no-preference" })

    test.beforeEach(async ({ page }) => {
        await mockNezha(page)
        await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
    })

    test("1440w collapse & expand: icon shift <= 4px, monotonic width, gradual clip, zero overflow, accessible names & tooltips", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/")
        await expect(page.locator("[data-server]")).toHaveCount(20)

        // Topbar has no Search button at desktop width
        await expect(
            page.locator(".nk-topbar").getByRole("button", { name: "Search" }),
        ).toHaveCount(0)

        // Collapse transition (~30ms sampling)
        const collapseSamples = await sampleSidebarTransition(page, "Collapse navigation", 57)
        expect(collapseSamples.some((s) => s.sidebarWidth > 60 && s.sidebarWidth < 256)).toBe(true)
        expect(collapseSamples.every((s) => !s.overflowX)).toBe(true)

        for (let i = 1; i < collapseSamples.length; i++) {
            expect(collapseSamples[i]!.sidebarWidth).toBeLessThanOrEqual(
                collapseSamples[i - 1]!.sidebarWidth + 0.1,
            )
            // Vertical positions move smoothly upward as GroupLabel collapses into divider
            for (let j = 0; j < collapseSamples[i]!.itemYs.length; j++) {
                expect(collapseSamples[i]!.itemYs[j]!).toBeLessThanOrEqual(
                    collapseSamples[i - 1]!.itemYs[j]! + 0.5,
                )
            }
        }

        // Brand logo does not jump; search icon, footer trigger, and every nav icon shift <= 4px
        expect(maxSpread(collapseSamples.map((s) => s.logoX))).toBeLessThanOrEqual(1)
        expect(maxSpread(collapseSamples.map((s) => s.searchIconX))).toBeLessThanOrEqual(4)
        expect(maxSpread(collapseSamples.map((s) => s.triggerX))).toBeLessThanOrEqual(4)
        const iconCount = collapseSamples[0]!.iconXs.length
        expect(iconCount).toBeGreaterThanOrEqual(7)
        let maxNavIconSpread = 0
        for (let idx = 0; idx < iconCount; idx++) {
            const xs = collapseSamples.map((s) => s.iconXs[idx]!)
            for (const x of xs) {
                expect(x).toBeGreaterThanOrEqual(18)
                expect(x).toBeLessThanOrEqual(26)
            }
            const spread = maxSpread(xs)
            maxNavIconSpread = Math.max(maxNavIconSpread, spread)
            expect(spread).toBeLessThanOrEqual(4)
        }
        console.log(
            JSON.stringify({
                collapseFrames: collapseSamples.length,
                maxNavIconSpread: Number(maxNavIconSpread.toFixed(2)),
                searchIconSpread: Number(
                    maxSpread(collapseSamples.map((s) => s.searchIconX)).toFixed(2),
                ),
                logoSpread: Number(maxSpread(collapseSamples.map((s) => s.logoX)).toFixed(2)),
            }),
        )

        // Label and footer content clip gradually (intermediate visible width strictly between 0 and initial)
        const initialLabelW = collapseSamples[0]!.labelVisibleWidth
        expect(
            collapseSamples.some(
                (s) => s.labelVisibleWidth > 2 && s.labelVisibleWidth < initialLabelW - 2,
            ),
        ).toBe(true)
        expect(collapseSamples.at(-1)!.labelVisibleWidth).toBe(0)
        expect(collapseSamples.at(-1)!.footerVisibleWidth).toBe(0)

        // Collapsed state: accessible names retained & hover shows right-side Kumo tooltip
        const rootNav = page.locator(
            'aside.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) nav',
        )
        await expect(rootNav.getByRole("link", { name: /Overview/ })).toHaveAttribute(
            "aria-current",
            "page",
        )
        await expect(rootNav.getByRole("link", { name: /🇺🇸 美国/ })).toBeVisible()
        await rootNav.getByRole("link", { name: /Overview/ }).hover()
        await expect(page.locator(".kumo-tooltip-popup")).toContainText("Overview")
        await page.mouse.move(700, 400)

        // Expand transition (~30ms sampling)
        const expandSamples = await sampleSidebarTransition(page, "Expand navigation", 260)
        expect(expandSamples.some((s) => s.sidebarWidth > 60 && s.sidebarWidth < 256)).toBe(true)
        expect(expandSamples.every((s) => !s.overflowX)).toBe(true)
        for (let i = 1; i < expandSamples.length; i++) {
            expect(expandSamples[i]!.sidebarWidth).toBeGreaterThanOrEqual(
                expandSamples[i - 1]!.sidebarWidth - 0.1,
            )
        }
        expect(maxSpread(expandSamples.map((s) => s.logoX))).toBeLessThanOrEqual(1)
        expect(maxSpread(expandSamples.map((s) => s.searchIconX))).toBeLessThanOrEqual(4)
        expect(maxSpread(expandSamples.map((s) => s.triggerX))).toBeLessThanOrEqual(4)
        for (let idx = 0; idx < iconCount; idx++) {
            expect(maxSpread(expandSamples.map((s) => s.iconXs[idx]!))).toBeLessThanOrEqual(4)
        }

        // Node context view (/server/32) also collapses cleanly with <= 4px shift
        await page.goto("/server/32")
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Server 12")
        const nodeCollapse = await sampleSidebarTransition(page, "Collapse navigation", 57)
        expect(nodeCollapse.every((s) => !s.overflowX)).toBe(true)
        for (let idx = 0; idx < nodeCollapse[0]!.iconXs.length; idx++) {
            expect(maxSpread(nodeCollapse.map((s) => s.iconXs[idx]!))).toBeLessThanOrEqual(4)
        }
        const ctxView = page.locator('aside.nk-sidebar [data-sidebar="sliding-view"]:not([inert])')
        await expect(
            ctxView.locator(".nk-context").getByRole("link", { name: "Back to list" }),
        ).toBeVisible()
    })

    test("sidebar search opens global search dialog in both expanded and collapsed states; reduced-motion skips animation", async ({
        page,
        browser,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/")
        await expect(page.locator("[data-server]")).toHaveCount(20)

        const searchBtn = page.locator("aside.nk-sidebar .sidebar-search")
        await expect(searchBtn).toContainText("Search…")
        await expect(searchBtn).toContainText("⌘K")

        // Expanded click opens search dialog
        await searchBtn.click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await dialog.getByRole("textbox").fill("Server 13")
        await expect(dialog.locator(".search-result")).toHaveCount(1)
        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()

        // Collapse sidebar -> magnifying glass aligns with nav icons and opens search dialog
        await page.getByRole("button", { name: "Collapse navigation" }).click()
        await expect
            .poll(() =>
                page.locator("aside.nk-sidebar").evaluate((el) => el.getBoundingClientRect().width),
            )
            .toBe(57)
        const [searchIconX, navIconX] = await page.evaluate(() => {
            const s = document.querySelector("aside.nk-sidebar .sidebar-search > svg")!
            const n = document.querySelector(
                'aside.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) .nk-nav-icon',
            )!
            return [s.getBoundingClientRect().left, n.getBoundingClientRect().left]
        })
        expect(Math.abs(searchIconX - navIconX)).toBeLessThanOrEqual(1)

        await searchBtn.hover()
        await expect(page.locator(".kumo-tooltip-popup")).toContainText("Search (⌘K)")
        await searchBtn.click()
        await expect(dialog).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()

        // prefers-reduced-motion: reduce disables transition animations
        const rmCtx = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            reducedMotion: "reduce",
        })
        const rmPage = await rmCtx.newPage()
        await mockNezha(rmPage)
        await rmPage.goto("/")
        await expect(rmPage.locator("[data-server]")).toHaveCount(20)
        await rmPage.getByRole("button", { name: "Collapse navigation" }).click()
        const rmState = await rmPage.locator("aside.nk-sidebar").evaluate((el) => ({
            width: el.getBoundingClientRect().width,
            animations: el.getAnimations({ subtree: true }).length,
        }))
        expect(rmState).toEqual({ width: 57, animations: 0 })
        await rmCtx.close()
    })

    test("375w mobile matches Cloudflare mobile: no icon rail even if collapsed saved, no topbar search, drawer search closes drawer & opens dialog", async ({
        browser,
    }) => {
        const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
        const page = await ctx.newPage()
        await mockNezha(page)
        await page.addInitScript(() => {
            localStorage.setItem("nkt:language", "en")
            localStorage.setItem("nkt:sidebar-collapsed", "true")
        })
        await page.goto("/")
        await expect(page.locator("[data-server]")).toHaveCount(20)

        // No desktop rail element exists, and offscreen drawer is completely out of viewport
        await expect(page.locator("aside.nk-sidebar")).toHaveCount(0)
        const drawerClosedRight = await page
            .locator(".nk-sidebar[data-mobile]")
            .evaluate((el) => el.getBoundingClientRect().right)
        expect(drawerClosedRight).toBeLessThanOrEqual(0)

        // Topbar has NO Search button at 375w, and has Open navigation button on the left
        await expect(
            page.locator(".nk-topbar").getByRole("button", { name: "Search" }),
        ).toHaveCount(0)
        const openBtn = page.getByRole("button", { name: "Open navigation" })
        await expect(openBtn).toBeVisible()

        // Open drawer: full 260px expanded layout regardless of saved desktop collapsed state
        await openBtn.click()
        const drawer = page.locator(".nk-sidebar[data-mobile]")
        await expect(drawer).toHaveAttribute("data-state", "expanded")
        await expect.poll(() => drawer.evaluate((el) => el.getBoundingClientRect().left)).toBe(0)

        const drawerMetrics = await drawer.evaluate((el) => {
            const search = el.querySelector<HTMLElement>(".sidebar-search")!
            const label = el.querySelector<HTMLElement>(
                '[data-sidebar="sliding-view"]:not([inert]) .nk-nav-label',
            )!
            return {
                drawerWidth: el.getBoundingClientRect().width,
                searchWidth: search.getBoundingClientRect().width,
                labelWidth: label.getBoundingClientRect().width,
            }
        })
        expect(drawerMetrics.drawerWidth).toBe(260)
        expect(drawerMetrics.searchWidth).toBeGreaterThan(200)
        expect(drawerMetrics.labelWidth).toBeGreaterThan(50)
        await expect(drawer.getByRole("button", { name: "Close navigation" })).toBeVisible()
        await expect(drawer.locator(".sidebar-search")).toContainText("Search…")

        // Clicking search in drawer closes drawer AND opens global search dialog with focus inside dialog
        await drawer.locator(".sidebar-search").click()
        await expect(drawer).toHaveAttribute("data-state", "collapsed")
        await expect(drawer).toHaveAttribute("aria-hidden", "true")
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await dialog.getByRole("textbox").fill("Server 02")
        await expect(dialog.locator(".search-result")).toHaveCount(1)

        await ctx.close()
    })
})
