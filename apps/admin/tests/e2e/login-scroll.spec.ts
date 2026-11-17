import { chromium, expect, test, webkit } from "@playwright/test"

for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    test(`R2-ADM-03: ${engine} scrolls six login providers inside main`, async ({ baseURL }) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
        const browser = await driver.launch()
        try {
            const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
            await page.route("**/api/v1/**", (route) => {
                const profile = route.request().url().endsWith("/profile")
                return route.fulfill({
                    status: profile ? 401 : 200,
                    json: profile
                        ? { success: false, error: "Unauthorized" }
                        : {
                              success: true,
                              data: {
                                  config: {
                                      language: "zh-CN",
                                      oauth2_providers: [
                                          "github",
                                          "gitlab",
                                          "google",
                                          "microsoft",
                                          "oidc",
                                          "gitea",
                                      ],
                                  },
                              },
                          },
                })
            })
            await page.goto(`${baseURL}/dashboard/login`)
            await expect(page.getByRole("button", { name: /gitea$/ })).toHaveCount(1)
            const main = page.locator(".nk-main")
            await expect(main).toHaveCount(1)
            await page.mouse.move(180, 400)
            await page.mouse.wheel(0, 1000)
            await expect
                .poll(() => main.evaluate((element) => element.scrollTop))
                .toBeGreaterThan(0)
            expect(await page.evaluate(() => scrollY)).toBe(0)
            await expect(page.getByRole("button", { name: /gitea$/ })).toBeInViewport()
            for (const [width, height] of [
                [952, 670],
                [375, 667],
            ]) {
                await page.setViewportSize({ width, height })
                expect(await page.evaluate(() => scrollY)).toBe(0)
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true)
            }
        } finally {
            await browser.close()
        }
    })
}
