import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

test("R2-FE05 contains focus while search loads and transfers it to the palette", async ({
    page,
    browserName,
}) => {
    await mockNezha(page)
    let release!: () => void
    const held = new Promise<void>((r) => {
        release = r
    })
    await page.route("**/src/components/SearchPalette.tsx*", async (route) => {
        await held
        await route.continue()
    })
    await page.goto("/")
    await expect(page.locator(".server-card").first()).toBeVisible()
    const trigger = page.locator(".sidebar-search")
    await trigger.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", { name: "Search", exact: true })
    await expect(dialog).toBeVisible()
    const focusedInside = () =>
        page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
    await expect.poll(focusedInside).toBe(true)
    for (const key of ["Tab", "Tab", "Shift+Tab", "Tab"]) {
        await page.keyboard.press(browserName === "webkit" ? `Alt+${key}` : key)
        await expect.poll(focusedInside).toBe(true)
    }
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(dialog).toBeVisible()
    release()
    const input = page.getByRole("combobox", { name: "Search", exact: true })
    await expect(input).toBeFocused()
    await input.fill("Server 02")
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/server\/25$/)
})
