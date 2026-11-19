import { type Locator, type Page, expect, test } from "@playwright/test"

const name = "AsiaPacificProductionCluster".repeat(6)

async function mockDashboard(page: Page, lang = "en", signedIn = true) {
    await page.addInitScript((language) => localStorage.setItem("language", language), lang)
    await page.route("**/api/v1/**", (route) => {
        const path = new URL(route.request().url()).pathname.slice(8)
        const data =
            path === "profile"
                ? { id: 1, role: 0, username: "fixture" }
                : path === "setting"
                  ? { config: { site_name: "Fixture", language: lang } }
                  : path === "server-group"
                    ? [{ group: { id: 1, name: "Group" }, servers: [1, 2] }]
                    : path === "server"
                      ? ["Tokyo", name].map((name, index) => ({
                            id: index + 1,
                            name,
                            host: {},
                            display_index: 10,
                            public_note: JSON.stringify({
                                billingDataMod: { autoRenewal: "1", cycle: "Year" },
                            }),
                        }))
                      : path.includes("mcp/oauth")
                        ? { items: [], total: 0 }
                        : []
        return route.fulfill({ json: { success: path !== "profile" || signedIn, data } })
    })
}

async function box(control: Locator) {
    return control.evaluate((el) => el.getBoundingClientRect().toJSON())
}
async function openEditor(page: Page) {
    await page.locator(".nkt-actions-toggle").first().click()
    await page
        .locator(".nkt-table-actions")
        .first()
        .locator("button:has(.lucide-pen)")
        .first()
        .click()
    return page.getByRole("dialog")
}

test("A02 CSS alone keeps name, actions and document within the folded width", async ({ page }) => {
    await mockDashboard(page)
    await page.setViewportSize({ width: 1440, height: 800 })
    await page.goto("/dashboard/")
    await expect(page.getByText("Tokyo", { exact: true }).first()).toBeVisible()
    await page.setViewportSize({ width: 952, height: 800 })
    const row = page.locator(".nkt-table tbody tr").first()
    const uuid = row.locator('[data-col="uuid"]')
    await expect(uuid).toBeHidden()
    await row.locator(".nkt-details-toggle").click()
    await expect(uuid).toBeVisible()
    expect((await box(uuid)).top).toBeGreaterThanOrEqual(
        (await box(row.locator("[data-primary]"))).bottom,
    )
    await row.locator(".nkt-details-toggle").click()
    await page.setViewportSize({ width: 1440, height: 800 })
    const html = await page.evaluate(() => {
        const copy = document.documentElement.cloneNode(true) as HTMLElement
        copy.querySelectorAll("script,link[rel=modulepreload]").forEach((el) => el.remove())
        return "<!doctype html>" + copy.outerHTML
    })
    await page.route("**/dashboard/frozen", (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
    )
    await page.goto("/dashboard/frozen")
    for (const width of [952, 375, 1280]) {
        await page.setViewportSize({ width, height: 800 })
        const main = page.locator(".nk-main")
        expect.soft(await main.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0)
        const row = page.locator(".nkt-table tbody tr").first()
        const title = await box(row.locator(".nkt-server-name"))
        const actions = await box(
            row.locator(width < 768 ? ".nkt-actions-toggle" : ".nkt-table-actions"),
        )
        expect.soft(title.width).toBeGreaterThan(40)
        expect.soft(title.right).toBeLessThanOrEqual(actions.left)
        expect.soft(actions.right).toBeLessThanOrEqual((await box(main)).right)
    }
})

for (const lang of ["en", "zh-CN", "zh-TW", "ja"]) {
    test(`A03 X08 selected name fits before its remove icon in ${lang}`, async ({ page }) => {
        await mockDashboard(page, lang)
        await page.setViewportSize({ width: 375, height: 800 })
        await page.goto("/dashboard/server-group")
        const dialog = await openEditor(page)
        const label = dialog.locator("button span[title]").filter({ hasText: name }).first()
        const icon = label.locator("..").locator("svg.lucide-x")
        const limits = await label.evaluate((el) => {
            const clip = el.closest(".overflow-hidden")!
            return {
                edge: clip.getBoundingClientRect().right,
                start: el.closest("button")!.getBoundingClientRect().left,
                truncated: el.scrollWidth > el.clientWidth,
            }
        })
        expect.soft((await box(icon)).right - limits.edge).toBeLessThanOrEqual(0)
        expect.soft(limits.truncated).toBe(true)
        await icon.click()
        await expect(label).toHaveCount(0)
        const chip = dialog.locator("button span[title]").filter({ hasText: "Tokyo" }).first()
        expect.soft((await box(chip)).left - limits.start).toBeLessThanOrEqual(13)
        expect((await box(chip.locator("xpath=ancestor::button[1]"))).height).toBe(36)
    })
}

test("A04 X02 X03 X04 A05 A06 header targets, search contrast and billing alignment", async ({
    page,
}) => {
    await mockDashboard(page)
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto("/dashboard/")
    const search = page.getByRole("searchbox")
    await expect(search).toBeVisible()
    const ratio = await search.evaluate((el) => {
        const ctx = document.createElement("canvas").getContext("2d")!
        function luminance(color: string) {
            ctx.fillStyle = color
            ctx.fillRect(0, 0, 1, 1)
            const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data)
                .slice(0, 3)
                .map((v) => v / 255)
            const [r, g, b] = rgb.map((v) =>
                v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            )
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        return (
            (luminance(getComputedStyle(el).backgroundColor) + 0.05) /
            (luminance(getComputedStyle(el, "::placeholder").color) + 0.05)
        )
    })
    expect.soft(ratio).toBeGreaterThanOrEqual(4.5)
    for (const control of await page
        .locator(".nk-topbar :is(button,a[aria-label]):visible")
        .all()) {
        const r = await box(control)
        expect.soft(r.height).toBe(44)
        expect.soft(r.width).toBe(r.height)
    }
    const toolbar = page.locator(".nk-page-actions button:visible")
    const first = await box(toolbar.first()),
        last = await box(toolbar.last())
    expect.soft(last.height).toBe(first.height)
    const neighbor = await box(toolbar.nth(1))
    expect.soft(neighbor.top).toBe(first.top)
    const dialog = await openEditor(page)
    const close = await box(dialog.locator("button:has(> .lucide-x)").last())
    const title = await box(dialog.getByRole("heading").first())
    expect.soft(close.width).toBeGreaterThanOrEqual(44)
    expect.soft(close.height).toBeGreaterThanOrEqual(44)
    expect
        .soft(Math.abs((close.top + close.bottom - title.top - title.bottom) / 2))
        .toBeLessThanOrEqual(1)
    for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 800 })
        for (const field of ["autoRenewal", "cycle"]) {
            const parent = dialog.locator(`[data-note-field="${field}"]`)
            const clear = await box(parent.locator(".nkt-note-clear")),
                label = await box(parent.locator(".nkt-note-label"))
            expect
                .soft(Math.abs((clear.top + clear.bottom - label.top - label.bottom) / 2))
                .toBeLessThanOrEqual(1)
        }
    }
})

test("X09 topbar menus use matching checked rows and trailing indicators", async ({ page }) => {
    await mockDashboard(page)
    await page.goto("/dashboard/")
    const heights = []
    for (const name of ["Theme", "Language"]) {
        await page.getByRole("button", { name, exact: true }).click()
        const menu = page.getByRole("menu")
        await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
        const item = menu.locator('[role^="menuitem"]').first()
        heights.push((await box(item)).height)
        const selected = menu.locator("[aria-checked=true]")
        expect.soft(await selected.count()).toBe(1)
        if (await selected.count()) {
            const mark = await box(selected.locator("svg"))
            expect.soft(mark.width).toBe(16)
            expect.soft((await box(selected)).right - mark.right).toBeLessThanOrEqual(9)
        }
        await page.keyboard.press("Escape")
    }
    expect(Math.abs(heights[0] - heights[1])).toBeLessThan(0.1)
})

test("X07 MCP tabs and login password target", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await mockDashboard(page)
    await page.goto("/dashboard/settings/mcp-oauth")
    const tabs = page.getByRole("tablist")
    const tab = await box(tabs.getByRole("tab").first()),
        rail = await box(tabs)
    expect.soft(tab.height).toBeGreaterThanOrEqual(44)
    expect.soft(Math.abs(tab.top - rail.top - (rail.bottom - tab.bottom))).toBeLessThanOrEqual(1)
    await mockDashboard(page, "en", false)
    await page.goto("/dashboard/login")
    const eye = page.locator("button:has(.lucide-eye)")
    const r = await box(eye)
    expect.soft(r.width).toBeGreaterThanOrEqual(44)
    expect.soft(r.height).toBeGreaterThanOrEqual(44)
    await eye.click()
    await expect(page.locator('input[autocomplete="current-password"]')).toHaveAttribute(
        "type",
        "text",
    )
})

test("VPS icon picker searches localized names and aliases and saves the selected slug", async ({ page }) => {
    await mockDashboard(page)
    await page.setViewportSize({ width: 375, height: 800 })
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/dashboard/server-group")
    const dialog = await openEditor(page)
    const trigger = dialog.getByRole("combobox", { name: "Choose a VPS icon" })
    await trigger.press("Enter")
    const search = page.getByPlaceholder("Search providers")
    await search.fill("腾讯云")
    await expect(page.getByRole("option")).toHaveCount(1)
    await expect(page.getByRole("option")).toHaveText("Tencent Cloud")
    await search.fill("LIGHTSAIL")
    const option = page.getByRole("option", { name: "Amazon Web Services" })
    await expect(option).toBeVisible()
    for (const target of [trigger, search, option]) {
        const rect = await box(target)
        expect(rect.width).toBeGreaterThanOrEqual(44)
        expect(rect.height).toBeGreaterThanOrEqual(44)
    }
    const mark = await box(option.locator("img"))
    const name = await box(option.getByText("Amazon Web Services", { exact: true }))
    expect(mark.right).toBeLessThan(name.left)
    expect(Math.abs((mark.top + mark.bottom - name.top - name.bottom) / 2)).toBeLessThanOrEqual(1)
    await search.press("ArrowDown")
    await search.press("Enter")
    await expect(dialog.getByLabel("Icon", { exact: true })).toHaveValue("vps:aws")
    const preview = dialog.getByTestId("group-icon-preview").locator("img")
    for (const mode of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: mode })
        await expect(preview).toHaveAttribute("src", `/dashboard/vps-icons/v1.0.0/${mode}/aws.svg`)
        await expect.poll(() => preview.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    }
    const save = page.waitForRequest((r) => r.method() === "PATCH" && r.url().endsWith("/api/v1/setting"))
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
    expect((await save).postDataJSON().custom_code).toContain('"1":"vps:aws"')
})
