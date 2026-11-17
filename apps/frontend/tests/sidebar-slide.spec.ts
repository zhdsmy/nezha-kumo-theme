import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

const TRACK = '.nk-sidebar [data-sidebar="sliding-views"] > div'
const ROOT_VIEW = '.nk-sidebar [data-sidebar="sliding-view"][data-value="root"]'
const CTX_VIEW = '.nk-sidebar [data-sidebar="sliding-view"][data-value="context"]'

function translateXFromMatrix(transform: string) {
    if (transform === "none") return 0
    const match = transform.match(/^matrix\(([^)]+)\)$/)
    if (!match) throw new Error(`Unexpected transform: ${transform}`)
    return Number(match[1].split(",")[4].trim())
}

test.describe("sidebar sliding views (normal motion)", () => {
    test.use({ reducedMotion: "no-preference" })

    test.beforeEach(async ({ page }) => {
        await mockNezha(page)
        await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
    })

    test("slides root <-> context with 250ms transform, marks inactive view inert, and keeps same-group switch static", async ({
        page,
    }) => {
        const consoleIssues: string[] = []
        page.on("pageerror", (err) => consoleIssues.push(err.message))
        page.on("console", (msg) => {
            if (msg.text().includes("Blocked aria-hidden")) {
                consoleIssues.push(msg.text())
            }
        })

        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/")
        await expect(page.locator("[data-server]")).toHaveCount(20)

        const track = page.locator(TRACK)
        const rootView = page.locator(ROOT_VIEW)
        const ctxView = page.locator(CTX_VIEW)

        const transitions = await page.evaluate((trackSel) => {
            const aside = getComputedStyle(document.querySelector("aside.nk-sidebar")!)
            const tr = getComputedStyle(document.querySelector(trackSel)!)
            return {
                collapse: `${aside.transitionProperty} ${aside.transitionDuration} ${aside.transitionTimingFunction}`,
                slide: `${tr.transitionProperty} ${tr.transitionDuration} ${tr.transitionTimingFunction}`,
            }
        }, TRACK)
        expect(transitions.collapse).toBe("width 0.25s cubic-bezier(0.77, 0, 0.175, 1)")
        expect(transitions.slide).toBe("transform 0.25s cubic-bezier(0.77, 0, 0.175, 1)")

        await expect(rootView).not.toHaveAttribute("inert")
        await expect(ctxView).toHaveAttribute("inert", "")

        const headerBefore = await page.locator(".nk-brand-row").boundingBox()
        const footerBefore = await page.locator(".nk-sidebar-footer").boundingBox()

        // Home -> click node (/server/32): slides left to second view (-100%)
        await page.locator('[data-server="32"] a').first().click()
        await expect(page).toHaveURL(/\/server\/32$/)

        await expect(rootView).toHaveAttribute("inert", "")
        await expect(rootView).toHaveAttribute("aria-hidden", "true")
        await expect(ctxView).not.toHaveAttribute("inert")
        await expect(ctxView).toHaveAttribute("aria-hidden", "false")

        // Remembered root content stays mounted for sliding, without active highlight
        await expect(rootView.locator("nav a")).toHaveCount(9)
        await expect(rootView.locator('[aria-current="page"], [data-active]')).toHaveCount(0)
        await expect(ctxView.locator('a[aria-current="page"] .nk-nav-label')).toHaveText(
            "Server 12",
        )
        await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(1)

        // Wait for 250ms slide transition to settle at -trackWidth
        await expect
            .poll(async () => {
                const { matrix, width, running } = await track.evaluate((el) => ({
                    matrix: getComputedStyle(el).transform,
                    width: el.getBoundingClientRect().width,
                    running: el.getAnimations().length,
                }))
                return running === 0 && Math.abs(translateXFromMatrix(matrix) + width) < 0.5
            })
            .toBe(true)

        // Header and Footer stayed stationary; no horizontal scrollbar
        expect(await page.locator(".nk-brand-row").boundingBox()).toEqual(headerBefore)
        expect(await page.locator(".nk-sidebar-footer").boundingBox()).toEqual(footerBefore)
        const hasOverflowX = await page.evaluate(() =>
            Array.from(
                document.querySelectorAll<HTMLElement>(
                    '.nk-sidebar [data-sidebar="sliding-views"], .nk-sidebar [data-sidebar="viewport"]',
                ),
            ).some((el) => el.scrollWidth > el.clientWidth),
        )
        expect(hasOverflowX).toBe(false)

        // Tab from brand skips inert root links and lands on context Back link
        await page.locator(".nk-sidebar .brand").focus()
        await page.keyboard.press("Tab")
        expect(
            await page.evaluate(() => document.activeElement?.closest(".nk-context") !== null),
        ).toBe(true)

        // Same-group peer switch (/server/32 -> /server/35): track transform stays unchanged
        const beforePeerMatrix = await track.evaluate((el) => getComputedStyle(el).transform)
        await ctxView.locator('nav a[href="/server/35"]').click()
        await expect(page).toHaveURL(/\/server\/35$/)
        const peerSwitchState = await track.evaluate((el) => ({
            matrix: getComputedStyle(el).transform,
            running: el.getAnimations().length,
        }))
        expect(peerSwitchState).toEqual({ matrix: beforePeerMatrix, running: 0 })
        await expect(ctxView.locator('a[aria-current="page"] .nk-nav-label')).toHaveText(
            "Server 13",
        )

        // Back to list: slides right back to first view (0%), context view becomes inert
        await ctxView.locator(".nk-context a").click()
        await expect(page).toHaveURL(/\/$/)
        await expect(ctxView).toHaveAttribute("inert", "")
        await expect(ctxView).toHaveAttribute("aria-hidden", "true")
        await expect(rootView).not.toHaveAttribute("inert")
        await expect(ctxView.locator(".nk-context")).toHaveCount(1)
        await expect(ctxView.locator('[aria-current="page"], [data-active]')).toHaveCount(0)
        await expect(rootView.locator('a[aria-current="page"] .nk-nav-label')).toHaveText(
            "Overview",
        )

        await expect
            .poll(async () => {
                const { matrix, running } = await track.evaluate((el) => ({
                    matrix: getComputedStyle(el).transform,
                    running: el.getAnimations().length,
                }))
                return running === 0 && translateXFromMatrix(matrix) === 0
            })
            .toBe(true)

        expect(consoleIssues).toEqual([])
    })

    test("direct entry to node page starts on context view without sliding transition", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/server/32")
        const state = await page.locator(TRACK).evaluate((el) => ({
            matrix: getComputedStyle(el).transform,
            width: el.getBoundingClientRect().width,
            running: el.getAnimations().length,
        }))
        expect(state.running).toBe(0)
        expect(Math.abs(translateXFromMatrix(state.matrix) + state.width)).toBeLessThan(0.5)
    })

    test("collapsed 57px rail slides cleanly and closed 375 mobile drawer does not replay animation on open", async ({
        page,
        browser,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/")
        await expect(page.locator("[data-server]")).toHaveCount(20)

        await page.getByRole("button", { name: "Collapse navigation" }).click()
        await expect(page.locator("aside.nk-sidebar")).toHaveAttribute("data-state", "collapsed")
        await expect
            .poll(() =>
                page.locator("aside.nk-sidebar").evaluate((el) => el.getBoundingClientRect().width),
            )
            .toBe(57)

        await page.locator('[data-server="32"] a').first().click()
        await expect(page).toHaveURL(/\/server\/32$/)
        await expect
            .poll(async () => {
                const { matrix, width, running } = await page.locator(TRACK).evaluate((el) => ({
                    matrix: getComputedStyle(el).transform,
                    width: el.getBoundingClientRect().width,
                    running: el.getAnimations().length,
                }))
                return (
                    running === 0 &&
                    width === 56 &&
                    Math.abs(translateXFromMatrix(matrix) + 56) < 0.5
                )
            })
            .toBe(true)
        await expect(
            page.locator(`${CTX_VIEW} li[data-sidebar="menu-item"][title="Server 13"]`),
        ).toHaveCount(1)

        // Mobile 375: switch while drawer is closed -> open immediately -> no track transition replays
        const mobileCtx = await browser.newContext({
            viewport: { width: 375, height: 812 },
            reducedMotion: "no-preference",
        })
        const mobilePage = await mobileCtx.newPage()
        await mockNezha(mobilePage)
        await mobilePage.addInitScript(() => localStorage.setItem("nkt:language", "en"))
        await mobilePage.goto("/")
        await expect(mobilePage.locator("[data-server]")).toHaveCount(20)

        const drawerTransition = await mobilePage
            .locator(".nk-sidebar[data-mobile]")
            .evaluate((el) => getComputedStyle(el).transition)
        expect(drawerTransition).toBe(
            "transform 0.25s cubic-bezier(0.77, 0, 0.175, 1), translate 0.25s cubic-bezier(0.77, 0, 0.175, 1), scale 0.25s cubic-bezier(0.77, 0, 0.175, 1), rotate 0.25s cubic-bezier(0.77, 0, 0.175, 1)",
        )

        await mobilePage.locator('[data-server="32"] a').first().click()
        await expect(mobilePage).toHaveURL(/\/server\/32$/)
        await mobilePage.getByRole("button", { name: "Open navigation" }).click()

        const mobileTrackState = await mobilePage.locator(TRACK).evaluate((el) => ({
            matrix: getComputedStyle(el).transform,
            width: el.getBoundingClientRect().width,
            running: el.getAnimations().length,
        }))
        expect(mobileTrackState.running).toBe(0)
        expect(
            Math.abs(translateXFromMatrix(mobileTrackState.matrix) + mobileTrackState.width),
        ).toBeLessThan(0.5)
        await mobileCtx.close()
    })
})

test("prefers-reduced-motion: reduce disables sliding transition", async ({ page }) => {
    await mockNezha(page)
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)

    const reduced = await page.locator(TRACK).evaluate((el) => {
        const s = getComputedStyle(el)
        return { property: s.transitionProperty, duration: s.transitionDuration }
    })
    expect(reduced.property === "none" || reduced.duration === "0s").toBe(true)

    await page.locator('[data-server="32"] a').first().click()
    await expect(page).toHaveURL(/\/server\/32$/)
    const after = await page.locator(TRACK).evaluate((el) => ({
        matrix: getComputedStyle(el).transform,
        width: el.getBoundingClientRect().width,
        running: el.getAnimations().length,
    }))
    expect(after.running).toBe(0)
    expect(Math.abs(translateXFromMatrix(after.matrix) + after.width)).toBeLessThan(0.5)
})
