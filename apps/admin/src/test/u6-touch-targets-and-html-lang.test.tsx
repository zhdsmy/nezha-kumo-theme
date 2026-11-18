import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/xui/icon-button"
import i18n from "@/lib/i18n"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"

afterEach(async () => {
    cleanup()
    await i18n.changeLanguage("en")
})

describe("U6: document.documentElement.lang synchronization and 44px mobile icon touch targets", () => {
    test("switching i18n language updates document.documentElement.lang across all 4 supported locales", async () => {
        for (const lng of ["zh-CN", "zh-TW", "ja", "en"] as const) {
            await i18n.changeLanguage(lng)
            expect(document.documentElement.lang).toBe(lng)
        }
    })

    test("size=icon Buttons and IconButtons carry nkt-icon-btn and mobile CSS enforces 2.75rem (44px) hit targets", async () => {
        render(
            <div>
                <IconButton icon="plus" />
                <Button size="icon" aria-label="Row details" className="nkt-details-toggle" />
            </div>,
        )

        const createBtn = screen.getByRole("button", { name: i18n.t("Create") })
        const detailsBtn = screen.getByRole("button", { name: "Row details" })
        expect(createBtn.className).toContain("nkt-icon-btn")
        expect(detailsBtn.className).toContain("nkt-icon-btn")

        const fsMod = "node:" + "fs"
        const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as {
            readFileSync: (file: string, encoding: string) => string
        }
        const css = readFileSync("src/index.css", "utf8")
        expect(css).toMatch(/\.nkt-icon-btn\s*\{[^}]*2\.75rem/)
        expect(css).toMatch(
            /\.nkt-table\s+:is\(\.nkt-details-toggle,\s*\.nkt-actions-toggle\)\s*\{[^}]*2\.75rem/,
        )
    })
})
