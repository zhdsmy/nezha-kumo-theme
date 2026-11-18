import { chromium, expect, test, webkit } from "@playwright/test"

function attachAdminMock(page: import("@playwright/test").Page, language = "en-US") {
    return page.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname.slice(8)
        const data =
            path === "profile"
                ? { id: 1, role: 0, username: "mock" }
                : path === "setting"
                  ? {
                        config: {
                            site_name: "Mock",
                            language,
                            oauth2_providers: [],
                            custom_code: "",
                            custom_code_dashboard: "",
                        },
                    }
                  : path === "server"
                    ? [
                          {
                              id: 1,
                              name: "Mock server",
                              display_index: 10,
                              host: {},
                              geoip: { ip: { ipv4_addr: "192.0.2.1" } },
                              owner: { username: "mock" },
                              public_note: JSON.stringify({
                                  billingDataMod: {
                                      startDate: "2026-01-15T10:20:00Z",
                                      endDate: "2027-01-15T10:20:00Z",
                                      autoRenewal: "1",
                                      cycle: "Year",
                                      amount: "$49.00",
                                  },
                                  planDataMod: {
                                      bandwidth: "1Gbps",
                                      trafficVol: "2TB/Month",
                                      trafficType: "2",
                                      IPv4: "1",
                                      IPv6: "1",
                                      networkRoute: ["CN2"],
                                      extra: ["BGP"],
                                  },
                              }),
                              note: JSON.stringify({
                                  custom: {
                                      label: "tokyo-edge",
                                      enabled: true,
                                      ports: [443, 8443],
                                      nested: { tier: "gold" },
                                  },
                              }),
                          },
                      ]
                    : []
        await route.fulfill({ json: { success: true, data } })
    })
}

for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    test(`A3: ${engine} keeps DateInput Time and Apply visible inside short viewports (667x375 and 375x340)`, async ({
        baseURL,
    }) => {
        const browser = await driver.launch()
        try {
            if (!baseURL) throw new Error("A local preview baseURL is required")
            for (const viewport of [
                { width: 667, height: 375 },
                { width: 375, height: 340 },
            ]) {
                const page = await browser.newPage({ viewport, locale: "en-US" })
                await page.addInitScript(() => localStorage.setItem("language", "en"))
                await attachAdminMock(page, "en-US")
                await page.goto(`${baseURL}/dashboard/`)
                if (viewport.width < 768) {
                    await page.getByRole("button", { name: "Actions", exact: true }).first().click()
                }
                await page.getByRole("button", { name: "Edit", exact: true }).first().click()
                const trigger = page.getByRole("button", { name: /^Start Date · / })
                await trigger.scrollIntoViewIfNeeded()
                await trigger.click()
                const calendar = page.locator("[data-note-calendar]")
                await expect(calendar).toBeVisible()
                const metrics = await calendar.evaluate((el) => {
                    const popup = el.parentElement!
                    const time = popup.querySelector('input[type="time"]')!
                    const apply = Array.from(popup.querySelectorAll("button")).at(-1)!
                    const pRect = popup.getBoundingClientRect()
                    const tRect = time.getBoundingClientRect()
                    const aRect = apply.getBoundingClientRect()
                    return {
                        innerHeight,
                        popupScrollOverflow: popup.scrollHeight - popup.clientHeight,
                        popupInView: pRect.top >= 0 && pRect.bottom <= innerHeight,
                        timeVisible:
                            tRect.top >= pRect.top &&
                            tRect.bottom <= Math.min(innerHeight, pRect.bottom),
                        applyVisible:
                            aRect.top >= pRect.top &&
                            aRect.bottom <= Math.min(innerHeight, pRect.bottom),
                        windowScrollY: window.scrollY,
                    }
                })
                expect(metrics.popupScrollOverflow, JSON.stringify(metrics)).toBeLessThanOrEqual(1)
                expect(metrics.popupInView, JSON.stringify(metrics)).toBe(true)
                expect(metrics.timeVisible, JSON.stringify(metrics)).toBe(true)
                expect(metrics.applyVisible, JSON.stringify(metrics)).toBe(true)
                expect(metrics.windowScrollY).toBe(0)
                await page.close()
            }
        } finally {
            await browser.close()
        }
    })

    test(`A4: ${engine} fits Cycle value at 375px and prevents Japanese type Select from overlapping Delete`, async ({
        baseURL,
    }) => {
        const browser = await driver.launch()
        try {
            if (!baseURL) throw new Error("A local preview baseURL is required")
            const enPage = await browser.newPage({
                viewport: { width: 375, height: 667 },
                locale: "en-US",
            })
            await enPage.addInitScript(() => localStorage.setItem("language", "en"))
            await attachAdminMock(enPage, "en-US")
            await enPage.goto(`${baseURL}/dashboard/`)
            await enPage.getByRole("button", { name: "Actions", exact: true }).first().click()
            await enPage.getByRole("button", { name: "Edit", exact: true }).first().click()
            await expect(enPage.locator("[data-public-note-editor]")).toBeVisible()
            const cycleMetrics = await enPage
                .locator('[data-note-field="cycle"] .nkt-note-control button span.truncate')
                .evaluate((el) => ({
                    text: el.textContent,
                    clientWidth: el.clientWidth,
                    scrollWidth: el.scrollWidth,
                }))
            expect(cycleMetrics.scrollWidth, JSON.stringify(cycleMetrics)).toBeLessThanOrEqual(
                cycleMetrics.clientWidth,
            )
            await enPage.close()

            const jaPage = await browser.newPage({
                viewport: { width: 1440, height: 900 },
                locale: "ja",
            })
            await jaPage.addInitScript(() => localStorage.setItem("language", "ja"))
            await attachAdminMock(jaPage, "ja")
            await jaPage.goto(`${baseURL}/dashboard/`)
            await jaPage.getByRole("button", { name: "編集", exact: true }).first().click()
            await expect(jaPage.locator("[data-private-note-editor]")).toBeVisible()
            const headings = await jaPage.locator(".nkt-json-heading").evaluateAll((els) =>
                els.map((el) => {
                    const combo = el.querySelector('[role="combobox"]')!
                    const buttons = el.querySelectorAll("button")
                    const del = buttons[buttons.length - 1]!
                    const cRect = combo.getBoundingClientRect()
                    const dRect = del.getBoundingClientRect()
                    return {
                        typeText: combo.textContent?.trim(),
                        comboRight: cRect.right,
                        delLeft: dRect.left,
                        gap: dRect.left - cRect.right,
                    }
                }),
            )
            expect(headings.length).toBeGreaterThan(0)
            for (const h of headings) {
                expect(h.gap, JSON.stringify(h)).toBeGreaterThanOrEqual(2)
            }
            await jaPage.close()
        } finally {
            await browser.close()
        }
    })

    test(`A5: ${engine} shows sidebar scroll cue at <=900px height and underline tab overflow controls at 1024px`, async ({
        baseURL,
    }) => {
        const browser = await driver.launch()
        try {
            if (!baseURL) throw new Error("A local preview baseURL is required")
            const page = await browser.newPage({
                viewport: { width: 1024, height: 768 },
                locale: "ja",
            })
            await page.addInitScript(() => localStorage.setItem("language", "ja"))
            await attachAdminMock(page, "ja")
            await page.goto(`${baseURL}/dashboard/settings`)
            await expect(page.locator('[role="tablist"]')).toBeVisible()

            const sidebarMetrics = await page.evaluate(() => {
                const vp = document.querySelector<HTMLElement>(
                    'aside.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) [data-sidebar="viewport"]',
                )!
                const sb = document.querySelector<HTMLElement>(
                    'aside.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) [data-orientation="vertical"]',
                )!
                const vpStyle = getComputedStyle(vp)
                const sbStyle = getComputedStyle(sb)
                const mask =
                    vpStyle.maskImage && vpStyle.maskImage !== "none"
                        ? vpStyle.maskImage
                        : vpStyle.webkitMaskImage
                return {
                    overflowY: vp.scrollHeight - vp.clientHeight,
                    mask: mask || "none",
                    scrollbarOpacity: parseFloat(sbStyle.opacity),
                }
            })
            expect(sidebarMetrics.overflowY).toBeGreaterThan(0)
            expect(sidebarMetrics.mask, JSON.stringify(sidebarMetrics)).not.toBe("none")
            expect(sidebarMetrics.scrollbarOpacity, JSON.stringify(sidebarMetrics)).toBeGreaterThan(
                0.2,
            )

            const endControl = page.locator(
                '.nk-page-tabs [data-kumo-part="overflow-control"][data-side="end"]',
            )
            await expect(endControl).toBeVisible()
            const beforeScroll = await page
                .locator('.nk-page-tabs [role="tablist"]')
                .evaluate((el) => ({
                    scrollLeft: el.scrollLeft,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                }))
            expect(beforeScroll.scrollWidth).toBeGreaterThan(beforeScroll.clientWidth)
            await endControl.click()
            await expect
                .poll(() =>
                    page
                        .locator('.nk-page-tabs [role="tablist"]')
                        .evaluate((el) => el.scrollLeft),
                )
                .toBeGreaterThan(0)

            await page.goto(`${baseURL}/dashboard/profile`)
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const active = document.querySelector<HTMLElement>(
                            'aside.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) a[aria-current="page"]',
                        )
                        const vp = active?.closest<HTMLElement>('[data-sidebar="viewport"]')
                        if (!active || !vp) return false
                        const ar = active.getBoundingClientRect()
                        const vr = vp.getBoundingClientRect()
                        return ar.top >= vr.top - 1 && ar.bottom <= vr.bottom + 1
                    }),
                )
                .toBe(true)
            expect(await page.evaluate(() => window.scrollY)).toBe(0)
            await page.close()
        } finally {
            await browser.close()
        }
    })
}
