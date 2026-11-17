import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

test("1d load and latency x-axes distinguish dates across midnight without overlap at 375/867/952/1440", async ({
    page,
}) => {
    await mockNezha(page)

    const widths = [375, 867, 952, 1440]
    const locales = ["en", "zh-CN", "zh-TW", "ja"] as const

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/server/6#load")
    await expect(page.locator(".chart-card").first()).toBeVisible()

    // Switch segmented range to 1d (value="24")
    const rangeBar = page.locator('.chart-toolbar [role="tablist"]')
    await rangeBar.locator('[role="tab"]').nth(3).click()
    await expect(page.locator(".chart-card svg > text.chart-axis").first()).toContainText("/")

    for (const locale of locales) {
        await page.evaluate((lng) => {
            localStorage.setItem("nkt:language", lng)
        }, locale)
        // Switch language via topbar language menu so React re-renders without reload
        const langMenuTrigger = page.locator(".nk-topbar-actions > button").nth(1)
        await langMenuTrigger.click()
        await page.locator(`[role="menuitemradio"][lang="${locale}"]`).click()

        for (const section of ["load", "latency"] as const) {
            if (section === "latency") {
                await page.goto("/server/6#latency")
                await expect(page.locator(".latency-card")).toBeVisible()
                // Range is shared across load/latency in NodePage; ensure 1d is selected
                const tabs = page.locator('.chart-toolbar [role="tab"]')
                if ((await tabs.nth(3).getAttribute("aria-selected")) !== "true") {
                    await tabs.nth(3).click()
                }
            } else if (!page.url().endsWith("#load")) {
                await page.goto("/server/6#load")
                await expect(page.locator(".chart-card").first()).toBeVisible()
                const tabs = page.locator('.chart-toolbar [role="tab"]')
                if ((await tabs.nth(3).getAttribute("aria-selected")) !== "true") {
                    await tabs.nth(3).click()
                }
            }

            for (const width of widths) {
                await page.setViewportSize({ width, height: 800 })
                // Wait one frame for ResizeObserver layout update
                await page.evaluate(
                    () =>
                        new Promise<void>((r) =>
                            requestAnimationFrame(() => requestAnimationFrame(() => r())),
                        ),
                )

                const check = await page.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll<HTMLElement>(".chart-card"))
                    return cards.map((card) => {
                        const cardRect = card.getBoundingClientRect()
                        const svg = card.querySelector("svg")!
                        const texts = Array.from(
                            svg.querySelectorAll<SVGTextElement>(":scope > text.chart-axis"),
                        )
                        const items = texts.map((el) => {
                            const r = el.getBoundingClientRect()
                            return {
                                text: el.textContent ?? "",
                                left: r.left,
                                right: r.right,
                            }
                        })
                        let minGap = Infinity
                        for (let i = 1; i < items.length; i++) {
                            minGap = Math.min(minGap, items[i].left - items[i - 1].right)
                        }
                        const outOfCard = items.some(
                            (it) => it.left < cardRect.left - 1 || it.right > cardRect.right + 1,
                        )
                        return {
                            labels: items.map((i) => i.text),
                            minGap,
                            outOfCard,
                        }
                    })
                })

                expect(check.length).toBeGreaterThan(0)
                for (const c of check) {
                    const dated = c.labels.filter((l) => l.includes("/"))
                    expect(
                        dated.length,
                        `${locale} ${section} @${width}: expected >=2 dated ticks in ${JSON.stringify(c.labels)}`,
                    ).toBeGreaterThanOrEqual(2)
                    expect(
                        new Set(dated.map((d) => d.split(/[, \u2009]/)[0])).size,
                    ).toBeGreaterThanOrEqual(2)
                    expect(
                        c.minGap,
                        `${locale} ${section} @${width}: overlap ${c.minGap} in ${JSON.stringify(c.labels)}`,
                    ).toBeGreaterThan(2)
                    expect(c.outOfCard, `${locale} ${section} @${width}: truncated`).toBe(false)
                }
            }
        }
    }
})
