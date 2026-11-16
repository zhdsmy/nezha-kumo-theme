import { expect, test } from "@playwright/test"

import { BREAKPOINTS } from "../../../packages/ui/src/contract"
import { mockNezha } from "./mock"

test.beforeEach(async ({ page }) => {
    await mockNezha(page)
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))
})

test("fleet views, search shortcut and two-second data", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.setViewportSize({ width: 856, height: 900 })
    // cards show every reading with nothing to expand
    await expect(page.locator(".server-card").first().locator(".card-facts dt")).toHaveCount(7)
    await expect(page.getByRole("button", { name: /Details/ })).toHaveCount(0)
    await page.getByRole("button", { name: "Compact", exact: true }).click()
    await expect(page.locator(".fleet-table .server-row")).toHaveCount(20)
    await page.reload()
    await expect(page.locator(".fleet-table .server-row")).toHaveCount(20)
    await page.getByRole("button", { name: "Cards", exact: true }).click()
    await page.locator(".list-toolbar").getByRole("textbox", { name: "Search" }).fill("Server 02")
    await expect(page.locator("[data-server]")).toHaveCount(1)
    await page.keyboard.press("Control+k")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("textbox").fill("Server 03")
    await dialog.getByRole("textbox").press("Enter")
    await expect(page.getByRole("heading", { name: "China Server 03", exact: true })).toBeVisible()
    await expect(page.locator(".node-live-strip .meter")).toHaveCount(3)
    await expect(page.locator(".node-live-strip .meter .num").first()).toContainText("%")
})

test("node tabs hash navigation, overview responsive panels, #billing link and load charts", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto("/server/6")
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
    )
    // 1024 wide: all three Info blocks visible simultaneously, no secondary tabs or charts
    await expect(page.locator(".node-subtabs")).toBeHidden()
    await expect(page.locator(".chart svg")).toHaveCount(0)
    await expect(page.locator(".spark")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible()
    await expect(page.getByText("Usage for this period is unavailable.")).toBeVisible()
    await expect(page.getByText("Public server information")).toBeVisible()

    // 4 tabs hash navigation
    await page.getByRole("tab", { name: "Load", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#load$/)
    await expect(page.locator(".metric-tile")).toHaveCount(0)
    await expect(page.locator(".spark")).toHaveCount(0)
    await expect(page.locator(".chart svg")).toHaveCount(6)
    await expect(page.getByRole("button", { name: "7 d", exact: true })).toHaveCount(0)
    await page
        .locator(".chart svg")
        .first()
        .hover({ position: { x: 150, y: 60 } })
    await expect(page.locator(".chart-tooltip")).toBeVisible()

    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#latency$/)
    await expect(page.locator(".node-ping-list button")).toHaveCount(3)
    await page.locator(".node-ping-list button").first().click()
    await expect(page.locator(".node-ping-detail")).toBeVisible()

    await page.getByRole("tab", { name: "Reporting history", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#history$/)
    await expect(page.getByText(/hours reported/)).toBeVisible()

    await page.getByRole("tab", { name: "Overview", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#overview$/)

    // 375 narrow: secondary tabs switch System / Network / Billing without mutating URL
    await page.setViewportSize({ width: 375, height: 900 })
    await expect(page.locator(".node-subtabs")).toBeVisible()
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeHidden()
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeHidden()

    await page.locator(".node-subtabs").getByRole("tab", { name: "Network", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#overview$/)
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeHidden()

    await page.locator(".node-subtabs").getByRole("tab", { name: "Billing", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#overview$/)
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible()
    await expect(page.getByText("Public server information")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeHidden()

    // Legacy #billing hash opens Overview and selects Billing
    await page.goto("/server/6#load")
    await page.goto("/server/6#billing")
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
    )
    await expect(
        page.locator(".node-subtabs").getByRole("tab", { name: "Billing", exact: true }),
    ).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeHidden()

    // Failed reports request on Overview leaves Today's traffic and Peak as "—" without blocking
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.route("**/server/25/metrics*", (route) =>
        route.fulfill({ status: 503, json: { success: false } }),
    )
    await page.goto("/server/25")
    const netPanel = page.locator('[data-panel="network"]')
    await expect(
        netPanel.locator("div").filter({ hasText: "Today’s traffic" }).locator("dd"),
    ).toHaveText("—")
    await expect(
        netPanel.locator("div").filter({ hasText: "Peak (24 h)" }).locator("dd"),
    ).toHaveText("—")
    await expect(page.getByText("Could not reach the monitor.")).toHaveCount(0)
})

test("login and OAuth use local mocks, authenticated history unlocks and shares range across load and latency", async ({
    page,
}) => {
    const requested: string[] = []
    page.on("request", (r) => {
        if (r.url().includes("/api/v1/server/6/")) requested.push(r.url())
    })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("button", { name: "Continue with GitHub" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible()
    await dialog.getByLabel("Username").fill("test-user")
    await dialog.getByLabel("Password").fill("fixture-only")
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.goto("/server/6#load")
    const sevenDays = page.getByRole("button", { name: "7 d", exact: true })
    await expect(sevenDays).toBeVisible()
    await expect(page.getByRole("button", { name: "30 d", exact: true })).toBeVisible()
    requested.length = 0
    await sevenDays.click()
    await expect(sevenDays).toHaveAttribute("aria-pressed", "true")
    await expect(page.locator(".chart svg")).toHaveCount(6)
    expect(requested.some((u) => u.includes("/metrics?period=7d&"))).toBe(true)
    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    await expect(page.getByRole("button", { name: "7 d", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.locator(".node-ping-list button")).toHaveCount(3)
    expect(requested.some((u) => u.includes("/service?period=7d"))).toBe(true)
})

test("drawer focus, appearance and language remain reachable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.getByRole("button", { name: "Appearance", exact: true }).click()
    await page.getByRole("menuitem", { name: "Dark", exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark")
    await page.getByRole("button", { name: "Language", exact: true }).click()
    await page.getByRole("menuitem", { name: "简体中文", exact: true }).click()
    await expect(page.getByRole("heading", { name: "概览", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Open navigation" }).click()
    await expect(page.locator(".nk-sidebar")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused()
})

test("responsive boundaries keep a single table/card tree and no overflow", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    for (const width of [
        375,
        767,
        BREAKPOINTS.gutter,
        856,
        879,
        BREAKPOINTS.sidebar,
        1024,
        1279,
        BREAKPOINTS.wide,
        1283,
        BREAKPOINTS.aside,
        1440,
    ]) {
        await page.setViewportSize({ width, height: 900 })
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
                message: `width ${width}`,
            })
            .toBe(true)
        for (const view of ["Compact", "Cards"]) {
            await page.getByRole("button", { name: view, exact: true }).click()
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                `${view} at ${width}`,
            ).toBe(true)
        }
    }
    expect(errors).toEqual([])
})

test("group and sort controls, locale persistence, and system theme", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    const groupLink = page.locator('nav a[href^="/?group="]').first()
    const group = (await groupLink.locator(".nk-nav-label").getAttribute("title")) ?? ""
    await groupLink.click()
    await expect(page.locator("[data-server]")).not.toHaveCount(20)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(group)
    await expect(groupLink).toHaveAttribute("aria-current", "page")
    await page.getByRole("button", { name: "Clear filters" }).click()
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.getByRole("combobox", { name: "Sort", exact: true }).click()
    await page.getByRole("option", { name: "Name", exact: true }).click()
    await expect(page.locator("[data-server]").first()).toContainText("Server 02")
    await page.getByRole("button", { name: "Language", exact: true }).click()
    await page.getByRole("menuitem", { name: "日本語", exact: true }).click()
    await expect(page.getByRole("heading", { name: "概要", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "言語", exact: true }).click()
    await page.getByRole("menuitem", { name: "繁體中文", exact: true }).click()
    await expect(page.getByRole("heading", { name: "概覽", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "語言", exact: true }).click()
    await page.getByRole("menuitem", { name: "English", exact: true }).click()
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark")
    await page.emulateMedia({ colorScheme: "light" })
    await expect(page.locator("html")).toHaveAttribute("data-mode", "light")
})

test("OAuth follows only the mocked authorization redirect", async ({ page }) => {
    await page.route("https://auth.example.test/**", (route) =>
        route.fulfill({ body: "Mock authorization", contentType: "text/plain" }),
    )
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Continue with GitHub" }).click()
    await expect(page).toHaveURL("https://auth.example.test/authorize")
})

test("empty fleet and history-disabled states", async ({ page }) => {
    await mockNezha(page, { empty: true, noHistory: true })
    await page.goto("/")
    await expect(page.getByText("No nodes yet.", { exact: true })).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "No nodes match these filters.", exact: true }),
    ).toBeVisible()
})

test("startup timeout offers retry after a loading state", async ({ page }) => {
    await page.clock.install()
    await page.routeWebSocket("**/api/v1/ws/server", () => {})
    await page.goto("/")
    await expect(page.locator(".loading-state")).toBeVisible()
    await page.clock.fastForward(16_000)
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible()
})

test("sidebar group icons show emoji, https img, and fall back to folder on 404 or non-https", async ({
    page,
}) => {
    await page.route("https://icons.example.test/ok.svg", (route) =>
        route.fulfill({
            status: 200,
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#0052d9"/></svg>',
        }),
    )
    await page.route("https://icons.example.test/missing.png", (route) =>
        route.fulfill({ status: 404, body: "Not Found" }),
    )
    await mockNezha(page, {
        customCode:
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"https://icons.example.test/ok.svg","2":"☁️","3":"https://icons.example.test/missing.png","4":"http://icons.example.test/insecure.svg"}</script>',
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)

    const groupItem = (name: string) =>
        page.locator("nav a").filter({ has: page.locator(`.nk-nav-label[title="${name}"]`) })

    const imgItem = groupItem("🛜 宽带")
    const img = imgItem.locator("img.group-icon-img")
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute("src", "https://icons.example.test/ok.svg")
    await expect(img).toHaveAttribute("alt", "")
    await expect(img).toHaveAttribute("loading", "lazy")
    await expect(img).toHaveAttribute("referrerpolicy", "no-referrer")

    const emojiItem = groupItem("🏠 HomeLab")
    await expect(emojiItem.locator(".group-icon-text")).toHaveText("☁️")
    await expect(emojiItem.locator("svg")).toHaveCount(0)

    const brokenItem = groupItem("🇺🇸 美国")
    await expect(brokenItem.locator("img")).toHaveCount(0)
    await expect(brokenItem.locator(".nk-nav-icon svg")).toHaveCount(1)

    const insecureItem = groupItem("🇨🇳 中国")
    await expect(insecureItem.locator("img")).toHaveCount(0)
    await expect(insecureItem.locator(".nk-nav-icon svg")).toHaveCount(1)
})
