import { AmountInput } from "@/components/public-note/amount-input"
import { CyclePicker } from "@/components/public-note/cycle-picker"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
})
afterEach(cleanup)
test("Quarter appears as every three months, and custom one uses the usual label", () => {
    const change = vi.fn()
    const { rerender } = render(<CyclePicker label="周期" value="Quarter" onChange={change} />)
    expect(screen.getByRole("button", { name: "周期" }).textContent).toContain("每 3 个月")
    fireEvent.click(screen.getByRole("button", { name: "周期" }))
    fireEvent.click(screen.getByRole("button", { name: "自定义" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "数量" }), { target: { value: "1" } })
    fireEvent.click(screen.getByRole("button", { name: "应用" }))
    expect(change).toHaveBeenCalledWith("Month")
    rerender(<CyclePicker label="周期" value="Month" onChange={change} />)
    expect(screen.getByRole("button", { name: "周期" }).textContent).toContain("每月")
})
test("unknown cycle shows its source and hint without writing until reselection", () => {
    const change = vi.fn()
    render(<CyclePicker label="周期" value="两月付" onChange={change} />)
    expect(screen.getByRole("button", { name: "周期" }).textContent).toContain("两月付")
    expect(screen.getByText(i18n.t("PublicNote.Unrecognized"))).toBeTruthy()
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "周期" }))
    fireEvent.click(screen.getByRole("button", { name: "每周" }))
    expect(change).toHaveBeenCalledWith("Week")
})

test("structured amount writes currency and decimals and keeps free/usage shortcuts", () => {
    const change = vi.fn()
    const { rerender } = render(<AmountInput label="金额" value="USD 45" onChange={change} />)
    fireEvent.change(screen.getByRole("spinbutton", { name: "金额" }), {
        target: { value: "12.34" },
    })
    expect(change).toHaveBeenLastCalledWith("USD 12.34")
    fireEvent.click(screen.getByRole("button", { name: "免费" }))
    expect(change).toHaveBeenLastCalledWith("0")
    fireEvent.click(screen.getByRole("button", { name: "按量付费" }))
    expect(change).toHaveBeenLastCalledWith("-1")
    rerender(<AmountInput label="金额" value="special deal" onChange={change} />)
    expect(screen.getByText("special deal")).toBeTruthy()
    expect(screen.getByText(i18n.t("PublicNote.Unrecognized"))).toBeTruthy()
})
