import { type Page, test as base, chromium, expect, webkit } from "@playwright/test"

async function mockAdmin(page: Page, resources: Record<string, unknown> = {}) {
    await page.addInitScript(() => localStorage.setItem("language", "en"))
    const data: Record<string, unknown> = {
        profile: { id: 1, role: 0, username: "operator" },
        setting: {
            config: {
                site_name: "Test",
                language: "en-US",
                cover: 0,
                ignored_ip_notification: "99,7",
                ip_change_notification_group_id: 0,
                user_template: "user-dist",
            },
        },
        server: [
            { id: 7, name: "Tokyo" },
            { id: 8, name: "Taipei" },
        ],
        ...resources,
    }
    await page.route("**/api/v1/**", (route) =>
        route.fulfill({
            json: {
                success: true,
                data: data[new URL(route.request().url()).pathname.replace("/api/v1/", "")] ?? [],
            },
        }),
    )
}

for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    const test = base.extend({
        page: async ({ baseURL }, runTest) => {
            const browser = await driver.launch()
            try {
                await runTest(
                    await browser.newPage({ baseURL, viewport: { width: 375, height: 667 } }),
                )
            } finally {
                await browser.close()
            }
        },
    })
    test.describe(engine, () => {
        test("NAT replaces one server by name and submits its numeric ID", async ({ page }) => {
            await mockAdmin(page, {
                nat: [
                    {
                        id: 1,
                        name: "Test NAT",
                        server_id: 99,
                        enabled: true,
                        host: "localhost:80",
                        domain: "example.test",
                    },
                ],
            })
            const serverRequests: string[] = []
            page.on("request", (request) => {
                if (new URL(request.url()).pathname === "/api/v1/server")
                    serverRequests.push(request.method())
            })
            await page.goto("/dashboard/nat")
            await expect(page.getByRole("cell", { name: /Test NAT/ })).toBeVisible()
            expect(serverRequests).toEqual([])
            await page.getByRole("button", { name: "Actions", exact: true }).first().click()
            await page.getByRole("button", { name: "Edit", exact: true }).first().click()
            const server = page
                .getByRole("dialog")
                .getByRole("button", { name: "Server", exact: true })
            await expect(server).toContainText("#99")
            await server.locator(".lucide-chevron-down").click()
            await page.getByPlaceholder("Search").fill("tai")
            await expect(page.getByRole("option", { name: "Tokyo" })).toHaveCount(0)
            await page.getByRole("option", { name: "Taipei" }).click()
            await expect(server).toHaveText("Taipei")
            expect(serverRequests).toEqual(["GET"])
            const saved = page.waitForRequest((r) => r.method() === "PATCH")
            await page.getByRole("button", { name: "Confirm", exact: true }).click()
            expect((await saved).postDataJSON().server_id).toBe(8)
        })

        test("token scope sends selected numeric IDs and omits an empty restriction", async ({
            page,
        }) => {
            await mockAdmin(page)
            await page.goto("/dashboard/settings/api-tokens")
            for (const restricted of [true, false]) {
                await page.getByRole("button", { name: "Create API token" }).click()
                const dialog = page.getByRole("dialog")
                await dialog.getByLabel("Name", { exact: true }).fill("Test")
                await dialog
                    .getByRole("checkbox", { name: "nezha:server:read", exact: true })
                    .click()
                const server = dialog.locator("button#server-ids")
                await expect(server).toBeVisible()
                if (restricted) {
                    await server.press("Enter")
                    await page.getByRole("option", { name: "Tokyo" }).click()
                    await page.getByRole("option", { name: "Taipei" }).click()
                    await page.keyboard.press("Escape")
                }
                const saved = page.waitForRequest((r) => r.method() === "POST")
                await dialog.getByRole("button", { name: "Create API token" }).click()
                expect((await saved).postDataJSON().server_ids).toEqual(
                    restricted ? [7, 8] : undefined,
                )
                await page.reload()
            }
        })

        test("IP change coverage has a label and preserves unavailable servers in its CSV", async ({
            page,
        }) => {
            await mockAdmin(page)
            await page.goto("/dashboard/settings")
            const coverage = page.getByRole("combobox", { name: "Coverage", exact: true })
            await expect(coverage).not.toHaveText("")
            await coverage.click()
            await page.getByRole("option", { name: "Only Specific Servers" }).click()
            await expect(coverage).toHaveText("Only Specific Servers")
            const servers = page.getByRole("button", { name: "Specific server", exact: true })
            await expect(servers).toContainText("#99")
            await expect(servers).toContainText("Tokyo")
            await servers.press("Enter")
            await page.getByRole("option", { name: "Taipei" }).click()
            await page.keyboard.press("Escape")
            const saved = page.waitForRequest((r) => r.method() === "PATCH")
            await page.getByRole("button", { name: "Confirm", exact: true }).click()
            expect((await saved).postDataJSON()).toMatchObject({
                cover: 2,
                ignored_ip_notification: "99,7,8",
            })
        })

        test("server group members use loaded names and keep unresolved IDs", async ({ page }) => {
            await mockAdmin(page, {
                "server-group": [{ group: { id: 1, name: "Edges" }, servers: [7, 99] }],
            })
            await page.setViewportSize({ width: 1440, height: 900 })
            await page.goto("/dashboard/server-group")
            await expect(page.locator("tbody td[data-col=servers]")).toHaveText("Tokyo, #99")
        })
    })
}
