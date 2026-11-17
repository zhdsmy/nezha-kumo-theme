import { AmountInput } from "@/components/public-note/amount-input"
import { CyclePicker } from "@/components/public-note/cycle-picker"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
})
afterEach(cleanup)
test("Quarter appears as every three months, and custom one uses the usual label", () => {
    const change = vi.fn()
    const { rerender } = render(<CyclePicker label="周期" value="Quarter" onChange={change} />)
    expect(screen.getByRole("button", { name: "周期 · 每 3 个月" }).textContent).toContain(
        "每 3 个月",
    )
    fireEvent.click(screen.getByRole("button", { name: /^周期 · / }))
    fireEvent.click(screen.getByRole("button", { name: "自定义" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "数量" }), { target: { value: "1" } })
    fireEvent.click(screen.getByRole("button", { name: "应用" }))
    expect(change).toHaveBeenCalledWith("Month")
    rerender(<CyclePicker label="周期" value="Month" onChange={change} />)
    expect(screen.getByRole("button", { name: /^周期 · / }).textContent).toContain("每月")
})
test("unknown cycle shows its source and hint without writing until reselection", () => {
    const change = vi.fn()
    render(<CyclePicker label="周期" value="两月付" onChange={change} />)
    expect(screen.getByRole("button", { name: /^周期 · / }).textContent).toContain("两月付")
    expect(screen.getByText(i18n.t("PublicNote.Unrecognized"))).toBeTruthy()
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: /^周期 · / }))
    fireEvent.click(screen.getByRole("button", { name: "每周" }))
    expect(change).toHaveBeenCalledWith("Week")
})

test("structured amount writes currency and decimals and keeps free/usage shortcuts", () => {
    const change = vi.fn()
    const { rerender } = render(<AmountInput label="金额" value="USD 45" onChange={change} />)
    fireEvent.change(screen.getByRole("textbox", { name: "金额" }), {
        target: { value: "12.34" },
    })
    fireEvent.blur(screen.getByRole("textbox", { name: "金额" }))
    expect(change).toHaveBeenLastCalledWith("USD 12.34")
    fireEvent.click(screen.getByRole("button", { name: "免费" }))
    expect(change).toHaveBeenLastCalledWith("0")
    fireEvent.click(screen.getByRole("button", { name: "按量付费" }))
    expect(change).toHaveBeenLastCalledWith("-1")
    rerender(<AmountInput label="金额" value="special deal" onChange={change} />)
    expect(screen.getByText("special deal")).toBeTruthy()
    expect(screen.getByText(i18n.t("PublicNote.Unrecognized"))).toBeTruthy()
})

test("a paid decimal starting with zero stays editable and retains the chosen currency", () => {
    const change = vi.fn()
    function Harness() {
        const [value, setValue] = useState<string | undefined>("EUR 45.00")
        return (
            <AmountInput
                label="金额"
                value={value}
                onChange={(next) => {
                    setValue(next)
                    change(next)
                }}
            />
        )
    }
    render(<Harness />)
    fireEvent.change(screen.getByRole("textbox", { name: "金额" }), { target: { value: "0" } })
    fireEvent.change(screen.getByRole("textbox", { name: "金额" }), {
        target: { value: "0.99" },
    })
    fireEvent.blur(screen.getByRole("textbox", { name: "金额" }))
    expect(change).toHaveBeenLastCalledWith("EUR 0.99")
})
test.each([
    ["en-US", "Every 3 months", "Every month"],
    ["zh-CN", "每 3 个月", "每月"],
    ["zh-TW", "每 3 個月", "每月"],
    ["ja-JP", "3 か月ごと", "毎月"],
])("cycle plural labels are natural in %s", async (language, plural, singular) => {
    await i18n.changeLanguage(language)
    const { rerender } = render(<CyclePicker label="cycle" value="Quarter" onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /^cycle · / }).textContent).toBe(plural)
    rerender(<CyclePicker label="cycle" value="Month" onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /^cycle · / }).textContent).toBe(singular)
})

test("the active paid mode and currency cannot accidentally clear an amount", () => {
    const change = vi.fn()
    render(<AmountInput label="金额" value="USD 45" onChange={change} />)
    fireEvent.click(screen.getByRole("button", { name: "付费" }))
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("combobox", { name: /^币种 · / }))
    fireEvent.click(screen.getByRole("option", { name: /USD/ }))
    expect(screen.getByRole("combobox", { name: /^币种 · / }).textContent).toContain("USD")
})

test("numeric drafts keep precision and incomplete input never removes a stored suffix", () => {
    const change = vi.fn()
    render(<AmountInput label="金额" value="$3.99/2年" onChange={change} />)
    const input = screen.getByRole("textbox", { name: "金额" }) as HTMLInputElement
    fireEvent.blur(input)
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "12.345" } })
    expect(input.value).toBe("12.345")
    expect(change).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(change).toHaveBeenLastCalledWith("USD 12.35/2年")
    change.mockClear()
    for (const draft of ["-", "1e"]) {
        fireEvent.change(input, { target: { value: draft } })
        expect(input.value).toBe(draft)
        fireEvent.blur(input)
        expect(change).not.toHaveBeenCalled()
    }
})
