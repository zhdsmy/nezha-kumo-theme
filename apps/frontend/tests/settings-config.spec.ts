import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

test("panel JSON can disable exchange-rate requests while retaining billing", async ({ page }) => {
    const requests: string[] = []
    page.on("request", (request) => {
        if (new URL(request.url()).hostname === "api.frankfurter.dev") requests.push(request.url())
    })
    await mockNezha(page, {
        empty: true,
        customCode:
            '<script type="application/json" id="nezha-kumo-config">{"siteTitle":"Panel configuration","showCost":false,"showBilling":true}</script>',
    })
    await page.goto("/")
    await expect(page).toHaveTitle("Panel configuration")
    await page.waitForLoadState("networkidle")
    expect(requests).toEqual([])
})
