import { type Browser, type Page, chromium, expect, test, webkit } from "@playwright/test"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { type ViteDevServer, createServer } from "vite"

import { mockNezha } from "./mock"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const adminDir = path.resolve(__dirname, "../../admin")

const WIDTHS = [375, 768, 867, 952, 1440] as const

type RectSnap = {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
}

type ShellState = {
    docScrollHeight: number
    bodyScrollHeight: number
    innerHeight: number
    scrollY: number
    mainScrollTop: number
    mainMaxScroll: number
    positions: { sidebar: string; topbar: string }
    topbar: RectSnap
    sidebar: RectSnap | null
    footer: RectSnap | null
}

async function mockAdmin(page: Page, { loggedIn = true }: { loggedIn?: boolean } = {}) {
    const adminServers = Array.from({ length: 24 }, (_, i) => ({
        id: i + 1,
        name: `Prod Node ${String(i + 1).padStart(2, "0")} (${["HKG", "TYO", "SIN", "LAX"][i % 4]})`,
        uuid: `uuid-${i + 1}`,
        note: i % 3 === 0 ? "Primary cluster" : "",
        public_note: "",
        display_index: 100 - i,
        hide_for_guest: i % 5 === 0,
        enable_ddns: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-11-17T00:00:00Z",
        last_active: "2026-11-17T06:00:00Z",
        ipv4: `203.0.113.${i + 10}`,
        ipv6: "",
        host: {
            platform: "debian",
            platform_version: "12",
            arch: "x86_64",
            version: "1.14.2",
            country_code: ["hk", "jp", "sg", "us"][i % 4],
        },
        state: { cpu: 15 + i },
    }))
    const onlineUsers = Array.from({ length: 25 }, (_, i) => ({
        user_id: i + 1,
        connected_at: "2026-11-17T06:00:00Z",
        ip: `198.51.100.${i + 1}`,
    }))

    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url())
        const p = url.pathname
        if (p.endsWith("/profile")) {
            return loggedIn
                ? route.fulfill({
                      json: {
                          success: true,
                          data: { id: 1, username: "admin", role: 0 },
                      },
                  })
                : route.fulfill({
                      status: 401,
                      json: { success: false, error: "unauthorized" },
                  })
        }
        if (p.endsWith("/setting")) {
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        config: {
                            site_name: "哪吒监控",
                            language: "zh-CN",
                            install_host: "dash.example.com:8008",
                            tls: true,
                            cover: 1,
                            online_stats_days: 7,
                            user_template: "user-dist",
                            oauth2_providers: ["GitHub", "Google", "GitLab", "Cloudflare"],
                        },
                        frontend_templates: [
                            {
                                path: "user-dist",
                                name: "Default",
                                is_admin: false,
                                is_official: true,
                            },
                        ],
                        version: "2.6.1",
                    },
                },
            })
        }
        if (p.endsWith("/server-group")) {
            return route.fulfill({
                json: {
                    success: true,
                    data: [
                        { group: { id: 1, name: "Asia" }, servers: [1, 2, 3, 4] },
                        { group: { id: 2, name: "US" }, servers: [5, 6] },
                    ],
                },
            })
        }
        if (p.endsWith("/server")) {
            return route.fulfill({ json: { success: true, data: adminServers } })
        }
        if (p.endsWith("/online-user")) {
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        value: onlineUsers,
                        pagination: { offset: 0, limit: 25, total: 50 },
                    },
                },
            })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
}

async function readShellState(page: Page, desktop: boolean): Promise<ShellState> {
    return page.evaluate((isDesktop) => {
        const snap = (selector: string): RectSnap | null => {
            const el = document.querySelector(selector)
            if (!el) return null
            const r = el.getBoundingClientRect()
            return {
                top: Math.round(r.top * 100) / 100,
                bottom: Math.round(r.bottom * 100) / 100,
                left: Math.round(r.left * 100) / 100,
                right: Math.round(r.right * 100) / 100,
                width: Math.round(r.width * 100) / 100,
                height: Math.round(r.height * 100) / 100,
            }
        }
        const main = document.querySelector<HTMLElement>(".nk-main")!
        const sidebarEl = document.querySelector<HTMLElement>(".nk-sidebar")!
        const topbarEl = document.querySelector<HTMLElement>(".nk-topbar")!
        return {
            docScrollHeight: document.documentElement.scrollHeight,
            bodyScrollHeight: document.body.scrollHeight,
            innerHeight: window.innerHeight,
            scrollY: window.scrollY,
            mainScrollTop: Math.round(main.scrollTop),
            mainMaxScroll: Math.round(main.scrollHeight - main.clientHeight),
            positions: {
                sidebar: getComputedStyle(sidebarEl).position,
                topbar: getComputedStyle(topbarEl).position,
            },
            topbar: snap(".nk-topbar")!,
            sidebar: isDesktop ? snap('.nk-sidebar [data-sidebar="content-container"]') : null,
            footer: isDesktop ? snap(".nk-sidebar-footer") : null,
        }
    }, desktop)
}

async function setShellViewport(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height })
    const sidebar = page.locator(".nk-sidebar")
    if (width >= 768) {
        await expect(sidebar).not.toHaveAttribute("data-mobile")
    } else {
        await expect(sidebar).toHaveAttribute("data-mobile", /.*/)
    }
    await page.evaluate(
        () =>
            new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    )
}

async function assertPinnedAcrossMainScroll(page: Page, width: number, label: string) {
    const desktop = width >= 768
    await page.evaluate(() => {
        document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 0
    })
    const before = await readShellState(page, desktop)

    expect(
        before.docScrollHeight,
        `${label}: html scrollHeight <= innerHeight`,
    ).toBeLessThanOrEqual(before.innerHeight)
    expect(
        before.bodyScrollHeight,
        `${label}: body scrollHeight <= innerHeight`,
    ).toBeLessThanOrEqual(before.innerHeight)
    expect(before.scrollY, `${label}: window.scrollY at top`).toBe(0)
    expect(before.positions.topbar, `${label}: topbar is ordinary flex item`).not.toMatch(
        /^(fixed|sticky)$/,
    )
    if (desktop) {
        expect(before.positions.sidebar, `${label}: desktop sidebar not sticky/fixed`).not.toMatch(
            /^(fixed|sticky)$/,
        )
        expect(before.sidebar, `${label}: sidebar spans viewport height`).toMatchObject({
            top: 0,
            bottom: before.innerHeight,
            left: 0,
        })
        expect(before.footer?.bottom, `${label}: sidebar footer pinned at bottom`).toBe(
            before.innerHeight,
        )
        expect(before.topbar.top, `${label}: desktop topbar top`).toBe(0)
    } else {
        expect(before.topbar, `${label}: drawer topbar full width`).toMatchObject({
            top: 0,
            left: 0,
            width,
        })
    }
    expect(before.mainMaxScroll, `${label}: main must overflow vertically`).toBeGreaterThan(60)

    // Scroll .nk-main to middle
    const midTarget = Math.max(25, Math.floor(before.mainMaxScroll / 2))
    await page.evaluate((y) => {
        document.querySelector<HTMLElement>(".nk-main")!.scrollTop = y
    }, midTarget)
    const mid = await readShellState(page, desktop)
    expect(mid.mainScrollTop, `${label}: scrolled to middle`).toBeGreaterThan(0)
    expect(mid.scrollY, `${label}: window.scrollY at middle`).toBe(0)
    expect(mid.docScrollHeight, `${label}: html scrollHeight at middle`).toBeLessThanOrEqual(
        mid.innerHeight,
    )
    expect(mid.bodyScrollHeight, `${label}: body scrollHeight at middle`).toBeLessThanOrEqual(
        mid.innerHeight,
    )
    expect(mid.topbar, `${label}: topbar rect unchanged at middle`).toEqual(before.topbar)
    if (desktop) {
        expect(mid.sidebar, `${label}: sidebar rect unchanged at middle`).toEqual(before.sidebar)
        expect(mid.footer, `${label}: footer rect unchanged at middle`).toEqual(before.footer)
    }

    // Scroll .nk-main to bottom
    await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>(".nk-main")!
        main.scrollTop = main.scrollHeight
    })
    const bottom = await readShellState(page, desktop)
    expect(bottom.mainScrollTop, `${label}: scrolled to bottom`).toBeGreaterThan(mid.mainScrollTop)
    expect(
        Math.abs(bottom.mainScrollTop - bottom.mainMaxScroll),
        `${label}: at maxScroll`,
    ).toBeLessThanOrEqual(2)
    expect(bottom.scrollY, `${label}: window.scrollY at bottom`).toBe(0)
    expect(bottom.topbar, `${label}: topbar rect unchanged at bottom`).toEqual(before.topbar)
    if (desktop) {
        expect(bottom.sidebar, `${label}: sidebar rect unchanged at bottom`).toEqual(before.sidebar)
        expect(bottom.footer, `${label}: footer rect unchanged at bottom`).toEqual(before.footer)
    }
}

test.describe("AppShell scroll container invariants and behaviors", () => {
    let adminServer: ViteDevServer
    let adminBase = ""
    let chromiumBrowser: Browser
    let webkitBrowser: Browser

    test.beforeAll(async () => {
        adminServer = await createServer({
            root: adminDir,
            configFile: path.join(adminDir, "vite.config.ts"),
            server: { host: "127.0.0.1", port: 0, strictPort: false },
            logLevel: "silent",
        })
        await adminServer.listen()
        const addr = adminServer.httpServer!.address()
        const port = typeof addr === "object" && addr ? addr.port : 0
        adminBase = `http://127.0.0.1:${port}`
        chromiumBrowser = await chromium.launch()
        webkitBrowser = await webkit.launch()
    })

    test.afterAll(async () => {
        await Promise.allSettled([
            chromiumBrowser?.close(),
            webkitBrowser?.close(),
            adminServer?.close(),
        ])
    })

    for (const engineName of ["chromium", "webkit"] as const) {
        test(`${engineName}: 8 AppShell pages × 5 widths keep document unscrollable and shell pinned`, async ({
            baseURL,
        }) => {
            test.setTimeout(120_000)
            const browser = engineName === "chromium" ? chromiumBrowser : webkitBrowser
            const feBase = baseURL!

            // Frontend pages (Home + NodePage 4 tabs)
            const feContext = await browser.newContext({
                viewport: { width: 1440, height: 360 },
                reducedMotion: "reduce",
            })
            const fePage = await feContext.newPage()
            await mockNezha(fePage)
            await fePage.addInitScript(() => {
                localStorage.setItem("nkt:sidebar-collapsed", "false")
            })

            const feTargets = [
                { name: "fe-home", path: "/", waitSel: "[data-server]" },
                { name: "fe-node-overview", path: "/server/6", waitSel: ".info-section" },
                { name: "fe-node-load", path: "/server/6#load", waitSel: ".chart svg" },
                {
                    name: "fe-node-latency",
                    path: "/server/6#latency",
                    waitSel: ".node-ping-list button",
                },
                { name: "fe-node-history", path: "/server/6#history", waitSel: ".chart-card" },
            ]

            for (const target of feTargets) {
                await fePage.goto(feBase + target.path)
                await expect(fePage.locator(target.waitSel).first()).toBeVisible()
                for (const width of WIDTHS) {
                    await setShellViewport(fePage, width, 360)
                    await expect(fePage.locator(target.waitSel).first()).toBeVisible()
                    await assertPinnedAcrossMainScroll(
                        fePage,
                        width,
                        `${engineName} ${target.name} @${width}`,
                    )
                }
            }
            await feContext.close()

            // Admin pages (Server, Settings, OnlineUser)
            const adminContext = await browser.newContext({
                viewport: { width: 1440, height: 360 },
                reducedMotion: "reduce",
            })
            const adminPage = await adminContext.newPage()
            await mockAdmin(adminPage)
            await adminPage.addInitScript(() => {
                localStorage.setItem("nkt:sidebar-collapsed", "false")
                localStorage.setItem("language", "zh-CN")
            })

            const adminTargets = [
                {
                    name: "admin-server",
                    path: "/dashboard",
                    waitSel: "table tbody tr:nth-child(5)",
                },
                {
                    name: "admin-settings",
                    path: "/dashboard/settings",
                    waitSel: 'form input[name="site_name"]',
                },
                {
                    name: "admin-online-user",
                    path: "/dashboard/settings/online-user",
                    waitSel: "table tbody tr:nth-child(5)",
                },
            ]

            for (const target of adminTargets) {
                await adminPage.goto(adminBase + target.path)
                await expect(adminPage.locator(target.waitSel).first()).toBeVisible()
                for (const width of WIDTHS) {
                    await setShellViewport(adminPage, width, 360)
                    await expect(adminPage.locator(target.waitSel).first()).toBeVisible()
                    await assertPinnedAcrossMainScroll(
                        adminPage,
                        width,
                        `${engineName} ${target.name} @${width}`,
                    )
                }
            }
            await adminContext.close()
        })

        test(`${engineName}: foldable screen-switch flows (375↔952) and collapsed desktop sidebar`, async ({
            baseURL,
        }) => {
            test.setTimeout(90_000)
            const browser = engineName === "chromium" ? chromiumBrowser : webkitBrowser
            const feBase = baseURL!

            // 1. Outer (375×667, dpr 3, touch) → open/close drawer → unfold to Inner (952×670) without reload
            for (const app of ["fe", "admin"] as const) {
                const ctx = await browser.newContext({
                    viewport: { width: 375, height: 667 },
                    deviceScaleFactor: 3,
                    hasTouch: true,
                    reducedMotion: "reduce",
                })
                const p = await ctx.newPage()
                if (app === "fe") {
                    await mockNezha(p)
                    await p.goto(feBase + "/")
                    await expect(p.locator("[data-server]").first()).toBeVisible()
                } else {
                    await mockAdmin(p)
                    await p.goto(adminBase + "/dashboard")
                    await expect(p.locator("table tbody tr").first()).toBeVisible()
                }

                const openBtn = p.locator(".nk-topbar button").first()
                await expect(openBtn).toHaveAttribute("aria-expanded", "false")
                await openBtn.click()
                await expect(openBtn).toHaveAttribute("aria-expanded", "true")
                await p.keyboard.press("Escape")
                await expect(openBtn).toHaveAttribute("aria-expanded", "false")

                await setShellViewport(p, 952, 420)
                await assertPinnedAcrossMainScroll(p, 952, `${engineName} ${app} 375->952 unfolded`)
                await ctx.close()
            }

            // 2. Reverse: Inner (952×670) → fold to Outer (375×667) → open/close drawer → scroll
            for (const app of ["fe", "admin"] as const) {
                const ctx = await browser.newContext({
                    viewport: { width: 952, height: 420 },
                    deviceScaleFactor: 2,
                    hasTouch: true,
                    reducedMotion: "reduce",
                })
                const p = await ctx.newPage()
                if (app === "fe") {
                    await mockNezha(p)
                    await p.goto(feBase + "/")
                    await expect(p.locator("[data-server]").first()).toBeVisible()
                } else {
                    await mockAdmin(p)
                    await p.goto(adminBase + "/dashboard")
                    await expect(p.locator("table tbody tr").first()).toBeVisible()
                }

                await assertPinnedAcrossMainScroll(p, 952, `${engineName} ${app} 952 initial`)
                await setShellViewport(p, 375, 420)
                const openBtn = p.locator(".nk-topbar button").first()
                await openBtn.click()
                await expect(openBtn).toHaveAttribute("aria-expanded", "true")
                await p.keyboard.press("Escape")
                await expect(openBtn).toHaveAttribute("aria-expanded", "false")

                await assertPinnedAcrossMainScroll(p, 375, `${engineName} ${app} 952->375 folded`)
                await ctx.close()
            }

            // 3. Collapsed desktop sidebar (Kumo fixed 57px rail) + direct document scroll attempts + non-AppShell login page
            const ctx = await browser.newContext({
                viewport: { width: 952, height: 420 },
                reducedMotion: "reduce",
            })
            const p = await ctx.newPage()
            await mockNezha(p)
            await p.goto(feBase + "/")
            await expect(p.locator("[data-server]").first()).toBeVisible()

            // Direct document scroll & wheel over sidebar / topbar keep window.scrollY === 0
            await p.evaluate(() => {
                window.scrollTo(0, 500)
                document.documentElement.scrollTop = 500
                document.body.scrollTop = 500
            })
            expect(await p.evaluate(() => window.scrollY)).toBe(0)
            await p.mouse.move(100, 20)
            await p.mouse.wheel(0, 400)
            await p.mouse.move(450, 25)
            await p.mouse.wheel(0, 400)
            expect(await p.evaluate(() => window.scrollY)).toBe(0)

            // Collapse desktop sidebar and scroll .nk-main
            await p.locator(".nk-sidebar-footer button").first().click()
            await expect.poll(async () => (await readShellState(p, true)).topbar.left).toBe(57)
            const collapsedBefore = await readShellState(p, true)
            expect(collapsedBefore.sidebar).toMatchObject({
                top: 0,
                bottom: collapsedBefore.innerHeight,
            })
            await p.evaluate(() => {
                document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 300
            })
            const collapsedAfter = await readShellState(p, true)
            expect(collapsedAfter.mainScrollTop).toBeGreaterThan(100)
            expect(collapsedAfter.scrollY).toBe(0)
            expect(collapsedAfter.topbar).toEqual(collapsedBefore.topbar)
            expect(collapsedAfter.sidebar).toEqual(collapsedBefore.sidebar)
            expect(collapsedAfter.footer).toEqual(collapsedBefore.footer)
            await ctx.close()

            // 4. Non-AppShell admin login page (/dashboard/login) at 375×400 scrolls via document
            const loginCtx = await browser.newContext({
                viewport: { width: 375, height: 400 },
                reducedMotion: "reduce",
            })
            const loginPage = await loginCtx.newPage()
            await mockAdmin(loginPage, { loggedIn: false })
            await loginPage.goto(adminBase + "/dashboard/login")
            const submitBtn = loginPage.locator('button[type="submit"]')
            await expect(submitBtn).toBeVisible()
            await expect(loginPage.locator(".nk-shell")).toHaveCount(0)
            const loginScroll = await loginPage.evaluate(() => {
                const max = document.documentElement.scrollHeight - window.innerHeight
                window.scrollTo(0, max)
                const btnRect = document
                    .querySelector('button[type="submit"]')!
                    .getBoundingClientRect()
                return {
                    max,
                    scrollY: window.scrollY,
                    submitInView: btnRect.bottom <= window.innerHeight && btnRect.top >= -200,
                }
            })
            expect(loginScroll.max).toBeGreaterThan(50)
            expect(loginScroll.scrollY).toBeGreaterThan(50)
            await loginCtx.close()
        })
    }

    test("router scroll save/restore (enter, back link, goBack/goForward, brand reset, in-page tabs, admin route switch)", async ({
        page,
    }) => {
        await mockNezha(page)
        await page.setViewportSize({ width: 1024, height: 420 })
        await page.goto("/")
        await expect(page.locator("[data-server]").first()).toBeVisible()

        const mainScroll = () =>
            page.evaluate(() =>
                Math.round(document.querySelector<HTMLElement>(".nk-main")!.scrollTop),
            )

        // In-page region tab switch on HomePage does not jump scroll position to 0
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 260
        })
        const homeScrolled = await mainScroll()
        expect(homeScrolled).toBeGreaterThan(200)
        await page.getByRole("tab", { name: /US/ }).click()
        expect(await mainScroll()).toBeGreaterThan(0)
        await page.getByRole("tab", { name: /^All/ }).click()
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 280
        })
        const savedHomeScroll = await mainScroll()
        expect(savedHomeScroll).toBeGreaterThan(220)

        // Enter node page resets .nk-main scroll to 0
        await page.locator('[data-server="6"] a').first().click()
        await expect(page).toHaveURL(/\/server\/6$/)
        await expect(page.locator(".info-section").first()).toBeVisible()
        expect(await mainScroll()).toBe(0)

        // Back link restores HomePage scroll position
        await page.getByRole("link", { name: "Back" }).click()
        await expect(page).toHaveURL(/\/$/)
        await expect.poll(mainScroll).toBeGreaterThanOrEqual(savedHomeScroll - 5)

        // Re-enter node, scroll node page, then Browser Back & Browser Forward both restore positions
        await page.locator('[data-server="6"] a').first().click()
        await expect(page).toHaveURL(/\/server\/6$/)
        await expect(page.locator(".info-section").first()).toBeVisible()
        expect(await mainScroll()).toBe(0)

        // In-page section tab switch on NodePage keeps scroll position (does not reset to 0)
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 40
        })
        expect(await mainScroll()).toBe(40)
        await page.getByRole("tab", { name: "Load", exact: true }).click()
        await expect(page).toHaveURL(/\/server\/6#load$/)
        await expect(page.locator(".chart svg").first()).toBeVisible()
        expect(await mainScroll()).toBe(40)

        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 220
        })
        const savedNodeScroll = await mainScroll()
        expect(savedNodeScroll).toBeGreaterThan(180)

        await page.goBack()
        await expect(page).toHaveURL(/\/$/)
        await expect.poll(mainScroll).toBeGreaterThanOrEqual(savedHomeScroll - 5)

        await page.goForward()
        await expect(page).toHaveURL(/\/server\/6#load$/)
        await expect.poll(mainScroll).toBeGreaterThanOrEqual(savedNodeScroll - 5)

        // Clicking site brand (reset) returns to HomePage at scrollTop 0
        await page.locator(".nk-sidebar .nk-brand a, a.nk-brand").first().click()
        await expect(page).toHaveURL(/\/$/)
        expect(await mainScroll()).toBe(0)

        // Admin route switch resets .nk-main scrollTop to 0
        await page.unrouteAll({ behavior: "ignoreErrors" })
        await mockAdmin(page)
        await page.setViewportSize({ width: 1024, height: 360 })
        await page.goto(adminBase + "/dashboard")
        await expect(page.locator("table tbody tr").nth(5)).toBeVisible()
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 240
        })
        expect(await mainScroll()).toBeGreaterThan(180)
        await page.locator('a[href="/dashboard/settings"]').first().click()
        await expect(page.locator('form input[name="site_name"]')).toBeVisible()
        expect(await mainScroll()).toBe(0)
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 200
        })
        expect(await mainScroll()).toBeGreaterThan(150)
        await page.locator('a[href="/dashboard/settings/online-user"]').first().click()
        await expect(page.locator("table tbody tr").nth(5)).toBeVisible()
        expect(await mainScroll()).toBe(0)
    })

    test("drawer backdrop lock, scrolled overlays (sort menu, search dialog, chart tooltip), and keyboard scrolling", async ({
        baseURL,
    }) => {
        // 1. Mobile drawer lock at 375px (touch + wheel cannot scroll .nk-main behind open drawer)
        const mobileCtx = await chromiumBrowser.newContext({
            viewport: { width: 375, height: 500 },
            hasTouch: true,
            reducedMotion: "reduce",
        })
        const mobilePage = await mobileCtx.newPage()
        await mockNezha(mobilePage)
        await mobilePage.goto(baseURL! + "/")
        await expect(mobilePage.locator("[data-server]").first()).toBeVisible()

        await mobilePage.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 180
        })
        const lockedPos = await mobilePage.evaluate(
            () => document.querySelector<HTMLElement>(".nk-main")!.scrollTop,
        )
        expect(lockedPos).toBe(180)

        const drawerBtn = mobilePage.locator(".nk-topbar button").first()
        await drawerBtn.click()
        await expect(drawerBtn).toHaveAttribute("aria-expanded", "true")
        await expect(mobilePage.locator(".nk-shell-body")).toHaveAttribute("inert", "")

        // Wheel over the backdrop area (x=340 is outside the 280px drawer)
        await mobilePage.mouse.move(340, 260)
        await mobilePage.mouse.wheel(0, 350)
        // Dispatch touch gesture on backdrop & shell body
        await mobilePage.evaluate(() => {
            const backdrop =
                document.querySelector<HTMLElement>("[data-sidebar-backdrop]") ??
                document.querySelector<HTMLElement>(".nk-shell-body")!
            for (const type of ["touchstart", "touchmove", "touchend"]) {
                backdrop.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))
            }
        })
        expect(
            await mobilePage.evaluate(
                () => document.querySelector<HTMLElement>(".nk-main")!.scrollTop,
            ),
        ).toBe(lockedPos)
        expect(await mobilePage.evaluate(() => window.scrollY)).toBe(0)
        await mobileCtx.close()

        // 2. Desktop overlays after scrolling .nk-main + keyboard scrolling
        const desktopCtx = await chromiumBrowser.newContext({
            viewport: { width: 1280, height: 520 },
            reducedMotion: "reduce",
        })
        const page = await desktopCtx.newPage()
        await mockNezha(page)
        await page.goto(baseURL! + "/")
        await expect(page.locator("[data-server]").first()).toBeVisible()

        // Skip link focuses #main-content and PageDown scrolls .nk-main
        await page.keyboard.press("Tab")
        await expect(page.locator(".nk-skip-link")).toBeFocused()
        await page.keyboard.press("Enter")
        expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content")
        await page.keyboard.press("PageDown")
        await expect
            .poll(() =>
                page.evaluate(() => document.querySelector<HTMLElement>(".nk-main")!.scrollTop),
            )
            .toBeGreaterThan(100)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)

        // Reset to 0, click inside .nk-main content, and verify ArrowDown + Space scroll .nk-main
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 0
        })
        await page.locator(".nk-page h1").first().click()
        await page.keyboard.press("ArrowDown")
        await expect
            .poll(() =>
                page.evaluate(() => document.querySelector<HTMLElement>(".nk-main")!.scrollTop),
            )
            .toBeGreaterThan(0)
        const afterArrow = await page.evaluate(
            () => document.querySelector<HTMLElement>(".nk-main")!.scrollTop,
        )
        await page.keyboard.press("Space")
        await expect
            .poll(() =>
                page.evaluate(() => document.querySelector<HTMLElement>(".nk-main")!.scrollTop),
            )
            .toBeGreaterThan(afterArrow)

        // Scroll so .sort-button is near the top of .nk-main, open sort menu, check popup alignment
        await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>(".nk-main")!
            const btn = document.querySelector<HTMLElement>(".sort-button")!
            const delta = btn.getBoundingClientRect().top - main.getBoundingClientRect().top
            main.scrollTop = Math.max(40, Math.round(main.scrollTop + delta - 24))
        })
        const sortScrolled = await page.evaluate(
            () => document.querySelector<HTMLElement>(".nk-main")!.scrollTop,
        )
        expect(sortScrolled).toBeGreaterThan(100)
        const sortBtn = page.locator(".sort-button")
        await sortBtn.click()
        const menu = page.getByRole("menu")
        await expect(menu).toBeVisible()
        const menuDistance = await page.evaluate(() => {
            const b = document.querySelector(".sort-button")!.getBoundingClientRect()
            const m = document.querySelector('[role="menu"]')!.getBoundingClientRect()
            return {
                verticalGap: Math.min(Math.abs(m.top - b.bottom), Math.abs(b.top - m.bottom)),
                horizontalOverlap: Math.min(m.right, b.right) - Math.max(m.left, b.left),
            }
        })
        expect(menuDistance.verticalGap).toBeLessThan(24)
        expect(menuDistance.horizontalOverlap).toBeGreaterThan(20)
        await page.keyboard.press("Escape")

        // Search dialog opens cleanly while .nk-main is scrolled, and wheel outside does not scroll .nk-main
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 260
        })
        const beforeDialogScroll = await page.evaluate(
            () => document.querySelector<HTMLElement>(".nk-main")!.scrollTop,
        )
        await page.keyboard.press("Control+k")
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        const dialogBox = await dialog.boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
        expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(520)
        await page.mouse.move(20, 20)
        await page.mouse.wheel(0, 300)
        expect(
            await page.evaluate(() => document.querySelector<HTMLElement>(".nk-main")!.scrollTop),
        ).toBe(beforeDialogScroll)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        await page.keyboard.press("Escape")

        // Chart hover tooltip on scrolled NodePage #load aligns within hovered chart card
        await page.goto(baseURL! + "/server/6#load")
        await expect(page.locator(".chart svg").nth(2)).toBeVisible()
        await page.evaluate(() => {
            document.querySelector<HTMLElement>(".nk-main")!.scrollTop = 260
        })
        expect(
            await page.evaluate(() => document.querySelector<HTMLElement>(".nk-main")!.scrollTop),
        ).toBeGreaterThan(200)
        const targetChart = page.locator(".chart").nth(2)
        await targetChart.locator("svg").hover({ position: { x: 140, y: 60 } })
        const tooltip = page.locator(".chart-tooltip")
        await expect(tooltip).toBeVisible()
        const chartAlignment = await page.evaluate(() => {
            const c = document.querySelectorAll(".chart")[2]!.getBoundingClientRect()
            const t = document.querySelector(".chart-tooltip")!.getBoundingClientRect()
            return {
                withinVertical: t.top >= c.top - 40 && t.bottom <= c.bottom + 40,
                withinHorizontal: t.left >= c.left - 20 && t.right <= c.right + 20,
            }
        })
        expect(chartAlignment).toEqual({ withinVertical: true, withinHorizontal: true })

        await desktopCtx.close()
    })
})
