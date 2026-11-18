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
    expect(
        screen.getByRole("button", { name: new RegExp("^" + i18n.t("PublicNote.Cycle") + " · ") })
            .textContent,
    ).toContain("每 3 个月")
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
    const ip = screen.getByRole("radiogroup", { name: "IPv4" })
    expect(within(ip).getByRole("radio", { name: i18n.t("PublicNote.Unset") })).toHaveProperty(
        "ariaChecked",
        "true",
    )
    fireEvent.click(within(ip).getByRole("radio", { name: i18n.t("PublicNote.None") }))
    fireEvent.click(screen.getByRole("radio", { name: i18n.t("PublicNote.RawText") }))
    const raw = screen.getByRole("textbox", {
        name: i18n.t("PublicNote.RawText"),
    }) as HTMLTextAreaElement
    expect(raw.value).toBe(note.replace('"IPv4":"1"', '"IPv4":"0"'))
    fireEvent.change(raw, { target: { value: raw.value.replace('"Quarter"', '"Week"') } })
    fireEvent.click(screen.getByRole("radio", { name: i18n.t("PublicNote.CustomFields") }))
    expect(
        screen.getByRole("button", { name: new RegExp("^" + i18n.t("PublicNote.Cycle") + " · ") })
            .textContent,
    ).toContain("每周")
})
test("invalid raw notes explain the fallback and can still be cleared and saved", async () => {
    render(
        <ServerCard
            data={{ id: 1, name: "Mock", display_index: 0, public_note: "legacy note" } as never}
            mutate={vi.fn()}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Edit") }))
    expect(screen.getByRole("status").textContent).toContain(i18n.t("NoteEditor.RawReason"))
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
    expect(screen.getByRole("button", { name: /^周期 · / }).textContent).toContain("每 2 年")
    if (action === "clear") fireEvent.click(screen.getByRole("button", { name: "清除 · 周期" }))
    else {
        fireEvent.click(screen.getByRole("button", { name: /^周期 · / }))
        fireEvent.click(screen.getByRole("button", { name: "每周" }))
    }
    expect(screen.getByRole("button", { name: /^周期 · / }).textContent).toContain(
        action === "clear" ? "未填" : "每周",
    )
    const saved = JSON.parse(screen.getByRole("status").textContent!)
    expect(saved.billingDataMod.amount).toBe("$3.99")
    expect(saved.billingDataMod.cycle).toBe(action === "clear" ? undefined : "Week")
    expect(saved.unknown).toBe(100)
})

test("array extras are shown as unknown and survive edits to other fields", () => {
    const change = vi.fn()
    const value = '{"planDataMod":{"extra":["a","b"],"networkRoute":["CN2"]}}'
    render(<PublicNoteEditor value={value} onChange={change} />)
    expect(screen.getByText('["a","b"]')).toBeTruthy()
    expect(screen.getByText('["CN2"]')).toBeTruthy()
    fireEvent.click(screen.getByRole("switch", { name: "自动续费" }))
    expect(change.mock.calls[0][0]).toContain('"extra":["a","b"],"networkRoute":["CN2"]')
})

test("raw text is trimmed when the server form saves", async () => {
    render(
        <ServerCard
            data={{ id: 1, name: "Mock", display_index: 0, public_note: " old " } as never}
            mutate={vi.fn()}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Edit") }))
    fireEvent.change(screen.getByRole("textbox", { name: i18n.t("PublicNote.RawText") }), {
        target: { value: "  new note\n" },
    })
    await act(async () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!))
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][1].public_note).toBe("new note")
})

test("A1: clear buttons follow field controls, TagInput lets Tab pass, and dialog buttons are tabbable", () => {
    render(
        <ServerCard
            data={{ id: 1, name: "Mock", display_index: 0, public_note: note } as never}
            mutate={vi.fn()}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Edit") }))
    const clearStart = screen.getByRole("button", {
        name: `${i18n.t("PublicNote.Clear")} · ${i18n.t("PublicNote.StartDate")}`,
    })
    const openStart = screen.getByRole("button", {
        name: new RegExp("^" + i18n.t("PublicNote.StartDate") + " · "),
    })
    expect(
        Boolean(openStart.compareDocumentPosition(clearStart) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true)

    const extra = screen.getByRole("textbox", { name: i18n.t("PublicNote.Extra") })
    fireEvent.change(extra, { target: { value: "pending-tag" } })
    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
    let tabAllowed = false
    act(() => {
        tabAllowed = extra.dispatchEvent(tabEvent)
    })
    expect(tabAllowed).toBe(true)

    const submit = screen.getByRole("button", { name: i18n.t("Submit") })
    expect(submit.getAttribute("tabindex")).toBe("0")
})

test("A7: IPv4/IPv6 counts > 1 are recognized without warning and Bandwidth input precedes Unlimited toggle", () => {
    function Harness() {
        const [value, setValue] = useState(
            '{"planDataMod":{"bandwidth":"25Gbps Redundant","IPv4":"4","IPv6":"64"}}',
        )
        return (
            <>
                <PublicNoteEditor value={value} onChange={setValue} />
                <output data-testid="pub-saved">{value}</output>
            </>
        )
    }
    render(<Harness />)
    expect(screen.getAllByText(i18n.t("PublicNote.Unrecognized"))).toHaveLength(1)

    const ipv4Group = screen.getByRole("radiogroup", { name: "IPv4" })
    expect(within(ipv4Group).getByRole("radio", { name: i18n.t("PublicNote.Has") })).toHaveProperty(
        "ariaChecked",
        "true",
    )
    const ipv4Count = screen.getByRole("textbox", {
        name: `IPv4 · ${i18n.t("PublicNote.Count")}`,
    }) as HTMLInputElement
    expect(ipv4Count.value).toBe("4")
    fireEvent.change(ipv4Count, { target: { value: "8" } })
    fireEvent.blur(ipv4Count)
    expect(JSON.parse(screen.getByTestId("pub-saved").textContent!).planDataMod.IPv4).toBe("8")

    const bwInput = screen.getByRole("textbox", { name: i18n.t("PublicNote.Bandwidth") })
    const bwUnlimited = screen.getByRole("switch", {
        name: `${i18n.t("PublicNote.Bandwidth")} · ${i18n.t("PublicNote.Unlimited")}`,
    })
    expect(
        Boolean(bwInput.compareDocumentPosition(bwUnlimited) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true)
})


test.each(["IPv4", "IPv6"])("R09: %s count stays editable at one", (key) => {
    function Harness() {
        const [value, setValue] = useState("{}")
        return <PublicNoteEditor value={value} onChange={setValue} />
    }
    render(<Harness />)
    const group = within(screen.getByRole("radiogroup", { name: key }))
    fireEvent.click(group.getByRole("radio", { name: i18n.t("PublicNote.Has") }))
    const count = () => screen.getByRole("textbox", { name: key + " · " + i18n.t("PublicNote.Count") })
    expect(count()).toHaveProperty("value", "1")
    for (const [draft, committed] of [["", "1"], ["1.9", "1"], ["3", "3"], ["1", "1"], ["4", "4"]]) {
        fireEvent.change(count(), { target: { value: draft } })
        fireEvent.blur(count())
        expect(count()).toHaveProperty("value", committed)
    }
    fireEvent.click(group.getByRole("radio", { name: i18n.t("PublicNote.None") }))
    expect(screen.queryByRole("textbox", { name: key + " · " + i18n.t("PublicNote.Count") })).toBeNull()
})
