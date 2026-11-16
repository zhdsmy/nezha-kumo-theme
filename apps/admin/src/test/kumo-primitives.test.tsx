import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.removeAttribute("data-mode")
    document.documentElement.classList.remove("light", "dark")
    vi.restoreAllMocks()
})

function ThemeButton() {
    const { setTheme } = useTheme()
    return <button onClick={() => setTheme("dark")}>Dark</button>
}

test("theme selection activates Kumo tokens and the existing dark utilities together", () => {
    render(
        <ThemeProvider defaultTheme="light">
            <ThemeButton />
        </ThemeProvider>,
    )
    expect(document.documentElement.dataset.mode).toBe("light")
    fireEvent.click(screen.getByRole("button", { name: "Dark" }))
    expect(document.documentElement.dataset.mode).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark")
})

test("batch selection retains mixed state and can select the remaining rows", () => {
    const onCheckedChange = vi.fn()
    render(
        <Checkbox
            aria-label="Select all"
            checked="indeterminate"
            onCheckedChange={onCheckedChange}
        />,
    )
    const checkbox = screen.getByRole("checkbox", { name: "Select all" })
    expect(checkbox.getAttribute("aria-checked")).toBe("mixed")
    fireEvent.click(checkbox)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
})

test("tabs highlight active trigger with Kumo contrast tokens and scroll trailing active tab into view", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        return this.getAttribute("role") === "tablist" ? 300 : 120
    })
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        return this.getAttribute("role") === "tablist" ? 600 : 120
    })
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120)
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        return this.textContent === "API Tokens" ? 440 : 0
    })

    render(
        <Tabs value="tokens">
            <TabsList>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="tokens">API Tokens</TabsTrigger>
            </TabsList>
        </Tabs>,
    )

    const list = screen.getByRole("tablist")
    const active = screen.getByRole("tab", { name: "API Tokens" })
    expect(active.getAttribute("data-state")).toBe("active")
    expect(active.className).toContain("data-[state=active]:bg-kumo-contrast")
    expect(active.className).toContain("data-[state=active]:text-kumo-inverse")
    expect(list.scrollLeft).toBeGreaterThan(0)
})

test("select trigger displays only item text when SelectItem has rich description", () => {
    render(
        <Select value="user-kumo">
            <SelectTrigger aria-label="Theme">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem
                    value="user-kumo"
                    description={<span>By NezhaHQ · Official</span>}
                >
                    Official Kumo Theme
                </SelectItem>
            </SelectContent>
        </Select>,
    )

    const trigger = screen.getByRole("combobox", { name: "Theme" })
    expect(trigger.textContent).toBe("Official Kumo Theme")
    expect(trigger.className).toContain("h-9")
    expect(trigger.className).not.toContain("py-8")
})

test("SelectAll and SelectedCount translations cover zh-CN, zh-TW, en, ja and fall back to en", async () => {
    await i18n.changeLanguage("zh-CN")
    expect(i18n.t("SelectAll")).toBe("全选")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("已选 3 项")

    await i18n.changeLanguage("zh-TW")
    expect(i18n.t("SelectAll")).toBe("全選")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("已選 3 項")

    await i18n.changeLanguage("ja-JP")
    expect(i18n.t("SelectAll")).toBe("すべて選択")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("3 件選択中")

    await i18n.changeLanguage("es-ES")
    expect(i18n.t("SelectAll")).toBe("Select all")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("3 selected")

    await i18n.changeLanguage("en-US")
    expect(i18n.t("SelectAll")).toBe("Select all")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("3 selected")
})

