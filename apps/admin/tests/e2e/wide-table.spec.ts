import { chromium, expect, test, webkit } from "@playwright/test"

for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    test(`U8: ${engine} gives long server and owner names enough space on wide screens`, async ({
        baseURL,
    }) => {
        const browser = await driver.launch()
        try {
            const page = await browser.newPage({ baseURL })
            const name =
                "prod-apac-tokyo-hyperconverged-nvme-storage-cluster-node-02-extremely-long-hostname-overflow-check.internal.example.invalid"
            const owner = "member-sre-extremely-long-team-owner-handle"
            await page.route("**/api/v1/**", async (route) => {
                const path = new URL(route.request().url()).pathname
                const data = path.endsWith("/profile")
                    ? { id: 1, role: 0, username: "demo" }
                    : path.endsWith("/setting")
                      ? { config: { site_name: "Layout", language: "en" } }
                      : path.endsWith("/server")
                        ? [
                              {
                                  id: 1,
                                  name,
                                  display_index: 10,
                                  owner: { id: 2, username: owner },
                                  host: {},
                              },
                          ]
                        : []
                await route.fulfill({ json: { success: true, data } })
            })
            await page.goto("/dashboard/")
            const table = page.locator(".nkt-table")
            await expect(table.getByText(name, { exact: true })).toBeVisible()
            for (const width of [1440, 1920, 2560]) {
                await page.setViewportSize({ width, height: 900 })
                if (width === 1440) {
                    expect((await table.boundingBox())!.width).toBeLessThanOrEqual(1200)
                    continue
                }
                await expect
                    .poll(() => table.evaluate((el) => el.clientWidth))
                    .toBeGreaterThan(1200)
                expect((await table.boundingBox())!.width).toBeLessThan(1800)
                for (const text of [name, owner]) {
                    const value = table.getByText(text, { exact: true })
                    await expect
                        .poll(() =>
                            value.evaluate((el) => {
                                const box = el.closest(".nkt-cell-value")!.getBoundingClientRect()
                                const range = document.createRange()
                                range.selectNodeContents(el)
                                const rendered = range.getBoundingClientRect()
                                return (
                                    rendered.bottom <= box.bottom + 1 &&
                                    rendered.right <= box.right + 1
                                )
                            }),
                        )
                        .toBe(true)
                }
            }
        } finally {
            await browser.close()
        }
    })
}
