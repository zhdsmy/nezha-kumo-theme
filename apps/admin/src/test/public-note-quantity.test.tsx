import { QuantityInput } from "@/components/public-note/quantity-input"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
})
afterEach(cleanup)

test("traffic uses the shared cycle picker and canonical units without normalizing on mount", () => {
    const change = vi.fn()
    render(<QuantityInput traffic label="流量配额" value="1TB/月" onChange={change} />)
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole("textbox", { name: "流量配额" }), {
        target: { value: "2.5" },
    })
    fireEvent.blur(screen.getByRole("textbox", { name: "流量配额" }))
    expect(change).toHaveBeenLastCalledWith("2.5TB/Month")
    fireEvent.click(screen.getByRole("switch", { name: "流量配额 · 不限" }))
    expect(change).toHaveBeenLastCalledWith("Unlimited")
})

test("clearing a traffic period removes its suffix", () => {
    const change = vi.fn()
    render(<QuantityInput traffic label="流量配额" value="1TB/Month" onChange={change} />)
    fireEvent.click(screen.getByRole("button", { name: /^流量周期 · / }))
    fireEvent.click(screen.getByRole("button", { name: "清除" }))
    expect(change).toHaveBeenLastCalledWith("1TB")
})

test("unknown traffic periods stay visible and survive numeric edits until reselected", () => {
    const change = vi.fn()
    render(<QuantityInput traffic label="流量配额" value="1TB/两月" onChange={change} />)
    expect(screen.getByRole("button", { name: "流量周期 · 两月" })).toBeTruthy()
    expect(screen.getByText("1TB/两月")).toBeTruthy()
    const input = screen.getByRole("textbox", { name: "流量配额" })
    fireEvent.change(input, { target: { value: "2" } })
    fireEvent.blur(input)
    expect(change).toHaveBeenLastCalledWith("2TB/两月")
    fireEvent.click(screen.getByRole("button", { name: "流量周期 · 两月" }))
    fireEvent.click(screen.getByRole("button", { name: "每周" }))
    expect(change).toHaveBeenLastCalledWith("1TB/Week")
})
