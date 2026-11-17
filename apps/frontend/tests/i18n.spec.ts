import { expect, test } from "@playwright/test"

import { mockNezha } from "./mock"

const ALLOWED_PROPER_NOUN =
    /^(Nezha|Kumo|IPv4|IPv6|CPU|GPU|RAM|TCP|UDP|HTTP|HTTPS|DNS|SSH|VPS|Tokyo|Frankfurt|Singapore| Virginia|Ashburn|us-|eu-|ap-|hk-|jp-|de-|sg-)/i

function hasUnexpectedEnglishUiCopy(text: string, nodeNames: string[]): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    for (const name of nodeNames) {
        if (name && trimmed.includes(name)) return false
    }
    // Strip allowed proper nouns and keyboard shortcuts before checking for Latin words
    const cleaned = trimmed
        .replace(/\b(Nezha|Kumo|IPv4|IPv6|CPU|GPU|RAM|OS|Esc|⌘K|Ctrl\+K|GB|MB|KB|TB|ms|s)\b/gi, "")
        .trim()
    if (!cleaned || ALLOWED_PROPER_NOUN.test(cleaned)) return false
    return /[A-Za-z]{3,}/.test(cleaned)
}

test("zh-CN interface localizes screen-reader labels, tooltips, placeholders, and Kumo chrome", async ({
    page,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem("nkt:language", "zh-CN")
    })
    await mockNezha(page)

    let releaseLogin!: () => void
    const loginGate = new Promise<void>((r) => {
        releaseLogin = r
    })
    await page.route(
        "**/api/v1/login",
        async (route) => {
            await loginGate
            await route.fallback()
        },
        { times: 1 },
    )

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")
    await expect(page.locator("[data-server]").first()).toBeVisible()

    // Uptime and footnote are localized in zh-CN
    await expect(page.locator(".card-facts").first()).toContainText(/天.*小时.*分/)
    await expect(page.locator(".page-footnote")).toHaveText("Nezha · Kumo 主题")

    // Mobile drawer <nav> uses localized shell.mainNav instead of Kumo's hardcoded "Navigation"
    await page.locator(".nk-drawer-trigger").click()
    const mobileDrawer = page.locator('.nk-sidebar[data-mobile="true"]')
    await expect(mobileDrawer).toBeVisible()
    await expect(mobileDrawer).toHaveAttribute("aria-label", "主导航")
    await mobileDrawer.locator('button[aria-label="关闭导航"]').click()
    await expect(mobileDrawer).toHaveAttribute("data-state", "collapsed")

    // Login dialog busy spinner uses localized auth.submitting instead of Kumo's "Loading"
    await page.locator('.nk-topbar-actions button[aria-label="登录"]').click()
    const loginDialog = page.getByRole("dialog")
    await expect(loginDialog).toBeVisible()
    await loginDialog.getByLabel("用户名").fill("admin")
    await loginDialog.getByLabel("密码").fill("secret")
    const submitBtn = loginDialog.locator('button[type="submit"]')
    await submitBtn.click()
    await expect(submitBtn).toHaveAttribute("aria-label", "正在登录…")
    await expect(submitBtn.locator('svg[role="status"]')).toHaveAttribute("aria-label", "正在登录…")
    releaseLogin()
    await expect(loginDialog).toBeHidden()

    // Node latency shave Switch tooltip trigger uses localized ui.moreInfo instead of "More information"
    await page.goto("/server/6#latency")
    await expect(page.getByRole("switch")).toBeVisible()
    const infoTrigger = page.locator('.section-heading button[aria-label="更多信息"]')
    await expect(infoTrigger).toBeVisible()
    await expect(page.locator('[aria-label="More information"]')).toHaveCount(0)

    // Collect all aria-label, title, and placeholder attributes on the rendered zh-CN page
    const { attrs, names } = await page.evaluate(() => {
        const nodeNames = Array.from(document.querySelectorAll(".nk-sidebar nav a")).map(
            (el) => el.textContent?.trim() ?? "",
        )
        const out: string[] = []
        for (const el of document.querySelectorAll("[aria-label], [title], [placeholder]")) {
            for (const attr of ["aria-label", "title", "placeholder"] as const) {
                const v = el.getAttribute(attr)
                if (v) out.push(`${el.tagName.toLowerCase()}[${attr}="${v}"]`)
            }
        }
        return { attrs: out, names: nodeNames }
    })

    const leaked = attrs.filter((entry) => {
        const val = entry.match(/="(.*)"$/)?.[1] ?? ""
        return hasUnexpectedEnglishUiCopy(val, names)
    })
    expect(leaked).toEqual([])
})
