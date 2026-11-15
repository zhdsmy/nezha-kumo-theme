import { expect, test } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { BREAKPOINTS, SHELL } from "../../../packages/ui/src/contract"

const widths = [
    375,
    856,
    1024,
    1440,
    ...Object.values(BREAKPOINTS).flatMap((width) => [width - 1, width]),
]
const evidence = process.env.NKT_EVIDENCE_DIR

test("shell layout at measured boundaries in both appearances", async ({ page }) => {
    test.setTimeout(120_000)
    const errors: string[] = []
    const checks: object[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    if (evidence) await mkdir(join(evidence, "shots"), { recursive: true })
    for (const mode of ["light", "dark"]) {
        for (const route of ["fleet", "server"]) {
            for (const width of widths) {
                await page.setViewportSize({ width, height: 900 })
                await page.goto(route === "fleet" ? "/demo" : "/demo/server")
                await page.evaluate((mode) => {
                    document.documentElement.dataset.mode = mode
                }, mode)
                await page.evaluate(() => document.fonts.ready)
                const desktop = width >= BREAKPOINTS.sidebar
                if (desktop)
                    await expect(page.locator(".nk-sidebar")).not.toHaveAttribute("data-mobile")
                else
                    await expect(page.locator(".nk-sidebar")).toHaveAttribute("data-mobile", "true")
                const geometry = await page.evaluate(() => {
                    const rect = (selector: string) => {
                        const r = document.querySelector(selector)!.getBoundingClientRect()
                        return {
                            x: r.x,
                            y: r.y,
                            width: r.width,
                            height: r.height,
                            right: r.right,
                            bottom: r.bottom,
                        }
                    }
                    return {
                        scrollWidth: document.documentElement.scrollWidth,
                        viewport: innerWidth,
                        sidebar: rect(".nk-sidebar"),
                        topbar: rect(".nk-topbar"),
                        main: rect(".nk-page-content"),
                        mainTrack: rect(".nk-page-main"),
                        aside: document.querySelector(".nk-page-aside")
                            ? rect(".nk-page-aside")
                            : null,
                        gutter: getComputedStyle(document.querySelector(".nk-shell")!)
                            .getPropertyValue("--nk-gutter")
                            .trim(),
                        columns: getComputedStyle(
                            document.querySelector(".demo-tiles")!,
                        ).gridTemplateColumns.split(" ").length,
                        mode: getComputedStyle(document.documentElement).colorScheme,
                        canvas: getComputedStyle(document.documentElement)
                            .getPropertyValue("--color-kumo-canvas")
                            .trim(),
                        background: getComputedStyle(document.body).backgroundColor,
                    }
                })
                expect(
                    geometry.scrollWidth,
                    `${route}/${mode}/${width} overflow`,
                ).toBeLessThanOrEqual(width)
                expect(geometry.topbar.height).toBe(SHELL.topbarHeight)
                expect(geometry.sidebar.width).toBe(SHELL.sidebarWidth)
                expect(geometry.gutter).toBe(width < BREAKPOINTS.gutter ? "16px" : "32px")
                expect(geometry.columns).toBe(
                    width < BREAKPOINTS.gutter
                        ? 1
                        : width < BREAKPOINTS.wide || route === "server"
                          ? 2
                          : 5,
                )
                expect(geometry.mode).toBe(mode)
                expect(geometry.canvas).not.toBe("")
                expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)")
                if (desktop) expect(geometry.topbar.x).toBe(SHELL.sidebarWidth)
                if (geometry.aside) {
                    if (width >= BREAKPOINTS.aside) {
                        expect(geometry.aside.width).toBe(SHELL.asideWidth)
                        expect(geometry.aside.x).toBeCloseTo(geometry.mainTrack.right)
                    } else
                        expect(geometry.aside.y).toBeGreaterThanOrEqual(geometry.mainTrack.bottom)
                }
                for (const name of ["Search", "Change theme", "Language", "Log in"]) {
                    const action = page.getByRole("button", { name, exact: true })
                    await expect(action).toBeVisible()
                    const bounds = await action.boundingBox()
                    expect(bounds!.x).toBeGreaterThanOrEqual(0)
                    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
                }
                if (evidence)
                    await page.screenshot({
                        path: join(evidence, "shots", `${route}-${mode}-${width}.png`),
                        fullPage: true,
                    })
                checks.push({ route, width, ...geometry })
            }
        }
    }
    if (evidence)
        await writeFile(
            join(evidence, "shell-checks.json"),
            JSON.stringify({ checks, errors }, null, 2),
        )
    expect(errors).toEqual([])
})

test("drawer contains focus, closes with Escape, restores focus, and preserves desktop preference", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/demo")
    await page.getByRole("button", { name: "Collapse navigation", exact: true }).click()
    await expect
        .poll(() => page.locator(".nk-sidebar").evaluate((el) => el.getBoundingClientRect().width))
        .toBe(SHELL.sidebarRailWidth)
    await page.reload()
    await expect
        .poll(() => page.locator(".nk-sidebar").evaluate((el) => el.getBoundingClientRect().width))
        .toBe(SHELL.sidebarRailWidth)
    await page.setViewportSize({ width: 375, height: 900 })
    const trigger = page.getByRole("button", { name: "Open navigation", exact: true })
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator(".nk-shell-body")).toHaveAttribute("inert", "")
    await expect(page.getByRole("link", { name: /^All servers/ })).toBeVisible()
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab")
        expect(
            await page.locator(".nk-sidebar").evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true)
    }
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
    await expect(page.locator(".nk-shell-body")).not.toHaveAttribute("inert", "")
    await trigger.click()
    await page.getByRole("button", { name: "Close navigation", exact: true }).click()
    await expect(trigger).toBeFocused()
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect
        .poll(() => page.locator(".nk-sidebar").evaluate((el) => el.getBoundingClientRect().width))
        .toBe(SHELL.sidebarRailWidth)
    await page.getByRole("button", { name: "Expand navigation", exact: true }).click()
    await page.getByRole("button", { name: "Regions", exact: true }).click()
    await expect(page.getByRole("link", { name: "Asia Pacific", exact: true })).toBeVisible()
})

test("context navigation, scrolling tabs, maxWidth and blocked storage", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/demo/server")
    await page.getByRole("button", { name: "Open navigation", exact: true }).click()
    await page.getByRole("link", { name: "All servers", exact: true }).click()
    await expect(page).toHaveURL(/\/demo$/)
    await expect(page.getByRole("heading", { name: /^All servers/ })).toBeVisible()
    await page.getByRole("tab", { name: "Uptime & report history", exact: true }).click()
    await expect(
        page.getByRole("heading", { name: "Uptime & report history", exact: true }),
    ).toBeVisible()
    await page.setViewportSize({ width: 1920, height: 900 })
    expect(
        await page.locator(".nk-page-content").evaluate((el) => el.getBoundingClientRect().width),
    ).toBe(1200)
    await page.goto("/demo/server")
    expect(
        await page.locator(".nk-page-content").evaluate((el) => el.getBoundingClientRect().width),
    ).toBe(1100)
    await page.addInitScript(() =>
        Object.defineProperty(window, "localStorage", {
            get() {
                throw new DOMException("Blocked", "SecurityError")
            },
        }),
    )
    await page.reload()
    await expect(
        page.getByRole("heading", { name: "Singapore Gateway", exact: true }),
    ).toBeVisible()
})
