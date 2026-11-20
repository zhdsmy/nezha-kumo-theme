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
    // 856 wide (>= BREAKPOINTS.sidebar = 768) uses persistent expanded sidebar and hides topbar title
    await expect(page.locator("aside.nk-sidebar")).toHaveAttribute("data-state", "expanded")
    await expect(page.locator(".topbar-title")).toBeHidden()
    // cards show every reading with nothing to expand
    await expect(page.locator(".server-card").first().locator(".card-facts dt")).toHaveCount(7)
    await expect(page.getByRole("button", { name: /Details/ })).toHaveCount(0)
    await page.getByRole("button", { name: "Compact", exact: true }).click()
    await expect(page.locator(".fleet-table .server-row")).toHaveCount(20)
    await page.reload()
    await expect(page.locator(".fleet-table .server-row")).toHaveCount(20)
    await page.getByRole("button", { name: "Cards", exact: true }).click()
    await page
        .locator(".section-heading")
        .getByRole("button", { name: "Search", exact: true })
        .click()
    await page
        .locator(".section-heading")
        .getByRole("textbox", { name: "Search" })
        .fill("Server 02")
    await expect(page.locator("[data-server]")).toHaveCount(1)
    // Sidebar group links are directly reachable at 856 wide; Overview resets inline search
    await page.locator('nav a[href^="/?group="]').first().click()
    await expect(
        page.locator(".section-heading").getByRole("textbox", { name: "Search" }),
    ).toHaveValue("Server 02")
    await page.locator('nav a[href="/"]').click()
    await expect(
        page.locator(".section-heading").getByRole("textbox", { name: "Search" }),
    ).toHaveCount(0)
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.keyboard.press("Control+k")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("combobox").fill("Server 03")
    await dialog.getByRole("combobox").press("Enter")
    await expect(page).toHaveURL(/\/server\/19$/)
    await expect(page.getByRole("heading", { name: "China Server 03", exact: true })).toBeVisible()
    await expect(page.locator(".node-live-strip .meter")).toHaveCount(3)
    await expect(page.locator(".node-live-strip .meter .num").first()).toContainText("%")
    // Global search on a node tab preserves hash on Enter & click, and clears query after close
    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/19#latency$/)
    await page.keyboard.press("Control+k")
    await expect(dialog.getByRole("combobox")).toHaveValue("")
    await dialog.getByRole("combobox").fill("Server 12")
    await dialog.getByRole("combobox").press("Enter")
    await expect(page).toHaveURL(/\/server\/32#latency$/)
    await page.keyboard.press("Control+k")
    await expect(dialog.getByRole("combobox")).toHaveValue("")
    await dialog.getByRole("combobox").fill("Server 13")
    await dialog.locator(".search-result").first().click()
    await expect(page).toHaveURL(/\/server\/35#latency$/)
    await page.keyboard.press("Control+k")
    await expect(dialog.getByRole("combobox")).toHaveValue("")
    await dialog.getByRole("combobox").fill("stale")
    await page.keyboard.press("Escape")
    await page.keyboard.press("Control+k")
    await expect(dialog.getByRole("combobox")).toHaveValue("")
    await dialog.getByRole("combobox").fill("stale")
    await page.keyboard.press("Control+k")
    await page.keyboard.press("Control+k")
    await expect(dialog.getByRole("combobox")).toHaveValue("")
    await dialog.getByRole("combobox").fill("stale")
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
    await page.keyboard.press("Control+k")
    await expect(dialog.getByRole("combobox")).toHaveValue("")
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
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
    await expect(page.locator(".chart svg")).toHaveCount(7)
    await expect(page.getByRole("tab", { name: "7 d", exact: true })).toHaveCount(0)
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
    await expect(page.getByText(/\d+(?:\.\d+)?% · \d+\/\d+ hours?/)).toBeVisible()

    await page.getByRole("tab", { name: "Overview", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#overview$/)

    // 375 narrow: secondary tabs sync two-way with #billing via replace without adding history; card headings hide while regions stay named
    await page.setViewportSize({ width: 375, height: 900 })
    const historyBefore = await page.evaluate(() => history.length)
    await expect(page.locator(".node-subtabs")).toBeVisible()
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeHidden()
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeHidden()
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "System", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Network", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "Billing", exact: true })).toBeHidden()
    const panelTop = await page
        .locator(".node-info-panel[data-active]")
        .evaluate((el) => Math.round(el.getBoundingClientRect().top))

    await page.locator(".node-subtabs").getByRole("tab", { name: "Network", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#overview$/)
    await expect(page.getByRole("heading", { name: "Network", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "Network", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "System", exact: true })).toBeHidden()
    expect(
        await page
            .locator(".node-info-panel[data-active]")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    ).toBe(panelTop)

    await page.locator(".node-subtabs").getByRole("tab", { name: "Billing", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#billing$/)
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "Billing", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Network", exact: true })).toBeHidden()
    await expect(page.getByText("Public server information")).toBeVisible()
    expect(
        await page
            .locator(".node-info-panel[data-active]")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    ).toBe(panelTop)

    await page.locator(".node-subtabs").getByRole("tab", { name: "System", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6$/)
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "System", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Billing", exact: true })).toBeHidden()
    expect(await page.evaluate(() => history.length)).toBe(historyBefore)

    // #billing hash opens Overview and selects Billing, survives reload, and leaves Billing when hash changes
    await page.goto("/server/6#load")
    await page.goto("/server/6#billing")
    await page.reload()
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
    )
    await expect(
        page.locator(".node-subtabs").getByRole("tab", { name: "Billing", exact: true }),
    ).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeHidden()
    await expect(page.getByRole("region", { name: "Billing", exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "System", exact: true })).toBeHidden()
    await page.goBack()
    await expect(page).toHaveURL(/\/server\/6#load$/)
    await page.getByRole("tab", { name: "Overview", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/6#overview$/)
    await expect(
        page.locator(".node-subtabs").getByRole("tab", { name: "Billing", exact: true }),
    ).toHaveAttribute("aria-selected", "false")

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
    const sevenDays = page.getByRole("tab", { name: "7 d", exact: true })
    await expect(sevenDays).toBeVisible()
    await expect(page.getByRole("tab", { name: "30 d", exact: true })).toBeVisible()
    requested.length = 0
    await sevenDays.click()
    await expect(sevenDays).toHaveAttribute("aria-selected", "true")
    await expect(page.locator(".chart svg")).toHaveCount(7)
    expect(requested.some((u) => u.includes("/metrics?period=7d&"))).toBe(true)
    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    await expect(page.getByRole("tab", { name: "7 d", exact: true })).toHaveAttribute(
        "aria-selected",
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
    await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click()
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark")
    await page.getByRole("button", { name: "Language", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "简体中文", exact: true }).click()
    await expect(page.getByRole("heading", { name: "概览", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "打开导航" }).click()
    await expect(page.locator(".nk-sidebar")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("button", { name: "打开导航" })).toBeFocused()
})

test("responsive boundaries keep a single table/card tree, 767/768 drawer-to-sidebar switch, and no overflow", async ({
    page,
}) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)

    await page.setViewportSize({ width: 767, height: 900 })
    await expect(page.locator("aside.nk-sidebar")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible()
    await expect(page.locator(".topbar-title")).toBeVisible()

    await page.setViewportSize({ width: BREAKPOINTS.sidebar, height: 900 })
    await expect(page.locator("aside.nk-sidebar")).toHaveAttribute("data-state", "expanded")
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0)
    await expect(page.locator(".topbar-title")).toBeHidden()

    for (const width of [
        375,
        767,
        BREAKPOINTS.sidebar,
        856,
        879,
        880,
        1024,
        1279,
        BREAKPOINTS.wide,
        1283,
        BREAKPOINTS.aside,
        1440,
    ]) {
        await page.setViewportSize({ width, height: 900 })
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            document.documentElement.scrollWidth -
                            document.documentElement.clientWidth,
                    ),
                { message: `width ${width}` },
            )
            .toBe(0)
        for (const view of ["Compact", "Cards"]) {
            await page.getByRole("button", { name: view, exact: true }).click()
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth - document.documentElement.clientWidth,
                ),
                `${view} at ${width}`,
            ).toBe(0)
        }
    }
    expect(errors).toEqual([])
})

test("768–879 persistent sidebar defaults expanded at 867, collapses to 57px, and keeps zero overflow across home views and node tabs", async ({
    browser,
}) => {
    // Fresh context with empty localStorage: 867 wide starts expanded (260px) and collapses to 57px
    const ctx = await browser.newContext({ viewport: { width: 867, height: 900 } })
    const page = await ctx.newPage()
    await mockNezha(page)
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)

    const sidebar = page.locator("aside.nk-sidebar")
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    expect(await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(260)
    await expect(page.locator(".topbar-title")).toBeHidden()

    await page.getByRole("button", { name: "Collapse navigation" }).click()
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await expect
        .poll(() => sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width)))
        .toBe(57)
    expect(await page.evaluate(() => localStorage.getItem("nkt:sidebar-collapsed"))).toBe("true")

    await page.evaluate(() => localStorage.setItem("nkt:language", "en"))
    await page.reload()
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")

    const expectZeroOverflow = async (label: string) => {
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            document.documentElement.scrollWidth -
                            document.documentElement.clientWidth,
                    ),
                { message: label },
            )
            .toBe(0)
    }

    for (const state of ["expanded", "collapsed"] as const) {
        const current = await sidebar.getAttribute("data-state")
        if (current !== state) {
            await page
                .getByRole("button", {
                    name: state === "collapsed" ? "Collapse navigation" : "Expand navigation",
                })
                .click()
            await expect(sidebar).toHaveAttribute("data-state", state)
        }

        // HomePage: Cards & Compact across 768, 800, 867, 879
        await page.goto("/")
        await expect(page.locator("[data-server]")).toHaveCount(20)
        for (const width of [768, 800, 867, 879]) {
            await page.setViewportSize({ width, height: 900 })
            await page.getByRole("button", { name: "Cards", exact: true }).click()
            await expectZeroOverflow(`home cards ${width} ${state}`)

            await page.getByRole("button", { name: "Compact", exact: true }).click()
            await expect(page.locator(".fleet-table .server-row")).toHaveCount(20)
            await expectZeroOverflow(`home compact ${width} ${state}`)
            expect(
                await page.locator(".fleet-table").evaluate((el) => getComputedStyle(el).display),
                `fleet-table display ${width} ${state}`,
            ).toBe(state === "expanded" ? "block" : "table")
        }

        // NodePage: all 4 tabs across 768, 800, 867, 879
        await page.goto("/server/6")
        await expect(page.locator(".node-live-strip")).toBeVisible()
        for (const width of [768, 800, 867, 879]) {
            await page.setViewportSize({ width, height: 900 })
            await page.getByRole("tab", { name: "Overview", exact: true }).click()
            if (state === "expanded") {
                await expect(page.locator(".node-subtabs")).toBeVisible()
            } else {
                await expect(page.locator(".node-subtabs")).toBeHidden()
            }
            await expectZeroOverflow(`node overview ${width} ${state}`)

            await page.getByRole("tab", { name: "Load", exact: true }).click()
            await expect(page.locator(".chart svg")).toHaveCount(7)
            await expectZeroOverflow(`node load ${width} ${state}`)

            await page.getByRole("tab", { name: "Latency", exact: true }).click()
            await expect(page.locator(".node-ping-list button")).toHaveCount(3)
            await expectZeroOverflow(`node latency ${width} ${state}`)

            await page.getByRole("tab", { name: "Reporting history", exact: true }).click()
            await expect(page.getByText(/\d+(?:\.\d+)?% · \d+\/\d+ hours?/)).toBeVisible()
            await expectZeroOverflow(`node history ${width} ${state}`)
        }
    }

    await ctx.close()
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
    await page.locator('nav a[href="/"]').click()
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await page.getByRole("button", { name: "Sort", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "Name", exact: true }).click()
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-server]").first()).toContainText("Server 02")
    await page.getByRole("button", { name: "Language", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "日本語", exact: true }).click()
    await expect(page.getByRole("heading", { name: "概要", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "言語", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "繁體中文（台灣）", exact: true }).click()
    await expect(page.getByRole("heading", { name: "概覽", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "語言", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "English", exact: true }).click()
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
    ).toHaveCount(0)
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

test("sidebar groups follow server-group ID order rather than API order or node weight", async ({
    page,
}) => {
    await page.route("**/api/v1/server-group", (route) =>
        route.fulfill({
            json: {
                success: true,
                data: [
                    { group: { id: 7, name: "OTHER" }, servers: [2] },
                    { group: { id: 8, name: "HOME" }, servers: [3] },
                    { group: { id: 3, name: "Azure" }, servers: [4] },
                    { group: { id: 1, name: "Tencent" }, servers: [1, 4] },
                    { group: { id: 2, name: "AWS" }, servers: [5] },
                ],
            },
        }),
    )
    await page.routeWebSocket("**/api/v1/ws/server", (ws) => {
        const now = Date.now()
        const last_active = new Date(now).toISOString()
        // Nezha weight = -display_index, so weight order is Ungrouped, OTHER, HOME, AWS, Azure, Tencent.
        ws.send(
            JSON.stringify({
                now,
                servers: [
                    { id: 1, name: "Node Tencent", display_index: 1, last_active },
                    { id: 2, name: "Node Other", display_index: 400, last_active },
                    { id: 3, name: "Node Home", display_index: 300, last_active },
                    { id: 4, name: "Node Shared", display_index: 10, last_active },
                    { id: 5, name: "Node AWS", display_index: 200, last_active },
                    { id: 6, name: "Node Bare", display_index: 500, last_active },
                ],
            }),
        )
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(6)

    const groupLinks = page.locator('nav a[href^="/?group="]')
    await expect(groupLinks.locator(".nk-nav-label")).toHaveText([
        "Tencent",
        "AWS",
        "Azure",
        "OTHER",
        "HOME",
        "Ungrouped",
    ])
    await expect(groupLinks.locator(".nk-nav-badge")).toHaveText(["2", "1", "1", "1", "1", "1"])

    await groupLinks.nth(3).click()
    await expect(page).toHaveURL("/?group=OTHER")
    await expect(groupLinks.nth(3)).toHaveAttribute("aria-current", "page")
    await expect(page.locator("[data-server]")).toHaveCount(1)

    await page.goto("/server/4")
    await expect(page.getByText("Tencent · Azure", { exact: true })).toBeVisible()
})

test("navigation: clickable brand/topbar reset filters, back link preserves list URL and scroll, and in-page tabs replace history without scroll jump", async ({
    page,
    browser,
}) => {
    // 1. Mobile topbar-title from node page -> "/", and mobile drawer brand closes drawer + clears group/region/search
    await page.setViewportSize({ width: 375, height: 640 })
    await page.goto("/?region=HK")
    await expect(page.locator("[data-server]")).toHaveCount(6)
    await page.locator("[data-server] a").first().click()
    await expect(page).toHaveURL(/\/server\/\d+$/)
    await page.locator(".topbar-title").click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("[data-server]")).toHaveCount(20)

    await page.goto("/?region=HK")
    await page
        .locator(".section-heading")
        .getByRole("button", { name: "Search", exact: true })
        .click()
    await page.locator(".section-heading").getByRole("textbox", { name: "Search" }).fill("Server")
    await page.getByRole("button", { name: "Open navigation" }).click()
    await expect(page.locator(".nk-sidebar")).toHaveAttribute("data-state", "expanded")
    await page.locator(".nk-sidebar .brand").click()
    await expect(page.locator(".nk-sidebar")).toHaveAttribute("data-state", "collapsed")
    await expect(page.locator(".nk-sidebar")).toHaveAttribute("aria-hidden", "true")
    await expect(page).toHaveURL(/\/$/)
    await expect(
        page.locator(".section-heading").getByRole("textbox", { name: "Search" }),
    ).toHaveCount(0)
    await expect(page.locator("[data-server]")).toHaveCount(20)

    // 2. HomePage scroll behavior: region tab keeps scrollTop > 0, sidebar group resets scrollTop to 0
    const mainScrollTop = () =>
        page.evaluate(() => Math.round(document.querySelector(".nk-main")!.scrollTop))
    const scrollMainTo = (top: number) =>
        page.evaluate((y) => {
            document.querySelector(".nk-main")!.scrollTop = y
        }, top)

    await page.setViewportSize({ width: 1024, height: 640 })
    await page.goto("/")
    await expect(page.locator("[data-server]")).toHaveCount(20)
    await scrollMainTo(220)
    const beforeTabScroll = await mainScrollTop()
    expect(beforeTabScroll).toBeGreaterThan(150)
    await page.locator(".region-tabs").getByRole("tab", { name: /HK/ }).click()
    await expect(page).toHaveURL(/\/\?region=HK$/)
    expect(await mainScrollTop()).toBe(beforeTabScroll)

    await page.locator('nav a[href^="/?group="]').first().click()
    await expect(page).toHaveURL(/\/\?group=/)
    expect(await mainScrollTop()).toBe(0)

    // 3. Filtered list (?group=...&region=...) -> node -> Back link & Browser Back after 3 tab switches
    const listQuery = new URLSearchParams({ group: "🇺🇸 美国", region: "US" }).toString()
    await page.setViewportSize({ width: 1024, height: 420 })
    await page.goto(`/?${listQuery}`)
    await expect(page.locator("[data-server]")).toHaveCount(2)
    const cardLink = page.locator("[data-server] a").last()
    await cardLink.scrollIntoViewIfNeeded()
    const savedY = await mainScrollTop()
    expect(savedY).toBeGreaterThan(100)

    await cardLink.click()
    await expect(page).toHaveURL(/\/server\/\d+$/)

    const backLink = page.locator(".nk-context a")
    await expect(backLink).toContainText("Back to list")
    await expect(backLink).toHaveAttribute("href", `/?${listQuery}`)

    // Switch 3 tabs on node page: scroll stays > 0 and history is replaced, so 1 Back returns to list
    await expect(page.locator(".node-live-strip")).toBeVisible()
    await scrollMainTo(55)
    const nodeScrollY = await mainScrollTop()
    expect(nodeScrollY).toBeGreaterThan(40)
    await page.getByRole("tab", { name: "Load", exact: true }).click()
    await expect(page.locator(".chart svg")).toHaveCount(7)
    expect(await mainScrollTop()).toBe(nodeScrollY)
    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    await page.getByRole("tab", { name: "Reporting history", exact: true }).click()
    await expect(page).toHaveURL(/#history$/)

    await page.goBack()
    await expect(page).toHaveURL(
        new RegExp(`\\/\\?${listQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    )
    await expect.poll(mainScrollTop).toBeCloseTo(savedY, -1)

    // Clicking Back to list link also returns to the same filtered list and restores scrollTop
    await cardLink.click()
    await expect(page).toHaveURL(/\/server\/\d+$/)
    await page.locator(".nk-context a").click()
    await expect(page).toHaveURL(
        new RegExp(`\\/\\?${listQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    )
    await expect.poll(mainScrollTop).toBeCloseTo(savedY, -1)

    // 4. Direct entry to node page without prior list history falls back to "/"
    const directCtx = await browser.newContext({ viewport: { width: 1440, height: 700 } })
    const directPage = await directCtx.newPage()
    await mockNezha(directPage)
    await directPage.addInitScript(() => localStorage.setItem("nkt:language", "en"))
    await directPage.goto("/server/6")
    await expect(directPage.locator(".nk-context a")).toHaveAttribute("href", "/")
    await directCtx.close()
})

test("node sidebar peer switcher: lists group peers, keeps hash & range, respects group filter, rail & mobile drawer", async ({
    page,
    browser,
}) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await mockNezha(page, { loggedIn: true })
    await page.addInitScript(() => localStorage.setItem("nkt:language", "en"))

    // 1. Direct entry to /server/32 (🇭🇰 香港 group: 32, 35, 38 online + 44 offline)
    await page.goto("/server/32")
    const sidebarNav = page.locator('.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) nav')
    await expect(sidebarNav.locator('[data-sidebar="group-label"]')).toContainText("🇭🇰 香港 (4)")
    await expect(sidebarNav.locator("a")).toHaveCount(4)

    // Sidebar no longer has the 4 section links; page Tabs still work
    await expect(
        sidebarNav.locator('a[href$="#load"], a[href$="#latency"], a[href$="#history"]'),
    ).toHaveCount(0)
    await expect(sidebarNav.locator('a[aria-current="page"] .nk-nav-label')).toHaveText("Server 12")

    // Online vs offline peers have non-color-only distinction (data-status + sr-only label)
    const offlinePeer = sidebarNav.locator('a[href^="/server/44"]')
    await expect(offlinePeer.locator(".peer-badge")).toHaveAttribute("data-status", "offline")
    await expect(offlinePeer.locator(".sr-only")).toContainText("Offline")
    const onlinePeer = sidebarNav.locator('a[href^="/server/35"]')
    await expect(onlinePeer.locator(".peer-badge")).toHaveAttribute("data-status", "online")

    // 2. Switch page Tab to Latency + pick "7 d" range + scroll down, then click peer Server 13 (/server/35)
    await page.getByRole("tab", { name: "Latency", exact: true }).click()
    await expect(page).toHaveURL(/\/server\/32#latency$/)
    const range7d = page.getByRole("tab", { name: "7 d", exact: true })
    await range7d.click()
    await expect(range7d).toHaveAttribute("aria-selected", "true")
    await page.setViewportSize({ width: 1440, height: 420 })
    await page.evaluate(() => {
        document.querySelector(".nk-main")!.scrollTop = 120
    })
    expect(
        await page.evaluate(() => document.querySelector(".nk-main")!.scrollTop),
    ).toBeGreaterThan(50)

    await onlinePeer.click()
    await expect(page).toHaveURL(/\/server\/35#latency$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Server 13")
    expect(await page.evaluate(() => document.querySelector(".nk-main")!.scrollTop)).toBe(0)
    await expect(sidebarNav.locator('a[aria-current="page"] .nk-nav-label')).toHaveText("Server 13")
    // Range state ("7 d") is preserved across peer navigation
    await expect(page.getByRole("tab", { name: "7 d", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
    )
    // Peer switch pushed history: browser Back returns to /server/32#latency
    await page.goBack()
    await expect(page).toHaveURL(/\/server\/32#latency$/)

    // 3. Dual-group node (/server/31 belongs to both "🇨🇳 中国" id=4 and "Missuo" id=7):
    // Direct entry uses lower group ID ("🇨🇳 中国"), whereas entering from /?group=Missuo uses "Missuo"
    await page.setViewportSize({ width: 1440, height: 800 })
    await page.goto("/server/31")
    await expect(sidebarNav.locator('[data-sidebar="group-label"]')).toContainText("🇨🇳 中国 (5)")

    await page.goto("/?group=Missuo")
    await page.locator('[data-server="31"] a').first().click()
    await expect(page).toHaveURL(/\/server\/31$/)
    await expect(sidebarNav.locator('[data-sidebar="group-label"]')).toContainText("Missuo (1)")

    // 4. Ungrouped node (/server/41) lists All nodes (20), scrolls active peer into view, keeps Back & Live visible
    await page.setViewportSize({ width: 1440, height: 420 })
    await page.goto("/server/41")
    await expect(sidebarNav.locator('[data-sidebar="group-label"]')).toContainText("All nodes (20)")
    await expect
        .poll(() =>
            page.evaluate(() => {
                const active = document.querySelector(
                    '.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) nav a[aria-current="page"]',
                )
                const vp = active?.closest('[data-sidebar="viewport"]')
                const ctx = document.querySelector(".nk-sidebar .nk-context")
                const footer = document.querySelector(".nk-sidebar-footer")
                if (!active || !vp || !ctx || !footer) return false
                const ar = active.getBoundingClientRect()
                const vr = vp.getBoundingClientRect()
                const cr = ctx.getBoundingClientRect()
                const fr = footer.getBoundingClientRect()
                return (
                    ar.top >= cr.bottom - 1 &&
                    ar.bottom <= vr.bottom + 1 &&
                    cr.top >= 0 &&
                    fr.bottom <= window.innerHeight + 1
                )
            }),
        )
        .toBe(true)

    // 5. Desktop collapsed rail: keeps node name as title and switches node on click
    await page.setViewportSize({ width: 1440, height: 800 })
    await page.goto("/server/32#latency")
    await page.getByRole("button", { name: "Collapse navigation" }).click()
    await expect(page.locator("aside.nk-sidebar")).toHaveAttribute("data-state", "collapsed")
    await expect(sidebarNav.locator('li[data-sidebar="menu-item"][title="Server 13"]')).toHaveCount(
        1,
    )
    await sidebarNav.locator('a[href="/server/35#latency"]').click()
    await expect(page).toHaveURL(/\/server\/35#latency$/)

    // 6. Mobile 375 drawer: clicking a peer switches node and closes the drawer
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobileCtx.newPage()
    await mockNezha(mobilePage)
    await mobilePage.addInitScript(() => localStorage.setItem("nkt:language", "en"))
    await mobilePage.goto("/server/32#latency")
    await mobilePage.getByRole("button", { name: "Open navigation" }).click()
    const mobileDrawer = mobilePage.locator(".nk-sidebar[data-mobile]")
    await expect(mobileDrawer).toHaveAttribute("data-state", "expanded")
    await mobileDrawer.locator('nav a[href="/server/35#latency"]').click()
    await expect(mobilePage).toHaveURL(/\/server\/35#latency$/)
    await expect(mobileDrawer).toHaveAttribute("data-state", "collapsed")
    await mobileCtx.close()
})

test("VPS group icons follow the effective theme and keep a failed slug on the folder", async ({
    page,
}) => {
    let missingRequests = 0
    await page.route("**/vps-icons/**/missing-provider.svg", (route) => {
        missingRequests++
        return route.fulfill({ status: 404, body: "" })
    })
    await mockNezha(page, {
        customCode:
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"vps:aws","2":"vps:missing-provider"}</script>',
    })
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/")
    const image = page.locator('.nk-nav-link:has([title="🛜 宽带"]) img')
    const checkImage = async (mode: string) => {
        await expect(image).toHaveAttribute("src", `/vps-icons/v1.4.0/${mode}/aws.svg`)
        await expect
            .poll(() =>
                image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
            )
            .toBe(true)
        await expect(image).toHaveCSS("opacity", "1")
    }
    await checkImage("light")
    await expect.poll(() => missingRequests).toBe(1)
    await expect(
        page.locator('.nk-nav-link:has([title="🏠 HomeLab"]) .nk-nav-icon svg'),
    ).toBeVisible()
    await page.emulateMedia({ colorScheme: "dark" })
    await checkImage("dark")
    await page.emulateMedia({ colorScheme: "light" })
    await checkImage("light")
    await page.getByRole("button", { name: "Appearance", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click()
    await checkImage("dark")
    expect(missingRequests).toBe(1)
})
