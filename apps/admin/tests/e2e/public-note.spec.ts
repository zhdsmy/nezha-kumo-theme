import { chromium, expect, test, webkit } from "@playwright/test"
import { mkdirSync } from "node:fs"

const artifact = process.env.NKT_NOTE_ARTIFACTS
const original =
    ' {"unknown":1e+2,"billingDataMod":{"startDate":"2026-11-11 00:00:00+08:00","endDate":"2027-02-11 23:59:59+08:00","autoRenewal":"1","cycle":"Quarter","amount":"USD 45"},"planDataMod":{"bandwidth":"30Mbps","trafficVol":"1TB/Month","trafficType":"1","IPv4":"1","IPv6":"0","networkRoute":"CN2GIA,9929,4837[联通]","extra":"SSD，Daily backup"}} '
for (const [engine, driver] of Object.entries({ chromium, webkit }))
    for (const width of [375, 1440])
        for (const color of ["light", "dark"] as const) {
            test(`public-note ${engine} ${width} ${color}: fields, cycles, preservation and layout`, async ({
                baseURL,
            }) => {
                const browser = await driver.launch()
                try {
                    const page = await browser.newPage({
                        viewport: { width, height: width === 375 ? 667 : 900 },
                        colorScheme: color,
                        locale: "zh-CN",
                        timezoneId: "Asia/Taipei",
                        reducedMotion: "reduce",
                    })
                    await page.addInitScript(
                        ({ color }) => {
                            localStorage.setItem("language", "zh-CN")
                            localStorage.setItem("nkt:theme", color)
                            localStorage.setItem("vite-ui-theme", color)
                        },
                        { color },
                    )
                    let note = original
                    const writes: string[] = []
                    await page.route("**/api/v1/**", async (route) => {
                        const path = new URL(route.request().url()).pathname.slice(8)
                        if (route.request().method() === "PATCH") {
                            writes.push(route.request().postDataJSON().public_note)
                            return route.fulfill({ json: { success: true } })
                        }
                        const data =
                            path === "profile"
                                ? { id: 1, role: 0, username: "mock" }
                                : path === "setting"
                                  ? {
                                        config: {
                                            site_name: "Mock",
                                            language: "zh-CN",
                                            oauth2_providers: [],
                                            custom_code: "",
                                            custom_code_dashboard: "",
                                        },
                                    }
                                  : path === "server"
                                    ? [
                                          {
                                              id: 1,
                                              name: "Quarter / Routes",
                                              display_index: 0,
                                              public_note: note,
                                              host: {},
                                              geoip: {},
                                              owner: { username: "mock" },
                                          },
                                          {
                                              id: 2,
                                              name: "Other",
                                              display_index: 0,
                                              public_note:
                                                  '{"planDataMod":{"networkRoute":"CMI,CN2GIA"}}',
                                              host: {},
                                              geoip: {},
                                              owner: { username: "mock" },
                                          },
                                      ]
                                    : []
                        await route.fulfill({ json: { success: true, data } })
                    })
                    const open = async () => {
                        await page.goto(`${baseURL}/dashboard`)
                        if (width === 375)
                            await page
                                .getByRole("button", { name: "操作", exact: true })
                                .first()
                                .click()
                        await page
                            .getByRole("button", { name: "编辑", exact: true })
                            .first()
                            .click()
                        await expect(page.locator("[data-public-note-editor]")).toBeVisible()
                    }
                    const capture = async (name: string, selector: string) => {
                        await page.locator(selector).scrollIntoViewIfNeeded()
                        if (artifact) {
                            mkdirSync(artifact, { recursive: true })
                            await page.screenshot({
                                path: `${artifact}/admin-${engine}-${width}-${color}-${name}.png`,
                            })
                        }
                        const bounds = await page
                            .locator("[data-public-note-editor]")
                            .evaluate((el) => ({
                                width: el.clientWidth,
                                scroll: el.scrollWidth,
                                doc: document.scrollingElement?.scrollTop,
                            }))
                        expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1)
                        expect(bounds.doc).toBe(0)
                    }
                    await open()
                    await expect(
                        page.getByRole("button", { name: /^周期 · /, exact: true }),
                    ).toHaveText("每 3 个月")
                    await capture("quarter", '[data-note-field="cycle"]')
                    await page.getByRole("button", { name: /^周期 · /, exact: true }).click()
                    await expect(
                        page.getByRole("button", { name: "每天", exact: true }),
                    ).toBeVisible()
                    const custom = page.getByRole("button", { name: "自定义", exact: true })
                    await expect(custom).toHaveAttribute("aria-pressed", "true")
                    expect(
                        await custom.evaluate((el) => getComputedStyle(el).backgroundColor),
                    ).not.toBe(
                        await page
                            .getByRole("button", { name: "每天", exact: true })
                            .evaluate((el) => getComputedStyle(el).backgroundColor),
                    )
                    if (artifact)
                        await page.screenshot({
                            path: `${artifact}/admin-${engine}-${width}-${color}-presets.png`,
                        })
                    await page.getByRole("button", { name: "自定义", exact: true }).click()
                    const count = page.getByRole("spinbutton", { name: "数量" })
                    await expect(count).toHaveValue("3")
                    await expect(count).toBeFocused()
                    await expect
                        .poll(() =>
                            count.evaluate((input) => {
                                const select =
                                    input.parentElement!.querySelector('[role="combobox"]')!
                                return Math.abs(
                                    input.getBoundingClientRect().y -
                                        select.getBoundingClientRect().y,
                                )
                            }),
                        )
                        .toBeLessThan(2)
                    if (artifact)
                        await page.screenshot({
                            path: `${artifact}/admin-${engine}-${width}-${color}-custom.png`,
                        })
                    await page.keyboard.press("Escape")
                    await expect(
                        page.getByRole("button", { name: /^周期 · /, exact: true }),
                    ).toBeFocused()
                    await capture("quota", '[data-note-field="trafficVol"]')
                    await capture("routes", '[data-note-field="networkRoute"]')
                    await expect(page.locator('datalist option[value="CMI"]')).toHaveCount(1)
                    await page.getByRole("switch", { name: "自动续费", exact: true }).click()
                    await page.getByRole("button", { name: "提交", exact: true }).click()
                    await expect.poll(() => writes.length).toBe(1)
                    expect(writes[0]).toBe(
                        original.replace('"autoRenewal":"1"', '"autoRenewal":"0"'),
                    )
                    note = original.replace('"USD 45"', '"0"').replace('"1TB/Month"', '"Unlimited"')
                    await open()
                    await expect(
                        page.getByRole("button", { name: "免费", exact: true }),
                    ).toHaveAttribute("aria-pressed", "true")
                    await capture("free", '[data-note-field="amount"]')
                    await expect(
                        page.getByRole("switch", { name: "流量配额 · 不限" }),
                    ).toBeChecked()
                    await capture("unlimited", '[data-note-field="trafficVol"]')
                    await page.getByRole("button", { name: "付费", exact: true }).click()
                    await page
                        .getByRole("spinbutton", { name: "金额", exact: true })
                        .pressSequentially("0.99")
                    await expect(
                        page.getByRole("spinbutton", { name: "金额", exact: true }),
                    ).toHaveValue("0.99")
                    await page.getByRole("button", { name: "提交", exact: true }).click()
                    await expect.poll(() => writes.length).toBe(2)
                    expect(JSON.parse(writes[1]).billingDataMod.amount).toBe("USD 0.99")
                } finally {
                    await browser.close()
                }
            })
        }
