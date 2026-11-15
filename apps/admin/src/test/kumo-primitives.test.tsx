import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Checkbox } from "@/components/ui/checkbox"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.removeAttribute("data-mode")
    document.documentElement.classList.remove("light", "dark")
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
