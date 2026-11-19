import { type Page, expect, test, webkit } from "@playwright/test"

import frameFixture from "./fixtures/nezha-frame.json" with { type: "json" }
import groups from "./fixtures/nezha-groups.json" with { type: "json" }

const VIEWPORTS = [375, 768, 867, 952, 1000, 1024, 1280, 1440] as const
const REGIONS = ["cn", "sg", "jp", "us", "de", "gb", "hk", "kr", "au", "fr", "ca", "nl"]

async function mockStressNezha(page: Page, { footerNote }: { footerNote?: string } = {}) {
    const metricNow = Math.floor(Date.now() / 30_000) * 30_000
    const servers = structuredClone(frameFixture.servers)
    servers.forEach((s, i) => {
        s.country_code = REGIONS[i % REGIONS.length]
        s.name =
            i === 0
                ? "Tokyo production — Xeon Platinum node"
                : `Server ${String(i + 1).padStart(2, "0")}`
        Object.assign(s, {
            public_note: JSON.stringify({
                billingDataMod: {
                    amount: "USD 12.00",
                    cycle: "Year",
                    endDate: "2031-05-01T00:00:00+08:00",
                    autoRenewal: "1",
                },
                planDataMod: {
                    trafficVol: "1TB/Month",
                    trafficType: "2",
                    bandwidth: "1 Gbps",
                    IPv4: "1",
                    IPv6: "1",
                    networkRoute: "CN2 GIA · 9929 · CMIN2",
                    extra: "Dedicated BGP session",
                },
            }),
        })
        if (s.state && s.host) {
            if (i === 0) {
                s.host.cpu = ["Intel(R) Xeon(R) Platinum 8259CL CPU @ 2.50GHz 2 Physical Core"]
                s.host.mem_total = Math.round(1.93 * 1024 ** 3)
                s.state.mem_used = 1017 * 1024 ** 2
                s.host.disk_total = Math.round(57.8 * 1024 ** 3)
                s.state.disk_used = Math.round(47.9 * 1024 ** 3)
            } else if (i === 1) {
                s.host.cpu = ["AMD EPYC 9654 128 Physical Core"]
                s.host.mem_total = 1023 * 1024 ** 2
                s.state.mem_used = 1017 * 1024 ** 2
                s.host.disk_total = 1023 * 1024 ** 2
                s.state.disk_used = 1017 * 1024 ** 2
            } else {
                s.state.disk_used = Math.round((s.host.disk_total ?? 0) * (i === 2 ? 0.92 : 0.45))
            }
            s.state.cpu = 18 + i
        }
    })

    await page.route("https://api.frankfurter.dev/**", (route) =>
        route.fulfill({
            json: [
                { base: "USD", quote: "CNY", date: "2026-11-16", rate: 7 },
                { base: "USD", quote: "HKD", date: "2026-11-16", rate: 7.8 },
                { base: "USD", quote: "JPY", date: "2026-11-16", rate: 150 },
                { base: "USD", quote: "EUR", date: "2026-11-16", rate: 0.9 },
            ],
        }),
    )
    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url())
        const path = url.pathname
        if (path.endsWith("/profile"))
            return route.fulfill({ status: 401, json: { success: false } })
        if (path.endsWith("/setting"))
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        config: {
                            site_name: "Infrastructure",
                            language: "en",
                            ...(footerNote
                                ? {
                                      custom_code: `<script>window.CustomFooterNote=${JSON.stringify(footerNote)}</script>`,
                                  }
                                : {}),
                        },
                        tsdb_enabled: true,
                    },
                },
            })
        if (path.endsWith("/server-group")) return route.fulfill({ json: groups })
        if (path.endsWith("/service/server"))
            return route.fulfill({ json: { success: true, data: servers.map((s) => s.id) } })
        if (path.endsWith("/metrics")) {
            const metric = url.searchParams.get("metric")
            const start = metricNow - 24 * 3_600_000
            const count = 289
            const data_points = Array.from({ length: count }, (_, i) => {
                const ts = start + (i * 24 * 3_600_000) / (count - 1)
                const wave = 28 + Math.sin(i / 8) * 14
                const value = metric?.includes("speed")
                    ? wave * 1_500_000
                    : metric?.includes("transfer")
                      ? 100 * 1024 ** 3 + i * 20 * 1024 ** 2
                      : wave
                return { ts, value }
            })
            return route.fulfill({ json: { success: true, data: { data_points } } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        const now = Date.now()
        const active = servers.map((s, i) => ({
            ...s,
            last_active: new Date(now - (i === 19 ? 120_000 : 0)).toISOString(),
        }))
        ws.send(JSON.stringify({ now, servers: active }))
    })
}

async function assertNoMeterTruncation(
    page: Page,
    contextLabel: string,
    { requireDetails = true }: { requireDetails?: boolean } = {},
) {
    const report = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(".server-card")).map(
            (c) => c.offsetWidth,
        )
        const details = Array.from(document.querySelectorAll<HTMLElement>(".meter .meter-detail"))
            .filter((el) => el.getClientRects().length > 0)
            .map((el) => ({
                text: el.textContent ?? "",
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
            }))
        const meters = Array.from(document.querySelectorAll<HTMLElement>(".meter"))
            .filter((m) => m.getClientRects().length > 0)
            .map((m) => ({
                scrollWidth: m.scrollWidth,
                clientWidth: m.clientWidth,
            }))
        const netRates = Array.from(
            document.querySelectorAll<HTMLElement>(".server-network .net-rates"),
        )
            .filter((n) => n.getClientRects().length > 0)
            .map((n) => ({
                text: n.textContent ?? "",
                scrollWidth: n.scrollWidth,
                clientWidth: n.clientWidth,
            }))
        const headerOverlaps = Array.from(document.querySelectorAll<HTMLElement>(".meter"))
            .filter((m) => m.getClientRects().length > 0)
            .flatMap((m) => {
                const label = m.querySelector<HTMLElement>(".meter-label")
                const pct = m.querySelector<HTMLElement>(":scope > .num")
                if (!label || !pct || !label.getClientRects().length) return []
                const lr = label.getBoundingClientRect()
                const pr = pct.getBoundingClientRect()
                return lr.right > pr.left + 1 ? [`${label.textContent} > ${pct.textContent}`] : []
            })
        return { cards, details, meters, netRates, headerOverlaps }
    })
    for (const w of report.cards) {
        expect(w, `${contextLabel}: card width >= 320`).toBeGreaterThanOrEqual(320)
    }
    expect(report.headerOverlaps, `${contextLabel}: meter label/pct overlap`).toEqual([])
    expect(report.meters.length, `${contextLabel}: visible meters`).toBeGreaterThan(0)
    for (const m of report.meters) {
        expect(m.scrollWidth, `${contextLabel}: meter overflow`).toBeLessThanOrEqual(
            m.clientWidth + 1,
        )
    }
    for (const n of report.netRates) {
        expect(n.scrollWidth, `${contextLabel}: net-rates "${n.text}"`).toBeLessThanOrEqual(
            n.clientWidth + 1,
        )
    }
    if (requireDetails) {
        expect(report.details.length, `${contextLabel}: visible meter details`).toBeGreaterThan(0)
    }
    for (const d of report.details) {
        expect(
            d.scrollWidth,
            `${contextLabel}: "${d.text}" (${d.scrollWidth} > ${d.clientWidth})`,
        ).toBeLessThanOrEqual(d.clientWidth)
    }
}

async function assertNodeOverviewWrapping(page: Page, contextLabel: string) {
    const check = async (sub?: "system" | "network") => {
        if (sub) {
            const tab = page.locator(`.node-subtabs [role="tab"]`).nth(sub === "system" ? 0 : 1)
            if (await tab.isVisible()) await tab.click()
        }
        const metrics = await page.evaluate(() => {
            const dts = Array.from(document.querySelectorAll<HTMLElement>(".info-section dt"))
                .filter((el) => el.getClientRects().length > 0)
                .map((el) => {
                    const lh = Number.parseFloat(getComputedStyle(el).lineHeight) || 20
                    return {
                        text: el.textContent ?? "",
                        height: el.getBoundingClientRect().height,
                        lineHeight: lh,
                    }
                })
            const dds = Array.from(document.querySelectorAll<HTMLElement>(".info-section dd"))
                .filter((el) => el.getClientRects().length > 0)
                .map((el) => {
                    const text = (el.textContent ?? "").trim()
                    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
                    const lineMap = new Map<number, string>()
                    let node = walker.nextNode()
                    while (node) {
                        const raw = node.textContent ?? ""
                        const range = document.createRange()
                        for (let i = 0; i < raw.length; i++) {
                            const ch = raw[i]!
                            if (/\s/.test(ch)) continue
                            range.setStart(node, i)
                            range.setEnd(node, i + 1)
                            const rect = range.getClientRects()[0]
                            if (!rect) continue
                            const key =
                                [...lineMap.keys()].find((y) => Math.abs(y - rect.top) < 6) ??
                                rect.top
                            lineMap.set(key, (lineMap.get(key) ?? "") + ch)
                        }
                        node = walker.nextNode()
                    }
                    const lines = [...lineMap.entries()]
                        .sort((a, b) => a[0] - b[0])
                        .map(([, chars]) => chars)
                    return { text, lines }
                })
            return { dts, dds }
        })
        expect(metrics.dts.length, `${contextLabel} ${sub ?? ""}: visible dt`).toBeGreaterThan(0)
        for (const dt of metrics.dts) {
            expect(
                dt.height,
                `${contextLabel}: dt "${dt.text}" wrapped (${dt.height}px vs lh ${dt.lineHeight}px)`,
            ).toBeLessThanOrEqual(dt.lineHeight * 1.45)
        }
        for (const dd of metrics.dds) {
            if (dd.lines.length > 1) {
                const lastLine = dd.lines.at(-1) ?? ""
                expect(
                    lastLine.length,
                    `${contextLabel}: orphan tail "${lastLine}" in dd "${dd.text}" (${JSON.stringify(dd.lines)})`,
                ).toBeGreaterThanOrEqual(2)
            }
        }
    }
    await check("system")
    await check("network")
}

test.describe("Layout polish (fe2)", () => {
    test("Goal 1: meter usage strings never truncate across 8 viewports × sidebar states, compact list, and scrolled state", async ({
        page,
    }) => {
        await mockStressNezha(page)
        await page.addInitScript(() => {
            localStorage.setItem("nkt:language", "en")
        })

        for (const width of VIEWPORTS) {
            await page.setViewportSize({ width, height: 900 })
            const states = width < 768 ? ["drawer"] : ["expanded", "collapsed"]
            for (const state of states) {
                await page.goto("/")
                await expect(page.locator('.server-card[data-server="6"]')).toContainText(
                    "1017 MB / 1.93 GB",
                )
                await expect(page.locator('.server-card[data-server="25"]')).toContainText(
                    "1017 MB / 1023 MB",
                )
                if (state === "collapsed") {
                    const collapseBtn = page.getByRole("button", { name: "Collapse navigation" })
                    if (await collapseBtn.isVisible()) await collapseBtn.click()
                    await expect(page.locator("aside.nk-sidebar")).toHaveAttribute(
                        "data-state",
                        "collapsed",
                    )
                } else if (state === "expanded") {
                    const expandBtn = page.getByRole("button", { name: "Expand navigation" })
                    if (await expandBtn.isVisible()) await expandBtn.click()
                    await expect(page.locator("aside.nk-sidebar")).toHaveAttribute(
                        "data-state",
                        "expanded",
                    )
                }

                await assertNoMeterTruncation(page, `cards ${width}px ${state} top`)

                // Also verify after scrolling down (scrollTop > 0)
                await page.evaluate(() => {
                    document.querySelector(".nk-main")!.scrollTop = 320
                })
                const scrollTop = await page.evaluate(
                    () => document.querySelector(".nk-main")!.scrollTop,
                )
                expect(
                    scrollTop,
                    `${width}px ${state}: expected scrollable content area`,
                ).toBeGreaterThan(0)
                await assertNoMeterTruncation(page, `cards ${width}px ${state} scrolled`)
            }
        }

        // Compact table view check across narrow, foldable, and wide widths
        for (const width of [375, 867, 1000, 1440] as const) {
            await page.setViewportSize({ width, height: 900 })
            await page.evaluate(() => {
                localStorage.setItem("nkt:sidebar-collapsed", "false")
                localStorage.setItem("nkt:view", JSON.stringify("compact"))
            })
            await page.goto("/")
            await expect(page.locator(".fleet-table")).toBeVisible()
            await assertNoMeterTruncation(page, `compact ${width}px`, { requireDetails: false })
        }
    })

    test("Goal 2: node overview labels stay single-line and values wrap without orphan characters across 375–1440", async ({
        page,
    }) => {
        await mockStressNezha(page)
        for (const lang of ["zh-CN", "en"] as const) {
            await page.goto("/")
            await page.evaluate((l) => {
                localStorage.setItem("nkt:language", l)
                localStorage.setItem("nkt:sidebar-collapsed", "false")
            }, lang)
            await page.goto("/server/6")
            await expect(page.locator(".info-section").first()).toBeVisible()
            if (lang === "zh-CN") {
                await expect(page.locator(".node-info-grid")).toContainText("峰值速度（24 小时）")
            }

            for (const width of VIEWPORTS) {
                await page.setViewportSize({ width, height: 900 })
                if (width < 768) await expect(page.locator(".nk-drawer-trigger")).toBeVisible()
                else await expect(page.locator("aside.nk-sidebar")).toBeVisible()
                await assertNoMeterTruncation(page, `node strip ${lang} ${width}px`)
                await assertNodeOverviewWrapping(page, `node ${lang} ${width}px`)
            }

            await page.setViewportSize({ width: 768, height: 640 })
            await page.evaluate(() => {
                document.querySelector(".nk-main")!.scrollTop = 260
            })
            expect(
                await page.evaluate(() => document.querySelector(".nk-main")!.scrollTop),
            ).toBeGreaterThan(0)
            await assertNodeOverviewWrapping(page, `node ${lang} 768px scrolled`)
        }
    })

    test("Goals 3 & 6: online tile spark clearance/alignment and consistent HomePage/NodePage footer", async ({
        page,
    }) => {
        await mockStressNezha(page)
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/")
        await expect(page.locator(".status-trigger")).toBeVisible()

        const tileMetrics = await page.evaluate(() => {
            const trigger = document.querySelector<HTMLElement>(".status-trigger")!
            const onlineTile = trigger.closest<HTMLElement>(".metric-tile")!
            // the spark is a line once it has two points, and the "No data" pill before that
            const strokePath = onlineTile.querySelector<Element>(
                ".spark path[stroke], .spark .chart-empty-label",
            )!
            const sparks = Array.from(
                document.querySelectorAll<Element>(".metric-grid .metric-tile .spark"),
            )
            return {
                gapToStroke:
                    strokePath.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
                sparkBottoms: sparks.map((s) => Math.round(s.getBoundingClientRect().bottom)),
            }
        })
        expect(tileMetrics.gapToStroke).toBeGreaterThanOrEqual(14)
        expect(tileMetrics.sparkBottoms).toHaveLength(4)
        for (const b of tileMetrics.sparkBottoms) {
            expect(Math.abs(b - tileMetrics.sparkBottoms[0]!)).toBeLessThanOrEqual(1)
        }

        const homeFootnote = page.locator(".page-footnote")
        await homeFootnote.scrollIntoViewIfNeeded()
        await expect(homeFootnote).toContainText("Powered by Nezha · Kumo theme")

        await page.goto("/server/6")
        const nodeFootnote = page.locator(".page-footnote")
        await nodeFootnote.scrollIntoViewIfNeeded()
        await expect(nodeFootnote).toContainText("Powered by Nezha · Kumo theme")
        await expect(nodeFootnote.getByRole("link", { name: "Nezha" })).toHaveAttribute(
            "href",
            "https://github.com/nezhahq/nezha",
        )
        const themeLink = nodeFootnote.getByRole("link", { name: "Kumo theme" })
        await expect(themeLink).toHaveAttribute(
            "href",
            "https://github.com/zhdsmy/nezha-kumo-theme",
        )
        await expect(themeLink).toHaveAttribute("target", "_blank")
    })

    test("footer note is added below the credits", async ({ page }) => {
        await page.addInitScript(() => {
            ;(window as { NezhaKumoConfig?: unknown }).NezhaKumoConfig = {
                footerNote: "Hosted note",
            }
        })
        await mockStressNezha(page)
        await page.goto("/")
        const footnote = page.locator(".page-footnote")
        await footnote.scrollIntoViewIfNeeded()
        await expect(footnote.locator("p")).toHaveText([
            /Powered by Nezha · Kumo theme$/,
            "Hosted note",
        ])
    })

    test("Goal 4: focus-visible ring matches Kumo brand ring across links, triggers, buttons, and search dialog in light & dark modes", async ({
        page,
    }) => {
        await mockStressNezha(page)
        await page.setViewportSize({ width: 1440, height: 900 })

        for (const appearance of ["light", "dark"] as const) {
            await page.goto("/")
            await expect(page.locator(".status-trigger")).toBeVisible()
            await page.evaluate((mode) => {
                localStorage.setItem("nkt:appearance", mode)
                document.documentElement.dataset.mode = mode
                document.documentElement.style.colorScheme = mode
            }, appearance)

            // Activate keyboard focus-visible modality via Tab
            await page.keyboard.press("Tab")
            const skipRing = await page.locator(".nk-skip-link").evaluate((el) => {
                const cs = getComputedStyle(el)
                return { boxShadow: cs.boxShadow, outlineStyle: cs.outlineStyle }
            })
            expect(skipRing.boxShadow).not.toBe("none")

            const buttonRing = await page.evaluate(() => {
                const btn = document.querySelector<HTMLElement>(".sort-button")!
                btn.focus()
                return getComputedStyle(btn).boxShadow
            })
            expect(buttonRing).toContain(skipRing.boxShadow)

            for (const selector of [".nk-sidebar .nk-nav-link", ".card-name", ".status-trigger"]) {
                const shadow = await page.evaluate((sel) => {
                    const el = document.querySelector<HTMLElement>(sel)!
                    el.focus()
                    return getComputedStyle(el).boxShadow
                }, selector)
                expect(shadow, `${appearance} ${selector} ring`).toBe(skipRing.boxShadow)
            }

            // Open search dialog and verify CommandPalette input ring and .search-result clearance inside .search-results
            await page.keyboard.press("ControlOrMeta+k")
            const result = page.locator(".search-result").first()
            await expect(result).toBeVisible()
            await expect(result).toHaveAttribute("data-highlighted", "")
            const searchCheck = await page.evaluate(() => {
                const container = document.querySelector<HTMLElement>(".search-results")!
                const item = container.querySelector<HTMLElement>(".search-result")!
                const closeBtn = document.querySelector<HTMLElement>(".dialog-close-btn")!
                closeBtn.focus()
                const cRect = container.getBoundingClientRect()
                const iRect = item.getBoundingClientRect()
                return {
                    boxShadow: getComputedStyle(closeBtn).boxShadow,
                    leftClearance: iRect.left - cRect.left,
                    rightClearance: cRect.right - iRect.right,
                    topClearance: iRect.top - cRect.top,
                }
            })
            expect(searchCheck.boxShadow).toContain(skipRing.boxShadow)
            expect(searchCheck.leftClearance).toBeGreaterThanOrEqual(2)
            expect(searchCheck.rightClearance).toBeGreaterThanOrEqual(2)
            expect(searchCheck.topClearance).toBeGreaterThanOrEqual(2)
            await page.keyboard.press("Escape")
        }
    })

    test("Goal 5: zh-CN translates shell landmarks, drawer/collapse controls, and Tabs scroll buttons", async ({
        page,
    }) => {
        await mockStressNezha(page)
        await page.addInitScript(() => {
            localStorage.setItem("nkt:language", "zh-CN")
            localStorage.setItem("nkt:sidebar-collapsed", "false")
        })

        await page.setViewportSize({ width: 1000, height: 900 })
        await page.goto("/")
        await expect(page.locator(".nk-skip-link")).toHaveText("跳至正文")
        await expect(
            page.locator('.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) nav'),
        ).toHaveAttribute("aria-label", "主导航")

        const collapseBtn = page.locator('.nk-sidebar-footer [data-sidebar="trigger"]')
        await expect(collapseBtn).toHaveAttribute("aria-label", "收起导航")
        await collapseBtn.click()
        await expect(collapseBtn).toHaveAttribute("aria-label", "展开导航")

        // Narrow viewport so region Tabs overflow and render localized scroll buttons + mobile drawer labels
        await page.setViewportSize({ width: 375, height: 900 })
        const openDrawer = page.locator(".nk-drawer-trigger")
        await expect(openDrawer).toHaveAttribute("aria-label", "打开导航")
        await openDrawer.click()
        const closeDrawer = page.locator('[data-sidebar="close"]')
        await expect(closeDrawer).toHaveAttribute("aria-label", "关闭导航")
        await closeDrawer.click()

        await expect(page.getByRole("button", { name: "向右滚动标签页" })).toBeVisible()
    })

    test("WebKit foldable viewports (867px & 952px, scrolled and zoomed): meter fit, node wrapping, and focus rings", async ({
        baseURL,
    }) => {
        const browser = await webkit.launch()
        try {
            for (const width of [867, 952] as const) {
                const context = await browser.newContext({
                    baseURL,
                    viewport: { width, height: 900 },
                    deviceScaleFactor: 2,
                    reducedMotion: "reduce",
                })
                const page = await context.newPage()
                await mockStressNezha(page)
                await page.addInitScript(() => {
                    localStorage.setItem("nkt:language", "zh-CN")
                    localStorage.setItem("nkt:sidebar-collapsed", "false")
                })

                await page.goto("/")
                await expect(page.locator('.server-card[data-server="6"]')).toContainText(
                    "1017 MB / 1.93 GB",
                )
                await expect(page.locator('.server-card[data-server="25"]')).toContainText(
                    "1017 MB / 1023 MB",
                )
                await assertNoMeterTruncation(page, `webkit ${width}px top`)

                await page.evaluate(() => {
                    document.querySelector(".nk-main")!.scrollTop = 300
                })
                expect(
                    await page.evaluate(() => document.querySelector(".nk-main")!.scrollTop),
                ).toBeGreaterThan(0)
                await assertNoMeterTruncation(page, `webkit ${width}px scrolled`)

                // Activate keyboard focus-visible modality in WebKit and compare focus rings
                await page.keyboard.press("Tab")
                const rings = await page.evaluate(() => {
                    const btn = document.querySelector<HTMLElement>(".sort-button")!
                    btn.focus()
                    const btnShadow = getComputedStyle(btn).boxShadow
                    const nav = document.querySelector<HTMLElement>(".nk-sidebar .nk-nav-link")!
                    nav.focus()
                    const navShadow = getComputedStyle(nav).boxShadow
                    const card = document.querySelector<HTMLElement>(".card-name")!
                    card.focus()
                    const cardShadow = getComputedStyle(card).boxShadow
                    return { btnShadow, navShadow, cardShadow }
                })
                expect(rings.navShadow).not.toBe("none")
                expect(rings.btnShadow).toContain(rings.navShadow)
                expect(rings.cardShadow).toBe(rings.navShadow)

                // Also verify under foldable ~0.7 CSS zoom on WebKit
                await page.evaluate(() => {
                    document.documentElement.style.zoom = "0.7"
                })
                await assertNoMeterTruncation(page, `webkit ${width}px zoom-0.7`)
                await page.evaluate(() => {
                    document.documentElement.style.zoom = ""
                })

                await page.goto("/server/6")
                await expect(page.locator(".info-section").first()).toBeVisible()
                await assertNodeOverviewWrapping(page, `webkit node ${width}px`)
                await page.evaluate(() => {
                    document.querySelector(".nk-main")!.scrollTop = 220
                })
                await assertNodeOverviewWrapping(page, `webkit node ${width}px scrolled`)

                await context.close()
            }
        } finally {
            await browser.close()
        }
    })
})
