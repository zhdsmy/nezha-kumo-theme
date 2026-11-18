import { chromium, expect, test, webkit } from "@playwright/test"

for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    for (const routeName of ["service", "notification", "server-config"]) {
        test(`ADM-07: ${engine} keeps every tabbed ${routeName} control fully visible`, async ({
            baseURL,
        }) => {
            const browser = await driver.launch()
            try {
                if (!baseURL) throw new Error("A local preview baseURL is required")
                expect(new URL(baseURL).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
                const page = await browser.newPage({
                    viewport: { width: 375, height: 667 },
                    locale: "en-US",
                })
                await page.route("**/api/v1/**", async (route) => {
                    const path = new URL(route.request().url()).pathname.slice(8)
                    const data =
                        path === "profile"
                            ? { id: 1, role: 0, username: "mock" }
                            : path === "setting"
                              ? {
                                    config: {
                                        site_name: "Mock",
                                        language: "en-US",
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
                                          host: {},
                                          geoip: { ip: { ipv4_addr: "192.0.2.1" } },
                                          owner: { username: "mock" },
                                      },
                                  ]
                                : path === "server/config/1"
                                  ? JSON.stringify({ debug: false })
                                  : []
                    await route.fulfill({ json: { success: true, data } })
                })
                await page.goto(
                    `${baseURL}/dashboard/${routeName === "server-config" ? "" : routeName}`,
                )
                if (routeName === "server-config") {
                    await page.getByRole("button", { name: "Actions", exact: true }).first().click()
                    await page
                        .getByRole("button", { name: "More actions", exact: true })
                        .first()
                        .click()
                    await page.getByRole("menu").getByText("Config", { exact: true }).click()
                    await page.getByRole("dialog").locator("form").waitFor()
                } else {
                    await page
                        .locator("main")
                        .getByRole("button", { name: "Create", exact: true })
                        .click()
                }
                await expect(page.getByRole("dialog")).toBeVisible()
                // WebKit's Option+Tab visits buttons, but native Tab wraps a focus scope.
                if (engine === "webkit") await page.keyboard.press("Tab")
                let checked = 0
                let footerReached = false
                for (let step = 0; step < 45; step++) {
                    await page.keyboard.press(engine === "webkit" ? "Alt+Tab" : "Tab")
                    await page.waitForTimeout(100)
                    const focus = await page.evaluate(async () => {
                        await new Promise(requestAnimationFrame)
                        const element = document.activeElement as HTMLElement
                        const dialog = document.querySelector('[role="dialog"]')!
                        const footer = dialog.querySelector(".nkt-dialog-footer")!
                        const box = element.getBoundingClientRect()
                        const bounds = dialog.getBoundingClientRect()
                        const hit = document.elementFromPoint(
                            box.x + box.width / 2,
                            box.y + box.height / 2,
                        )
                        return {
                            box: { top: box.top, bottom: box.bottom },
                            bounds: { top: bounds.top, bottom: bounds.bottom },
                            hit: hit?.outerHTML.slice(0, 160),
                            label:
                                element.getAttribute("name") ||
                                element.getAttribute("aria-label") ||
                                element.textContent,
                            inside: dialog.contains(element),
                            visible:
                                box.top >= Math.max(0, bounds.top) &&
                                box.bottom <= Math.min(innerHeight, bounds.bottom) &&
                                (element === hit || element.contains(hit)),
                            footer: footer.contains(element),
                        }
                    })
                    expect(focus.inside, JSON.stringify(focus)).toBe(true)
                    expect(focus.visible, JSON.stringify(focus)).toBe(true)
                    checked++
                    footerReached ||= focus.footer
                }
                expect(checked).toBe(45)
                expect(footerReached).toBe(true)
            } finally {
                await browser.close()
            }
        })
    }

    test(`A1: ${engine} Tab leaves Extra TagInput to reach Submit with a visible offset focus ring`, async ({
        baseURL,
    }) => {
        const browser = await driver.launch()
        try {
            const page = await browser.newPage({
                viewport: { width: 1440, height: 900 },
                locale: "en-US",
                reducedMotion: "reduce",
            })
            await page.addInitScript(() => localStorage.setItem("language", "en"))
            await page.route("**/api/v1/**", async (route) => {
                const path = new URL(route.request().url()).pathname.slice(8)
                const data =
                    path === "profile"
                        ? { id: 1, role: 0, username: "mock" }
                        : path === "setting"
                          ? {
                                config: {
                                    site_name: "Mock",
                                    language: "en",
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
                                      public_note: '{"planDataMod":{"networkRoute":"LINX"}}',
                                      host: {},
                                      geoip: { ip: { ipv4_addr: "192.0.2.1" } },
                                      owner: { username: "mock" },
                                  },
                              ]
                            : []
                await route.fulfill({ json: { success: true, data } })
            })
            await page.goto(`${baseURL}/dashboard/`)
            await page.getByRole("button", { name: "Edit", exact: true }).first().click()
            const extra = page.locator('[data-note-field="extra"] input[aria-label]')
            await extra.scrollIntoViewIfNeeded()
            await extra.focus()
            let submitFocused = false
            for (let i = 0; i < 6; i++) {
                await page.keyboard.press("Tab")
                const text = await page.evaluate(() => document.activeElement?.textContent?.trim())
                if (text === "Submit") {
                    submitFocused = true
                    break
                }
            }
            expect(submitFocused).toBe(true)
            const ring = await page.evaluate(() => {
                const el = document.activeElement as HTMLElement
                const cs = getComputedStyle(el)
                return {
                    outlineStyle: cs.outlineStyle,
                    outlineWidth: parseFloat(cs.outlineWidth),
                    outlineOffset: parseFloat(cs.outlineOffset),
                    outlineColor: cs.outlineColor,
                }
            })
            expect(ring.outlineStyle).toBe("solid")
            expect(ring.outlineWidth).toBeGreaterThanOrEqual(2)
            expect(ring.outlineOffset).toBeGreaterThanOrEqual(2)
            expect(ring.outlineColor).not.toBe("rgba(0, 0, 0, 0)")
        } finally {
            await browser.close()
        }
    })
}

