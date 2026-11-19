import { type Locator, expect, test } from "@playwright/test"

import frame from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

async function touchSize(control: Locator) {
    const box = await control.boundingBox()
    expect.soft(box?.width, String(control)).toBeGreaterThanOrEqual(44)
    expect.soft(box?.height, String(control)).toBeGreaterThanOrEqual(44)
}

async function geometry(control: Locator) {
    return control.evaluate((el) => el.getBoundingClientRect().toJSON())
}

test.beforeEach(async ({ page }) => {
    await mockNezha(page)
})

test("NF02 load chart fits the first resize frame", async ({ page }) => {
    await page.setViewportSize({ width: 1127, height: 800 })
    await page.goto("/server/6#load")
    await expect(page.locator(".chart svg").first()).toBeVisible()
    const firstFrame = page.evaluate(
        () =>
            new Promise<number>((resolve) => {
                addEventListener(
                    "resize",
                    () => {
                        const main = document.querySelector(".nk-main")!
                        resolve(main.scrollWidth - main.clientWidth)
                    },
                    { once: true },
                )
            }),
    )
    await page.setViewportSize({ width: 375, height: 800 })
    expect(await firstFrame).toBe(0)
})

for (const width of [375, 1440]) {
    test(`X10 F4 range and refresh center and height at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto("/server/6#load")
        const rail = await geometry(page.locator(".chart-toolbar [role=tablist]"))
        const refresh = await geometry(page.locator(".chart-toolbar > button"))
        expect.soft(rail.height).toBe(refresh.height)
        expect(
            Math.abs((rail.top + rail.bottom - refresh.top - refresh.bottom) / 2),
        ).toBeLessThanOrEqual(1)
    })
}

for (const lang of ["en", "zh-CN", "zh-TW", "ja"]) {
    test(`NF07 F3 X06 long labels at 375 in ${lang}`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 800 })
        await page.addInitScript((language) => localStorage.setItem("nkt:language", language), lang)
        await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
            const servers = structuredClone(frame.servers)
            servers[0].name = "TokyoEdge".repeat(20)
            servers[0].country_code = "jp"
            servers.forEach((s, i) => {
                s.last_active = new Date(Date.now() - (i === 1 ? 120000 : 0)).toISOString()
            })
            ws.send(JSON.stringify({ now: Date.now(), servers }))
        })
        await page.goto("/")
        const status = await geometry(page.locator(".status-trigger"))
        const label = await geometry(page.locator(".status-trigger > span"))
        expect
            .soft(Math.min(label.top - status.top, status.bottom - label.bottom))
            .toBeGreaterThanOrEqual(4)
        for (const selector of ['[data-server="6"] .card-name-text', "h1"]) {
            if (selector === "h1") await page.goto("/server/6")
            await expect(page.locator(selector).locator(".region-flag")).toBeVisible()
            const placement = await page.locator(selector).evaluate((el) => {
                const flag = el.querySelector(".region-flag")!.getBoundingClientRect()
                const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
                let node: Node | null
                while ((node = walk.nextNode()) && !node.textContent?.includes("TokyoEdge")) {}
                const range = document.createRange()
                range.setStart(node!, 0)
                range.setEnd(node!, 1)
                const glyph = range.getBoundingClientRect()
                return {
                    toRight: glyph.left - flag.right,
                    overlap: Math.min(flag.bottom, glyph.bottom) - Math.max(flag.top, glyph.top),
                }
            })
            expect.soft(placement.toRight, selector).toBeGreaterThanOrEqual(0)
            expect.soft(placement.overlap, selector).toBeGreaterThan(0)
        }
    })
}

test.describe("touch controls", () => {
    test.use({ hasTouch: true })
    for (const width of [375, 952]) {
        test(`NF04 NF05 F2 F6 visible region responds on first tap at ${width}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 800 })
            await page.goto("/")
            const rail = page.locator(".region-tabs")
            await expect(rail.getByRole("tab")).toHaveCount(6)
            for (const control of await page
                .locator(
                    ".section-controls button:visible, .cost-button, .region-tabs [role=tab], .region-tabs [data-kumo-part=overflow-control][aria-hidden=false]",
                )
                .all()) {
                await touchSize(control)
            }
            // The status line appears and goes with live data. On one line it must keep the
            // 32px box so the tiles do not jump; its 44px target comes from ::after.
            const status = page.locator(".status-trigger")
            if (await status.count()) {
                const probe = await status.evaluate((el) => {
                    const r = el.getBoundingClientRect()
                    const label = el.querySelector("span")!
                    const lines = Math.round(
                        label.getBoundingClientRect().height /
                            parseFloat(getComputedStyle(label).lineHeight),
                    )
                    const x = r.left + r.width / 2
                    const y = r.top + r.height / 2
                    const hits = [y - 21, y + 21].map((v) =>
                        el.contains(document.elementFromPoint(x, v)),
                    )
                    return { height: r.height, lines, hits }
                })
                expect.soft(probe.hits).toEqual([true, true])
                if (probe.lines === 1) expect.soft(probe.height).toBeLessThanOrEqual(32)
            }
            const list = rail.getByRole("tablist")
            const arrow = rail.locator("[data-side=end][aria-hidden=false]")
            if (width === 375) await expect(arrow).toBeVisible()
            if (await arrow.count()) {
                const bounds = await geometry(list)
                const edge = await geometry(arrow)
                await touchSize(arrow)
                expect
                    .soft(await arrow.evaluate((el) => getComputedStyle(el).backgroundColor))
                    .not.toBe("rgba(0, 0, 0, 0)")
                expect.soft(bounds.right).toBeLessThanOrEqual(edge.left + 1)
                // Pick the last painted tab, including a partially visible one.
                const tabs = rail.getByRole("tab")
                let tapped = false
                for (const tab of (await tabs.all()).reverse()) {
                    const box = await geometry(tab)
                    const right = Math.min(box.right, bounds.right)
                    if (right - box.left < 2) continue
                    const code = await tab.locator(".region-code").textContent()
                    await page.touchscreen.tap((box.left + right) / 2, (box.top + box.bottom) / 2)
                    await expect(page).toHaveURL(new RegExp("region=" + code))
                    tapped = true
                    break
                }
                expect(tapped).toBe(true)
            }
            if (width === 375) await page.locator(".nk-drawer-trigger").click()
            for (const selector of [
                ".sidebar-search",
                ".nk-sidebar .nk-nav-link",
                width === 375 ? '.nk-sidebar [data-sidebar="close"]' : ".nk-sidebar-footer button",
            ]) {
                await touchSize(page.locator(selector + ":visible").first())
            }
            if (width === 952) {
                // The 44px search target is wider than the 57px rail; its label must not leak.
                await page.getByRole("button", { name: "Collapse navigation" }).click()
                await expect(page.locator(".nk-sidebar")).toHaveAttribute("data-state", "collapsed")
                await expect(page.locator(".sidebar-search-body")).toBeHidden()
                await touchSize(page.locator(".sidebar-search"))
            }
        })
    }
    test("NF05 login, overview tabs and latency switch hit areas", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 800 })
        await page.goto("/")
        await page.getByRole("button", { name: "Sign in", exact: true }).click()
        await touchSize(page.locator(".dialog-close"))
        await touchSize(page.locator(".login-form [type=submit]"))
        await page.locator(".dialog-close").click()
        await page.goto("/server/6")
        await touchSize(page.locator(".node-subtabs [role=tab]").first())
        await page.goto("/server/6#latency")
        const toggle = page.getByRole("switch").first()
        await toggle.scrollIntoViewIfNeeded()
        const box = await geometry(toggle)
        const checked = await toggle.getAttribute("aria-checked")
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 - 21)
        await expect(toggle).not.toHaveAttribute("aria-checked", checked!)
    })
    test("NF06 hour navigation has distinct targets and crosses an hour", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 800 })
        await page.goto("/server/6#history")
        const cells = page.locator(".hour-grid-cell[data-at]")
        await expect(cells.first()).toBeVisible()
        const buttons = page.locator(".hour-grid-nav button")
        await expect(buttons).toHaveCount(2, { timeout: 1500 })
        for (const button of await buttons.all()) await touchSize(button)
        const previous = buttons.first(),
            next = buttons.last()
        expect((await geometry(previous)).right).toBeLessThanOrEqual((await geometry(next)).left)
        await previous.click()
        const reading = page.locator(".hour-grid-selected")
        await expect(reading).toContainText((await cells.nth(-2).getAttribute("data-stamp"))!)
        await next.click()
        await expect(reading).toContainText((await cells.last().getAttribute("data-stamp"))!)
        await expect(next).toBeDisabled()
    })
})

test("F5 light region labels and selected group count meet text contrast", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    for (const selector of [
        '.region-tab[aria-selected="false"] .region-code',
        '.region-tab[aria-selected="false"] .muted',
        '.nk-nav-link[aria-current="page"] .nk-nav-badge',
    ]) {
        const node = page.locator(selector).first()
        await expect(node).toBeVisible()
        const contrast = await node.evaluate((el) => {
            const ctx = document.createElement("canvas").getContext("2d")!
            const ancestors = []
            for (let p: Element | null = el; p; p = p.parentElement) ancestors.unshift(p)
            ctx.fillStyle = "white"
            ctx.fillRect(0, 0, 1, 1)
            for (const p of ancestors) {
                ctx.fillStyle = getComputedStyle(p).backgroundColor
                ctx.fillRect(0, 0, 1, 1)
            }
            function luminance() {
                const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data)
                    .slice(0, 3)
                    .map((v) => v / 255)
                const [r, g, b] = rgb.map((v) =>
                    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
                )
                return 0.2126 * r + 0.7152 * g + 0.0722 * b
            }
            const bg = luminance()
            ctx.fillStyle = getComputedStyle(el).color
            ctx.fillRect(0, 0, 1, 1)
            return (bg + 0.05) / (luminance() + 0.05)
        })
        expect.soft(contrast, selector).toBeGreaterThanOrEqual(4.5)
    }
})
