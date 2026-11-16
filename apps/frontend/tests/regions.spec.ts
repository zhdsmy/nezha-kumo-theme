import { expect, test } from "@playwright/test"

import frameFixture from "./fixtures/nezha-frame.json" with { type: "json" }
import { mockNezha } from "./mock"

test.beforeEach(async ({ page }) => {
    await mockNezha(page)
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
})

test("region tabs filter list, sync ?region=, persist across reload, and fall back on group switch", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)

    const regionTabs = page.locator(".region-tabs")
    await expect(regionTabs).toBeVisible()
    const tabs = regionTabs.getByRole("tab")
    // All 20, then CN 6, HK 6, US 5, BR 1, JP 1 (count desc, code asc)
    await expect(tabs).toHaveCount(6)
    await expect(tabs.nth(0)).toContainText("All")
    await expect(tabs.nth(0)).toContainText("20")
    await expect(tabs.nth(1)).toContainText("CN")
    await expect(tabs.nth(1)).toContainText("6")
    await expect(tabs.nth(2)).toContainText("HK")
    await expect(tabs.nth(2)).toContainText("6")
    await expect(tabs.nth(3)).toContainText("US")
    await expect(tabs.nth(3)).toContainText("5")
    await expect(tabs.nth(4)).toContainText("BR")
    await expect(tabs.nth(5)).toContainText("JP")

    // Click HK tab -> filters server list only; overview tile keeps total 20
    await tabs.nth(2).click()
    await expect(page).toHaveURL(/\/\?region=HK$/)
    await expect(page.locator("[data-server]")).toHaveCount(6)
    await expect(page.locator(".metric-tile").first().locator(".tile-denominator")).toHaveText(
        " / 20",
    )

    // Reload keeps ?region=HK active
    await page.reload()
    await expect(page).toHaveURL(/\/\?region=HK$/)
    await expect(page.locator("[data-server]")).toHaveCount(6)
    await expect(regionTabs.getByRole("tab").nth(2)).toHaveAttribute("aria-selected", "true")

    // All tab restores full list and clears ?region=
    await regionTabs.getByRole("tab").first().click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("[data-server]")).toHaveCount(20)

    // Coexists with ?group= and falls back when switching to a group without that region
    await page
        .locator("nav a")
        .filter({ has: page.locator('.nk-nav-label[title="🛜 宽带"]') })
        .click()
    await expect(page.locator("[data-server]")).toHaveCount(2)
    await regionTabs.getByRole("tab", { name: /HK/ }).click()
    await expect(page).toHaveURL(/group=.*region=HK/)
    await expect(page.locator("[data-server]")).toHaveCount(1)

    // Navigate to another group where HK does not exist -> falls back to All and cleans URL
    await page.goto(`/?${new URLSearchParams({ group: "🇺🇸 美国", region: "HK" })}`)
    await expect(page.locator("[data-server]")).toHaveCount(3)
    await expect(regionTabs.getByRole("tab").first()).toHaveAttribute("aria-selected", "true")
    await expect(page).not.toHaveURL(/region=HK/)

    // Single-region group hides region tabs (< 2 regions)
    await page
        .locator("nav a")
        .filter({ has: page.locator('.nk-nav-label[title="🏠 HomeLab"]') })
        .click()
    await expect(page.locator("[data-server]")).toHaveCount(3)
    await expect(regionTabs).toHaveCount(0)
})

test("inline search expands with autofocus, closes on Escape or clear, and stays single-row at 375px; sort menu switches key and direction", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await expect(page.locator(".list-toolbar")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0)

    const heading = page.locator(".section-heading")
    await heading.getByRole("button", { name: "Search", exact: true }).click()
    const input = heading.getByRole("textbox", { name: "Search" })
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()

    // At 375px with search expanded: heading does not wrap, view switch remains visible, no overflow
    const singleRow = await heading.evaluate((el) => {
        const h2 = el.querySelector("h2")!.getBoundingClientRect()
        const inp = el.querySelector("input")!.getBoundingClientRect()
        const view = el.querySelector(".view-switch")!.getBoundingClientRect()
        return {
            sameLine:
                Math.abs(h2.top + h2.height / 2 - (inp.top + inp.height / 2)) <= 6 &&
                Math.abs(inp.top + inp.height / 2 - (view.top + view.height / 2)) <= 6,
            viewVisible: view.width > 0 && view.right <= window.innerWidth,
            noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        }
    })
    expect(singleRow).toEqual({ sameLine: true, viewVisible: true, noOverflow: true })

    await input.fill("Server 02")
    await expect(page.locator("[data-server]")).toHaveCount(1)
    // Region tab counts stay scoped to group, unaffected by search query
    await expect(page.locator(".region-tabs").getByRole("tab").first()).toContainText("20")

    // Escape clears query and collapses back to Search button
    await input.press("Escape")
    await expect(input).toHaveCount(0)
    await expect(heading.getByRole("button", { name: "Search", exact: true })).toBeVisible()
    await expect(page.locator("[data-server]")).toHaveCount(20)

    // Clear (✕) button also clears and collapses
    await heading.getByRole("button", { name: "Search", exact: true }).click()
    await input.fill("Server 05")
    await expect(page.locator("[data-server]")).toHaveCount(1)
    await heading.locator(".search-clear").click()
    await expect(input).toHaveCount(0)
    await expect(page.locator("[data-server]")).toHaveCount(20)

    // Sort dropdown switches both sort key and ascending/descending direction
    const sortBtn = heading.getByRole("button", { name: "Sort", exact: true })
    await sortBtn.click()
    await page.getByRole("menuitemradio", { name: "Name", exact: true }).click()
    await expect(sortBtn).toContainText("Name")
    await expect(page.locator("[data-server]").first()).toContainText("Server 02")
    await page.getByRole("menuitemradio", { name: "Descending", exact: true }).click()
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-server]").first()).toContainText("Tokyo production")
})

test("cards and compact rows show region flag img, omit region code from meta, switch TW flag on login, and respect showRegions", async ({
    page,
}) => {
    let showRegions = true
    await page.route("**/config.js", (route) =>
        route.fulfill({
            contentType: "application/javascript",
            body: `window.NezhaKumoConfig = ${JSON.stringify({ showRegions })};`,
        }),
    )
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        const now = Date.now()
        const servers = structuredClone(frameFixture.servers)
        servers[0].name = "Taipei Edge 01"
        servers[0].country_code = "tw"
        servers.forEach((s) => {
            s.last_active = new Date(now).toISOString()
        })
        ws.send(JSON.stringify({ now, servers }))
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    const twCard = page.locator(".server-card", { hasText: "Taipei Edge 01" })
    const cardFlag = twCard.locator(".card-name img.region-flag")
    const twTabFlag = page
        .locator(".region-tabs")
        .getByRole("tab", { name: /TW/ })
        .locator("img.region-flag")
    await expect(cardFlag).toBeVisible()
    await expect(cardFlag).toHaveAttribute("src", "/flags/cn.svg")
    await expect(twTabFlag).toHaveAttribute("src", "/flags/cn.svg")
    await expect(twCard.locator(".card-meta")).not.toContainText("TW")

    // Sign in -> TW flag on card and region tab switches to tw.svg
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Username").fill("admin")
    await dialog.getByLabel("Password").fill("fixture-only")
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(cardFlag).toHaveAttribute("src", "/flags/tw.svg")
    await expect(twTabFlag).toHaveAttribute("src", "/flags/tw.svg")

    // Compact view also shows flag before node name and omits region code
    await page.getByRole("button", { name: "Compact", exact: true }).click()
    const twRow = page.locator(".fleet-table .server-row", { hasText: "Taipei Edge 01" })
    await expect(twRow.locator(".server-name img.region-flag")).toHaveAttribute(
        "src",
        "/flags/tw.svg",
    )
    await expect(twRow.locator(".server-name > span.muted")).not.toContainText("TW")

    // settings.showRegions === false hides region tabs and card/row flags
    showRegions = false
    await page.reload()
    await expect(page.locator(".region-tabs")).toHaveCount(0)
    await expect(page.locator(".region-flag")).toHaveCount(0)
})
