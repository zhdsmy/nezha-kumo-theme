import { expect, test } from "@playwright/test"

import original from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

test("node page heading shows region flag, switches TW on login, falls back to globe, and respects showRegions", async ({
    page,
}) => {
    await mockNezha(page)
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))

    let showRegions = true
    let overrideCountry = "tw"

    await page.route("**/config.js", (route) =>
        route.fulfill({
            contentType: "application/javascript",
            body: `window.NezhaKumoConfig = ${JSON.stringify({ showRegions })};`,
        }),
    )
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        const now = Date.now()
        const servers = structuredClone(original.servers)
        servers[0].name = "Taipei Edge 01"
        servers[0].country_code = overrideCountry
        servers.forEach((s) => {
            s.last_active = new Date(now).toISOString()
        })
        ws.send(JSON.stringify({ now, servers }))
    })

    // TW logged out -> cn.svg
    await page.goto("/server/6")
    const flag = page.locator("h1 img.region-flag")
    await expect(flag).toHaveAttribute("src", "/flags/cn.svg")
    await expect(flag).toHaveAttribute("alt", "Taiwan, China")

    // Sign in -> TW switches to tw.svg
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Username").fill("admin")
    await dialog.getByLabel("Password").fill("fixture-only")
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(flag).toHaveAttribute("src", "/flags/tw.svg")

    // Unshipped region code -> neutral GlobeIcon fallback
    overrideCountry = "eu"
    await page.reload()
    const globe = page.locator("h1 svg.region-flag")
    await expect(globe).toBeVisible()
    await expect(globe).toHaveAttribute("aria-label", "European Union")

    // settings.showRegions === false -> hidden
    showRegions = false
    await page.reload()
    await expect(page.getByRole("heading", { name: "Taipei Edge 01", exact: true })).toBeVisible()
    await expect(page.locator("h1 .region-flag")).toHaveCount(0)
})
