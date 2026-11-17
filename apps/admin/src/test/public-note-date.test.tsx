import { DateInput } from "@/components/public-note/date-input"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { addCycle } from "../../../../packages/shared/public-note"

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
    expect(change).toHaveBeenLastCalledWith("2026-02-28T00:00:00+08:00")
    fireEvent.click(screen.getByRole("switch", { name: i18n.t("PublicNote.NoExpiry") }))
    expect(change).toHaveBeenLastCalledWith("0000-00-00T23:59:59+08:00")
})

test.each(["+08:00", "-0430", "Z"])(
    "date/time edits retain zone %s and unchanged seconds",
    (zone) => {
        const change = vi.fn()
        render(
            <DateInput label="Date" value={`2026-11-11T10:20:37.123${zone}`} onChange={change} />,
        )
        expect(screen.getByRole("button", { name: /^Date · / }).textContent).toContain("10:20")
        fireEvent.click(screen.getByRole("button", { name: /^Date · / }))
        const clock = screen.getByLabelText(`Date · ${i18n.t("PublicNote.Time")}`)
        fireEvent.change(clock, { target: { value: "10:20" } })
        expect(change).not.toHaveBeenCalled()
        fireEvent.click(
            document.querySelector('button[data-day="2026-11-12"]') ||
                screen.getByRole("button", { name: /2026年11月12日/ }),
        )
        expect(change).toHaveBeenLastCalledWith(`2026-11-12T10:20:37.123${zone}`)
        fireEvent.change(clock, { target: { value: "14:35" } })
        expect(change).toHaveBeenLastCalledWith(`2026-11-12T10:20:37.123${zone}`)
        fireEvent.blur(clock)
        expect(change).toHaveBeenLastCalledWith(`2026-11-11T14:35:00${zone}`)
    },
)

test("date-only values show midnight without writing until an edit", () => {
    const change = vi.fn()
    render(<DateInput label="Date" value="2026-11-11" onChange={change} />)
    expect(screen.getByRole("button", { name: /^Date · / }).textContent).toContain("00:00")
    fireEvent.click(screen.getByRole("button", { name: /^Date · / }))
    expect(
        (screen.getByLabelText(`Date · ${i18n.t("PublicNote.Time")}`) as HTMLInputElement).value,
    ).toBe("00:00")
    expect(change).not.toHaveBeenCalled()
})

test("partial time stays editable until blur and applying commits the new time", () => {
    const change = vi.fn()
    render(<DateInput label="Date" value="2026-11-11T10:20:37+08:00" onChange={change} />)
    fireEvent.click(screen.getByRole("button", { name: /^Date · / }))
    const input = screen.getByLabelText(`Date · ${i18n.t("PublicNote.Time")}`) as HTMLInputElement
    fireEvent.change(input, { target: { value: "" } })
    expect(input.value).toBe("")
    expect(change).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(input.value).toBe("10:20")
    fireEvent.change(input, { target: { value: "12:35" } })
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PublicNote.Apply") }))
    expect(change).toHaveBeenLastCalledWith("2026-11-11T12:35:00+08:00")
})

test("cycle estimates preserve clock precision without inventing milliseconds", () => {
    for (const clock of ["10:20:37", "10:20:37.123", "10:20:37.1234"])
        expect(addCycle(`2026-01-31T${clock}+08:00`, { count: 1, unit: "Month" })).toBe(
            `2026-02-28T${clock}+08:00`,
        )
})
