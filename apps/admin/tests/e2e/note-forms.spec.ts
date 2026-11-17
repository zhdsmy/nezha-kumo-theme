import { chromium, expect, test, webkit } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"

const artifact = process.env.NKT_NOTE_ARTIFACTS
const baseline = !!process.env.NKT_NOTE_BASELINE
const publicNote =
    ' {"unknown":1e+2,"billingDataMod":{"startDate":"2026-11-11 10:20:37+08:00","endDate":"2027-02-11 23:59:59+08:00","autoRenewal":"1","cycle":"Quarter","amount":"USD 45"},"planDataMod":{"bandwidth":"30Mbps","trafficVol":"1TB/Month","trafficType":"1","IPv4":"1","IPv6":"0","networkRoute":"CN2GIA,9929,4837[联通]","extra":"SSD，Daily backup"}} '
const privateNote =
    '{"billingDataMod":{"actualAmount":"CNY 60.00"},"custom":{"region":"Test","enabled":true,"array":[1, 2]}}'
const originalHeights = {
    webkit: { 375: 1545.96875, 1440: 1136.5625 },
    chromium: { 375: 1540.5625, 1440: 1088.5625 },
}

for (const [engine, driver] of Object.entries({ webkit, chromium }))
    for (const width of [375, 1440] as const)
        for (const theme of ["light", "dark"] as const)
            test(`note forms ${engine} ${width} ${theme}: native controls, compact cards and JSON preservation`, async ({
                baseURL,
            }) => {
                test.setTimeout(90_000)
                const browser = await driver.launch()
                try {
                    const height = width === 375 ? 667 : 900
                    const page = await browser.newPage({
                        viewport: { width, height },
                        locale: "zh-CN",
                        timezoneId: "Asia/Taipei",
                        colorScheme: theme,
                        reducedMotion: "reduce",
                    })
                    const errors: string[] = []
                    page.on("pageerror", (error) => errors.push(error.message))
                    await page.addInitScript(
                        ({ theme }) => {
                            localStorage.setItem("language", "zh-CN")
                            localStorage.setItem("vite-ui-theme", theme)
                            localStorage.setItem("nkt:theme", theme)
                        },
                        { theme },
                    )
                    const writes: { note: string; public_note: string }[] = []
                    await page.route("**/api/v1/**", async (route) => {
                        const path = new URL(route.request().url()).pathname.slice(8)
                        if (route.request().method() === "PATCH") {
                            writes.push(route.request().postDataJSON())
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
                                              name: "Mock note forms",
                                              display_index: 0,
                                              note: privateNote,
                                              public_note: publicNote,
                                              host: {},
                                              geoip: {},
                                              owner: { username: "mock" },
                                          },
                                          {
                                              id: 2,
                                              name: "Other mock",
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
                    await page.goto(`${baseURL}/dashboard`)
                    if (width === 375)
                        await page
                            .getByRole("button", { name: "操作", exact: true })
                            .first()
                            .click()
                    await page.getByRole("button", { name: "编辑", exact: true }).first().click()
                    const editor = page.locator("[data-public-note-editor]")
                    await expect(editor).toBeVisible()
                    if (!baseline) {
                        await expect(
                            page.getByRole("combobox", { name: "类型 · custom.region · 文本" }),
                        ).toHaveText("文本")
                        const toggle = page.getByRole("switch", { name: "自动续费", exact: true })
                        expect(
                            await toggle.evaluate((el) => {
                                const hit = getComputedStyle(el, "::after")
                                return (
                                    el.getBoundingClientRect().height -
                                    parseFloat(hit.top) -
                                    parseFloat(hit.bottom)
                                )
                            }),
                        ).toBeGreaterThanOrEqual(36)
                    }
                    await page.evaluate(() => document.fonts.ready)
                    const cards = editor.locator(":scope > fieldset")
                    const sizes = await cards.evaluateAll((els) =>
                        els.map((el) => el.getBoundingClientRect().height),
                    )
                    const total = sizes.reduce((a, b) => a + b, 0)
                    if (!baseline)
                        expect(total).toBeLessThanOrEqual(
                            originalHeights[engine as keyof typeof originalHeights][width] * 0.7,
                        )
                    const name = `${engine}-${width}-${theme}`
                    if (artifact) {
                        mkdirSync(artifact, { recursive: true })
                        writeFileSync(
                            `${artifact}/${name}.json`,
                            JSON.stringify({ engine, width, theme, sizes, total }, null, 2),
                        )
                    }
                    const capture = async (suffix: string, selector?: string) => {
                        if (!artifact) return
                        if (selector)
                            await page.locator(selector).screenshot({
                                path: `${artifact}/${name}-${suffix}.png`,
                                animations: "disabled",
                            })
                        else
                            await page.screenshot({
                                path: `${artifact}/${name}-${suffix}.png`,
                                animations: "disabled",
                            })
                    }
                    // Taller captures show the complete cards at the same CSS width; measurements use the required viewport.
                    await page.setViewportSize({ width, height: 3000 })
                    for (let i = 0; i < 2; i++)
                        await capture(
                            `card-${i}`,
                            `[data-public-note-editor] > fieldset:nth-of-type(${i + 1})`,
                        )
                    if (!baseline) await capture("private-form", "[data-private-note-editor]")
                    await page.setViewportSize({ width, height })
                    await page.locator('[data-note-field="networkRoute"]').scrollIntoViewIfNeeded()
                    await capture("routes", '[data-note-field="networkRoute"]')
                    await expect(page.locator('datalist option[value="CMI"]')).toHaveCount(1)
                    const trigger = page.getByRole("button", { name: /^开始时间 · / })
                    await trigger.click()
                    if (!baseline) {
                        const calendar = page.locator("[data-note-calendar]")
                        await expect(calendar).toBeVisible()
                        await expect
                            .poll(() =>
                                calendar.evaluate((el) => {
                                    const popup = el.parentElement!
                                    const box = popup.getBoundingClientRect()
                                    return (
                                        box.x >= 0 &&
                                        box.right <= innerWidth &&
                                        box.y >= 0 &&
                                        box.bottom <= innerHeight &&
                                        popup.scrollHeight <= popup.clientHeight + 1
                                    )
                                }),
                            )
                            .toBe(true)
                        const popup = calendar.locator("..")
                        const anchor = await trigger.boundingBox()
                        const box = await popup.boundingBox()
                        expect(
                            box!.y + box!.height <= anchor!.y ||
                                box!.y >= anchor!.y + anchor!.height,
                        ).toBe(true)
                        const caption = await calendar.locator(".rdp-dropdowns").boundingBox()
                        for (const selector of [".rdp-button_previous", ".rdp-button_next"]) {
                            const arrow = await calendar.locator(selector).boundingBox()
                            expect(
                                arrow!.x + arrow!.width <= caption!.x ||
                                    arrow!.x >= caption!.x + caption!.width,
                            ).toBe(true)
                        }
                        const time = popup.locator('input[type="time"]')
                        await expect(time).toHaveValue("10:20")
                        await time.focus()
                        expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1)
                    }
                    await capture("date")
                    await page.keyboard.press("Escape")
                    if (!baseline) {
                        await expect(trigger).toBeFocused()
                        const privateEditor = page.locator("[data-private-note-editor]")
                        await privateEditor
                            .getByRole("button", { name: "原始文本", exact: true })
                            .click()
                        await privateEditor
                            .getByRole("textbox", { name: "私有备注原始文本" })
                            .scrollIntoViewIfNeeded()
                        await capture("private-raw")
                        await privateEditor
                            .getByRole("button", { name: "表单", exact: true })
                            .click()
                        if (width === 375)
                            for (const size of [
                                { width: 375, height: 667 },
                                { width: 952, height: 670 },
                                { width: 375, height: 667 },
                            ]) {
                                await page.setViewportSize(size)
                                const layout = await page.locator(".nkt-dialog").evaluate((el) => ({
                                    width: el.clientWidth,
                                    scroll: el.scrollWidth,
                                    doc: document.scrollingElement!.scrollTop,
                                }))
                                expect(layout.scroll).toBeLessThanOrEqual(layout.width + 1)
                                expect(layout.doc).toBe(0)
                                expect(
                                    await editor.evaluate(
                                        (el) => el.scrollWidth <= el.clientWidth + 1,
                                    ),
                                ).toBe(true)
                                expect(
                                    await privateEditor.evaluate(
                                        (el) => el.scrollWidth <= el.clientWidth + 1,
                                    ),
                                ).toBe(true)
                            }
                        const value = privateEditor.getByRole("textbox", {
                            name: "键值 · custom.region",
                        })
                        await value.fill("Edited")
                        expect(await value.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
                            "16px",
                        )
                        const toggle = page.getByRole("switch", { name: "自动续费", exact: true })
                        await toggle.scrollIntoViewIfNeeded()
                        const toggleBox = (await toggle.boundingBox())!
                        await page.mouse.click(toggleBox.x + toggleBox.width / 2, toggleBox.y - 5)
                        await expect(toggle).toBeChecked({ checked: false })
                        await page.getByRole("button", { name: "提交", exact: true }).click()
                        await expect.poll(() => writes.length).toBe(1)
                        expect(writes[0].note).toBe(privateNote.replace('"Test"', '"Edited"'))
                        expect(writes[0].public_note).toBe(
                            publicNote.replace('"autoRenewal":"1"', '"autoRenewal":"0"'),
                        )
                    }
                    expect(errors).toEqual([])
                } finally {
                    await browser.close()
                }
            })
