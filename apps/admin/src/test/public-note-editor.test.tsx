import { PublicNoteEditor } from "@/components/public-note/editor"
import { ServerCard } from "@/components/server"
import i18n from "@/lib/i18n"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const update = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock("@/api/server", () => ({ updateServer: update }))
beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
    update.mockClear()
})
afterEach(cleanup)
const note =
    ' {"unknown":1e+2,"billingDataMod":{"cycle":"Quarter","amount":"unusual price","startDate":"2026-11-11 00:00:00+08:00"},"planDataMod":{"extra":"a，b","IPv4":"1"}} '
test("server submits Quarter and unknown values intact after a one-field edit", async () => {
    render(
        <ServerCard
            data={{ id: 1, name: "Mock", display_index: 0, public_note: note } as never}
            mutate={vi.fn()}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Edit") }))
    expect(screen.getByRole("button", { name: i18n.t("PublicNote.Cycle") }).textContent).toContain(
        "每 3 个月",
    )
    fireEvent.click(screen.getByRole("switch", { name: i18n.t("PublicNote.AutoRenewal") }))
    await act(async () => {
        fireEvent.submit(screen.getByRole("dialog").querySelector("form")!)
    })
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][1].public_note).toBe(
        note.replace(
            '"2026-11-11 00:00:00+08:00"}',
            '"2026-11-11 00:00:00+08:00","autoRenewal":"1"}',
        ),
    )
})
test("raw and structured modes share one draft; clear deletes keys and IP has three states", () => {
    function Harness() {
        const [value, setValue] = useState(note)
        return <PublicNoteEditor value={value} onChange={setValue} />
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: `${i18n.t("PublicNote.Clear")} · IPv4` }))
    const ip = screen.getByRole("group", { name: "IPv4" })
    expect(within(ip).getByRole("button", { name: i18n.t("PublicNote.Unset") })).toHaveProperty(
        "ariaPressed",
        "true",
    )
    fireEvent.click(within(ip).getByRole("button", { name: i18n.t("PublicNote.None") }))
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PublicNote.RawText") }))
    const raw = screen.getByRole("textbox", {
        name: i18n.t("PublicNote.RawText"),
    }) as HTMLTextAreaElement
    expect(raw.value).toBe(note.replace('"IPv4":"1"', '"IPv4":"0"'))
    fireEvent.change(raw, { target: { value: raw.value.replace('"Quarter"', '"Week"') } })
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PublicNote.CustomFields") }))
    expect(screen.getByRole("button", { name: i18n.t("PublicNote.Cycle") }).textContent).toContain(
        "每周",
    )
})
test("invalid raw notes explain the fallback and can still be cleared and saved", async () => {
    render(
        <ServerCard
            data={{ id: 1, name: "Mock", display_index: 0, public_note: "legacy note" } as never}
            mutate={vi.fn()}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Edit") }))
    expect(screen.getByRole("status").textContent).toContain(i18n.t("PublicNote.InvalidJSONHint"))
    fireEvent.change(screen.getByRole("textbox", { name: i18n.t("PublicNote.RawText") }), {
        target: { value: "" },
    })
    await act(async () => {
        fireEvent.submit(screen.getByRole("dialog").querySelector("form")!)
    })
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][1].public_note).toBe("")
})

test.each(["clear", "replace"])("edits the amount-suffix cycle at its source: %s", (action) => {
    function Harness() {
        const [value, setValue] = useState(
            '{"billingDataMod":{"amount":"$3.99/2年","cycle":""},"unknown":1e+2}',
        )
        return (
            <>
                <PublicNoteEditor value={value} onChange={setValue} />
                <output>{value}</output>
            </>
        )
    }
    render(<Harness />)
    expect(screen.getByRole("button", { name: "周期" }).textContent).toContain("每 2 年")
    if (action === "clear") fireEvent.click(screen.getByRole("button", { name: "清除 · 周期" }))
    else {
        fireEvent.click(screen.getByRole("button", { name: "周期" }))
        fireEvent.click(screen.getByRole("button", { name: "每周" }))
    }
    expect(screen.getByRole("button", { name: "周期" }).textContent).toContain(
        action === "clear" ? "未填" : "每周",
    )
    const saved = JSON.parse(screen.getByRole("status").textContent!)
    expect(saved.billingDataMod.amount).toBe("$3.99")
    expect(saved.billingDataMod.cycle).toBe(action === "clear" ? undefined : "Week")
    expect(saved.unknown).toBe(100)
})
