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
}
