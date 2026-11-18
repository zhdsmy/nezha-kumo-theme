import { chromium, expect, test, webkit } from "@playwright/test"

for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    for (const resource of ["nat", "alert-rule"] as const) {
        test(`${engine} reopens ${resource} with the last saved row and discards cancelled edits`, async ({
            baseURL,
        }) => {
            const browser = await driver.launch()
            try {
                const page = await browser.newPage({
                    baseURL,
                    viewport: { width: 1440, height: 900 },
                    locale: "en",
                })
                const rule = { type: "cpu", cover: 0, duration: 10 }
                const record =
                    resource === "nat"
                        ? {
                              id: 1,
                              name: "Original",
                              server_id: 7,
                              host: "localhost:80",
                              domain: "example.test",
                              enabled: true,
                          }
                        : {
                              id: 1,
                              name: "Original",
                              rules: [rule],
                              trigger_mode: 0,
                              notification_group_id: 0,
                          }
                const data: Record<string, unknown> = {
                    profile: { id: 1, username: "operator", role: 0 },
                    setting: { config: { site_name: "Test", language: "en-US" } },
                    server: [
                        { id: 7, name: "Tokyo" },
                        { id: 8, name: "Taipei" },
                    ],
                    [resource]: [record],
                }
                const writes: unknown[] = []
                await page.route("**/api/v1/**", (route) => {
                    const key = new URL(route.request().url()).pathname.slice(8)
                    if (route.request().method() === "PATCH" && key === resource + "/1") {
                        const body = route.request().postDataJSON()
                        writes.push(body)
                        Object.assign(record, body)
                    }
                    return route.fulfill({ json: { success: true, data: data[key] ?? [] } })
                })

                await page.goto("/dashboard/" + resource)
                const row = page.locator("tbody tr").first()
                const edit = row.getByRole("button", { name: "Edit", exact: true })
                const dialog = page.getByRole("dialog")
                const name = dialog.getByLabel("Name", { exact: true })
                const server = dialog.getByRole("button", { name: "Server", exact: true })
                const json = dialog.getByLabel("Advanced JSON")
                for (const [index, newName] of ["First save", "Second save"].entries()) {
                    await edit.click()
                    await expect(name).toHaveValue(index === 0 ? "Original" : "First save")
                    await name.fill(newName)
                    if (resource === "nat") {
                        await expect(server).toHaveText(index === 0 ? "Tokyo" : "Taipei")
                        await server.press("Enter")
                        await page
                            .getByRole("option", { name: index === 0 ? "Taipei" : "Tokyo" })
                            .click()
                    } else {
                        expect(JSON.parse(await json.inputValue())[0].duration).toBe(
                            index === 0 ? 10 : 20,
                        )
                        await json.fill(
                            JSON.stringify([{ ...rule, duration: index === 0 ? 20 : 30 }]),
                        )
                    }
                    await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
                    await expect(row).toContainText(newName)
                    expect(writes[index]).toMatchObject(
                        resource === "nat"
                            ? { name: newName, server_id: index === 0 ? 8 : 7 }
                            : {
                                  name: newName,
                                  rules: [{ ...rule, duration: index === 0 ? 20 : 30 }],
                              },
                    )
                }
                await edit.click()
                await name.fill("Discard me")
                if (resource === "alert-rule") await json.fill("[]")
                await dialog
                    .locator("form")
                    .getByRole("button", { name: "Close", exact: true })
                    .click()
                await edit.click()
                await expect(name).toHaveValue("Second save")
                if (resource === "alert-rule")
                    await expect(dialog.locator("#alert-rule-0-ignore")).toBeVisible()
                await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
                await expect(dialog).toHaveCount(0)
                expect(writes).toHaveLength(3)
                expect(writes[2]).toEqual(writes[1])
            } finally {
                await browser.close()
            }
        })
    }
}
