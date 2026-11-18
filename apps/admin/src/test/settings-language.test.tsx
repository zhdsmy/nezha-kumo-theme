import i18n from "@/lib/i18n"
import SettingsPage from "@/routes/settings"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const h = vi.hoisted(() => ({
    data: {
        config: {
            site_name: "Synthetic panel",
            language: "en_US",
            user_template: "user-dist",
            cover: 1,
            ip_change_notification_group_id: 0,
        },
        frontend_templates: [],
    },
    update: vi.fn(),
}))
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { role: 0 }, loading: false }) }))
vi.mock("@/hooks/useNotfication", () => ({ useNotification: () => ({ notifierGroup: [] }) }))
vi.mock("@/hooks/useSetting", () => ({ default: () => ({ data: h.data, mutate: vi.fn() }) }))
vi.mock("@/api/settings", () => ({ updateSettings: (...args: unknown[]) => h.update(...args) }))

afterEach(cleanup)
beforeEach(async () => {
    h.update.mockReset().mockResolvedValue(undefined)
    h.data.config.language = "en_US"
    await i18n.changeLanguage("en")
})

async function showSettings() {
    await act(async () => {
        render(
            <MemoryRouter>
                <SettingsPage />
            </MemoryRouter>,
        )
    })
}

test("notification en_US displays English and saves en-US without switching the interface", async () => {
    await showSettings()
    const language = screen.getByRole("combobox", { name: "Language" })
    expect(language.textContent).toContain("English")
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Confirm/i }))
    })
    await waitFor(() =>
        expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ language: "en-US" })),
    )
    expect(i18n.resolvedLanguage).toBe("en")
})

test("Hong Kong interface keeps the backend notification language independent", async () => {
    h.data.config.language = "zh_TW"
    await i18n.changeLanguage("zh-HK")
    await showSettings()
    const language = screen.getByRole("combobox", { name: i18n.t("Language") })
    expect(language.textContent).toContain("台灣")
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: i18n.t("Confirm") }))
    })
    await waitFor(() =>
        expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ language: "zh-TW" })),
    )
    expect(i18n.resolvedLanguage).toBe("zh-HK")
})

test.each([
    ["ja_JP", "日本語"],
    ["ru_RU", "Русский"],
])("notification %s remains available independently of UI locales", async (code, label) => {
    h.data.config.language = code
    await showSettings()
    expect(screen.getByRole("combobox", { name: "Language" }).textContent).toContain(label)
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Confirm/i }))
    })
    await waitFor(() =>
        expect(h.update).toHaveBeenCalledWith(
            expect.objectContaining({ language: code.replace("_", "-") }),
        ),
    )
    expect(i18n.resolvedLanguage).toBe("en")
})

test.each([
    ["ja-JP", "日本語"],
    ["ru-RU", "English"],
    ["zh-HK", "繁體中文（香港）"],
    ["zh-TW", "繁體中文（台灣）"],
])("interface menu marks the resolved language for %s", async (saved, label) => {
    await i18n.changeLanguage(saved)
    const { AdminActions } = await import("@/components/admin-shell")
    await act(async () => {
        render(
            <MemoryRouter>
                <AdminActions />
            </MemoryRouter>,
        )
    })
    const trigger = screen.getByRole("button", { name: i18n.t("Language") })
    fireEvent.keyDown(trigger, { key: "Enter" })
    const current = await screen.findByRole("menuitemradio", { name: label })
    expect(current.getAttribute("aria-checked")).toBe("true")
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(5)
})
