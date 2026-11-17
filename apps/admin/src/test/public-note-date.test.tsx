import { DateInput } from "@/components/public-note/date-input"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
})
afterEach(cleanup)
test("generator dates display and expiry uses calendar months at the source timezone", () => {
    const change = vi.fn()
    render(
        <DateInput
            end
            label="到期日期"
            value="2027-02-11 23:59:59+08:00"
            start="2026-01-31T00:00:00+08:00"
            cycle="Month"
            onChange={change}
        />,
    )
    expect(screen.getByRole("button", { name: /^到期日期 · / }).textContent).toContain("2027")
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "按周期推算" }))
    expect(change).toHaveBeenLastCalledWith("2026-02-28T00:00:00.000+08:00")
    fireEvent.click(screen.getByRole("switch", { name: i18n.t("PublicNote.NoExpiry") }))
    expect(change).toHaveBeenLastCalledWith("0000-00-00T23:59:59+08:00")
})
