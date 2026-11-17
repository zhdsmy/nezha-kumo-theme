import { expect, test, webkit } from "@playwright/test"

import fixture from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

for (const engine of ["chromium", "webkit"]) {
    test(`public-note ${engine}: generator billing, traffic mode and separate route capsules`, async ({
        page,
        baseURL,
    }) => {
        const browser = engine === "webkit" ? await webkit.launch() : null
        const target = browser
            ? await browser.newPage({ viewport: { width: 375, height: 667 }, locale: "en-US" })
            : page
        try {
            await target.setViewportSize({ width: 375, height: 667 })
            await mockNezha(target)
            await target.routeWebSocket("**/api/v1/ws/server", (ws) =>
                ws.send(
                    JSON.stringify({
                        now: Date.now(),
                        servers: [
                            {
                                ...fixture.servers[0],
                                id: 6,
                                name: "Note fixture",
                                last_active: new Date().toISOString(),
                                public_note: JSON.stringify({
                                    billingDataMod: {
                                        amount: "$3.99/2年",
                                        cycle: "",
                                        endDate: "2027-02-11 23:59:59+08:00",
                                    },
                                    planDataMod: {
                                        trafficType: "1",
                                        trafficVol: "1TB/月",
                                        networkRoute: "CN2GIA，CN2GIA,9929;4837[联通]",
                                        extra: "SSD、Daily backup;weekly\nsecond line",
                                    },
                                }),
                            },
                        ],
                    }),
                ),
            )
            await target.goto(`${baseURL}/server/6#overview`)
            await target.locator("#node-subtab-network").click()
            await expect(
                target.locator("#node-panel-network").getByText("Outbound only", { exact: true }),
            ).toBeVisible()
            await expect(
                target.locator("#node-panel-network").getByText("CN2GIA", { exact: true }),
            ).toHaveCount(2)
            await expect(
                target.locator("#node-panel-network").getByText("CN2GIA", { exact: true }).first(),
            ).toHaveClass(/bg-kumo-fill/)
            for (const tag of ["9929;4837[联通]"])
                await expect(
                    target.locator("#node-panel-network").getByText(tag, { exact: true }),
                ).toBeVisible()
            await target.locator("#node-subtab-billing").click()
            for (const tag of ["SSD、Daily backup;weekly\nsecond line"])
                await expect(
                    target.locator("#node-panel-billing").getByText(tag, { exact: true }),
                ).toBeVisible()
            expect(
                await target
                    .locator("#node-panel-billing")
                    .getByText("SSD、Daily backup;weekly", { exact: false })
                    .evaluate((el) => getComputedStyle(el).whiteSpace),
            ).toBe("pre-line")
            await expect(target.locator("#node-panel-billing")).toContainText("$0.17/mo")
        } finally {
            await browser?.close()
        }
    })
}
