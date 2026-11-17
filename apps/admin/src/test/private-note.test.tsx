import { PrivateNoteEditor } from "@/components/private-note/editor"
import { ServerCard } from "@/components/server"
import i18n from "@/lib/i18n"
import { detectNoteMode, prepareJsonNote } from "@/lib/json-note"
import { convertJsonType, privateNoteErrors } from "@/lib/private-note"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const toastError = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({ toast: { error: toastError } }))
const update = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock("@/api/server", () => ({ updateServer: update }))
beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
    update.mockClear()
})
afterEach(cleanup)
const label = (key: string, path: string) => `${i18n.t(`PrivateNote.${key}`)} · ${path}`.trimEnd()
function Harness({ raw, valid = vi.fn() }: { raw: string; valid?: (valid: boolean) => void }) {
    const [value, setValue] = useState(raw)
    return (
        <>
            <PrivateNoteEditor value={value} onChange={setValue} onValidityChange={valid} />
            <output data-testid="saved">{value}</output>
        </>
    )
}
const saved = () => screen.getByTestId("saved").textContent!

test("all six JSON types round trip without any normalization", () => {
    const raw =
        ' {"text":"\\u4e2d", "number":1e+2, "bool":true, "nil":null,"obj":{"x":"v"}, "arr":[0, false, null, "s",{},[]]} '
    const valid = vi.fn()
    render(<Harness raw={raw} valid={valid} />)
    expect(saved()).toBe(raw)
    expect(valid).toHaveBeenLastCalledWith(true)
    fireEvent.blur(screen.getByRole("textbox", { name: label("Value", "number") }))
    expect(saved()).toBe(raw)
})
test("private edits preserve every byte outside the edited path and deep values stay read-only", () => {
    const raw =
        ' {"a":{"b":[{"c":{"deep":1e+2,"x":"\\u4e2d"}}]},"edit":"old", "arr": [1e+2, null]} '
    render(<Harness raw={raw} />)
    expect(screen.getByText('{"deep":1e+2,"x":"\\u4e2d"}')).toBeTruthy()
    expect(screen.getByText(i18n.t("PrivateNote.DepthLimit"))).toBeTruthy()
    fireEvent.change(screen.getByRole("textbox", { name: label("Value", "edit") }), {
        target: { value: "new" },
    })
    expect(saved()).toBe(raw.replace('"old"', '"new"'))
})
test("private keys can be added, nested, renamed and deleted; empty and duplicate keys block saving", () => {
    const valid = vi.fn()
    render(<Harness raw='{"a":"one","obj":{"b":"two"}}' valid={valid} />)
    fireEvent.change(screen.getByRole("textbox", { name: label("Key", "a") }), {
        target: { value: "obj" },
    })
    expect(screen.getAllByText(i18n.t("PrivateNote.DuplicateKey")).length).toBe(2)
    expect(valid).toHaveBeenLastCalledWith(false)
    fireEvent.change(screen.getAllByRole("textbox", { name: label("Key", "obj") })[0], {
        target: { value: "renamed" },
    })
    expect(valid).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getAllByRole("button", { name: i18n.t("PrivateNote.AddRow") }).at(-1)!)
    expect(valid).toHaveBeenLastCalledWith(false)
    fireEvent.change(screen.getByRole("textbox", { name: label("Key", "") }), {
        target: { value: "new" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: label("Value", "new") }), {
        target: { value: "v" },
    })
    fireEvent.click(screen.getByRole("button", { name: label("Delete", "obj.b") }))
    expect(JSON.parse(saved())).toEqual({ renamed: "one", obj: {}, new: "v" })
    expect(valid).toHaveBeenLastCalledWith(true)
})
test("array insertion deletion and ordering preserve untouched value spellings", () => {
    render(<Harness raw={'{"a":[1e+2, "\\u4e2d", false],"x":"keep"}'} />)
    fireEvent.click(screen.getByRole("button", { name: label("MoveDown", "a.0") }))
    expect(JSON.parse(saved()).a).toEqual(["中", 100, false])
    expect(saved()).toContain("1e+2")
    expect(saved()).toContain('"\\u4e2d"')
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PrivateNote.AddItem") }))
    fireEvent.change(screen.getByRole("textbox", { name: label("Value", "a.3") }), {
        target: { value: "last" },
    })
    fireEvent.click(screen.getByRole("button", { name: label("Delete", "a.2") }))
    expect(JSON.parse(saved()).a).toEqual(["中", 100, "last"])
})

test("array moves carry numeric drafts and focus with stable row identities", () => {
    render(<Harness raw='{"a":[1,2]}' />)
    const first = screen.getByRole("textbox", { name: label("Value", "a.0") }) as HTMLInputElement
    fireEvent.change(first, { target: { value: "1e" } })
    first.focus()
    fireEvent.click(screen.getByRole("button", { name: label("MoveDown", "a.0") }))
    expect(screen.getByRole("textbox", { name: label("Value", "a.1") })).toBe(first)
    expect(first.value).toBe("1e")
    expect(document.activeElement).toBe(first)
    expect(
        (screen.getByRole("textbox", { name: label("Value", "a.0") }) as HTMLInputElement).value,
    ).toBe("2")
})
test("type conversion keeps numeric text, confirms containers and rejects incomplete numbers", () => {
    expect(convertJsonType('"12.50"', "number")).toBe(12.5)
    expect(convertJsonType("12.5", "string")).toBe("12.5")
    expect(convertJsonType('"no"', "number")).toBeNull()
    render(<Harness raw='{"a":"hello"}' />)
    fireEvent.click(screen.getByRole("combobox", { name: new RegExp("^" + label("Type", "a")) }))
    fireEvent.keyDown(screen.getByRole("option", { name: i18n.t("PrivateNote.Types.object") }), {
        key: "Enter",
    })
    expect(JSON.parse(saved()).a).toBe("hello")
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Cancel") }))
    expect(JSON.parse(saved()).a).toBe("hello")
    fireEvent.click(screen.getByRole("combobox", { name: new RegExp("^" + label("Type", "a")) }))
    fireEvent.keyDown(screen.getByRole("option", { name: i18n.t("PrivateNote.Types.object") }), {
        key: "Enter",
    })
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PrivateNote.Replace") }))
    expect(JSON.parse(saved()).a).toEqual({})
})
test("actual amount round trips with its own cycle or follows public billing", () => {
    const raw = ' {"billingDataMod":{"actualAmount":"CNY 300.00/Year"},"unknown":1e+2} '
    render(<Harness raw={raw} />)
    expect(saved()).toBe(raw)
    const input = screen.getByRole("textbox", {
        name: i18n.t("PrivateNote.ActualAmount"),
    })
    fireEvent.change(input, { target: { value: "60" } })
    fireEvent.blur(input)
    expect(saved()).toBe(raw.replace("CNY 300.00/Year", "CNY 60.00/Year"))
    fireEvent.click(
        screen.getByRole("button", {
            name: new RegExp("^" + i18n.t("PrivateNote.ActualCycle") + " · "),
        }),
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PublicNote.Clear") }))
    expect(JSON.parse(saved()).billingDataMod.actualAmount).toBe("CNY 60.00")
    expect(
        screen.getByRole("button", {
            name: new RegExp("^" + i18n.t("PrivateNote.ActualCycle") + " · "),
        }).textContent,
    ).toContain(i18n.t("PrivateNote.FollowPublicCycle"))
})
test("unknown actual amounts and non-JSON private notes remain unchanged until editing", () => {
    const change = vi.fn()
    const { unmount } = render(
        <PrivateNoteEditor
            value='{"billingDataMod":{"actualAmount":"odd cost"}}'
            onChange={change}
            onValidityChange={vi.fn()}
        />,
    )
    expect(screen.getByText("odd cost")).toBeTruthy()
    fireEvent.blur(screen.getByRole("textbox", { name: i18n.t("PrivateNote.ActualAmount") }))
    expect(change).not.toHaveBeenCalled()
    unmount()
    for (const raw of ["legacy text", "[1]", "null"]) expect(detectNoteMode(raw)).toBe("raw")
    render(<Harness raw=" legacy text " />)
    expect(
        (
            screen.getByRole("textbox", {
                name: i18n.t("PrivateNote.RawText"),
            }) as HTMLTextAreaElement
        ).value,
    ).toBe(" legacy text ")
    expect(screen.getByText(i18n.t("NoteEditor.RawReason"))).toBeTruthy()
    expect(prepareJsonNote("  text\n", "raw")).toBe("text")
    expect(prepareJsonNote(" {} ", "structured")).toBe("")
})
test("private server submission rejects duplicate keys and saves valid note bytes", async () => {
    const raw = ' {"a":"one", "b":1e+2} '
    render(
        <ServerCard
            data={{ id: 1, name: "Mock", display_index: 0, note: raw } as never}
            mutate={vi.fn()}
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Edit") }))
    fireEvent.change(screen.getByRole("textbox", { name: label("Key", "a") }), {
        target: { value: "b" },
    })
    await act(async () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!))
    expect(update).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(i18n.t("Validation.InvalidForm"), {
        description: i18n.t("PrivateNote.CheckErrors"),
    })
    expect(document.activeElement).toBe(
        screen.getAllByRole("textbox", { name: label("Key", "b") })[0],
    )
    fireEvent.change(screen.getAllByRole("textbox", { name: label("Key", "b") })[0], {
        target: { value: "a" },
    })
    await act(async () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!))
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][1].note).toBe(raw)
    expect(privateNoteErrors('{"":"x"}')).toHaveLength(1)
})

test("number and boolean editing, null conversion, and four-layer limits stay consistent", async () => {
    const valid = vi.fn()
    render(
        <Harness raw='{"n":"bad", "flag":true, "deep":{"a":{"b":{"c":"four"}}}}' valid={valid} />,
    )
    const type = async (path: string, next: string) => {
        fireEvent.click(
            screen.getByRole("combobox", { name: new RegExp("^" + label("Type", path) + " · ") }),
        )
        fireEvent.keyDown(
            screen.getByRole("option", { name: i18n.t("PrivateNote.Types." + next) }),
            { key: "Enter" },
        )
        await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0))
    }
    await type("n", "number")
    expect(valid).toHaveBeenLastCalledWith(false)
    const number = screen.getByRole("textbox", { name: label("Value", "n") }) as HTMLInputElement
    fireEvent.change(number, { target: { value: "-" } })
    fireEvent.blur(number)
    expect(valid).toHaveBeenLastCalledWith(false)
    fireEvent.change(number, { target: { value: "-12.345" } })
    expect(number.value).toBe("-12.345")
    fireEvent.blur(number)
    expect(JSON.parse(saved()).n).toBe(-12.345)
    expect(valid).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole("switch", { name: label("Value", "flag") }))
    expect(JSON.parse(saved()).flag).toBe(false)
    await type("flag", "null")
    expect(JSON.parse(saved()).flag).toBeNull()
    fireEvent.click(
        screen.getByRole("combobox", {
            name: new RegExp("^" + label("Type", "deep.a.b.c") + " · "),
        }),
    )
    expect(
        screen
            .getByRole("option", { name: i18n.t("PrivateNote.Types.object") })
            .getAttribute("aria-disabled"),
    ).toBe("true")
})

test("the actual-cost shortcut creates the nested path and leaves unrelated bytes intact", () => {
    render(<Harness raw=' {"x": 1e+2} ' />)
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PrivateNote.AddActualAmount") }))
    expect(saved()).toContain('"x": 1e+2')
    expect(JSON.parse(saved()).billingDataMod.actualAmount).toBe("")
    expect(
        screen.getByRole("button", {
            name: new RegExp("^" + i18n.t("PrivateNote.ActualCycle") + " · "),
        }).textContent,
    ).toContain(i18n.t("PrivateNote.FollowPublicCycle"))
})

test("replacing a container clears incomplete numeric drafts in its removed children", async () => {
    const valid = vi.fn()
    render(<Harness raw='{"parent":{"n":"bad"}}' valid={valid} />)
    const selectType = async (path: string, next: string) => {
        fireEvent.click(
            screen.getByRole("combobox", { name: new RegExp("^" + label("Type", path) + " · ") }),
        )
        fireEvent.keyDown(
            screen.getByRole("option", { name: i18n.t("PrivateNote.Types." + next) }),
            { key: "Enter" },
        )
        await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0))
    }
    await selectType("parent.n", "number")
    expect(valid).toHaveBeenLastCalledWith(false)
    await selectType("parent", "string")
    fireEvent.click(screen.getByRole("button", { name: i18n.t("PrivateNote.Replace") }))
    expect(saved()).toBe('{"parent":""}')
    expect(valid).toHaveBeenLastCalledWith(true)
})

test.each(["string", "number", "boolean", "null"])(
    "container to %s requires confirmation and can be cancelled",
    async (next) => {
        render(<Harness raw='{"tree":{"keep":[1,2]}}' />)
        fireEvent.click(
            screen.getByRole("combobox", { name: new RegExp("^" + label("Type", "tree") + " · ") }),
        )
        fireEvent.keyDown(
            screen.getByRole("option", { name: i18n.t("PrivateNote.Types." + next) }),
            { key: "Enter" },
        )
        expect(saved()).toBe('{"tree":{"keep":[1,2]}}')
        fireEvent.click(screen.getByRole("button", { name: i18n.t("Cancel") }))
        expect(saved()).toBe('{"tree":{"keep":[1,2]}}')
    },
)

test("actual expense zero and incomplete amounts keep a separate period draft", () => {
    render(<Harness raw='{"billingDataMod":{"actualAmount":"CNY 300.00/Year"}}' />)
    const amount = screen.getByRole("textbox", {
        name: i18n.t("PrivateNote.ActualAmount"),
    }) as HTMLInputElement
    fireEvent.change(amount, { target: { value: "0" } })
    fireEvent.blur(amount)
    expect(JSON.parse(saved()).billingDataMod.actualAmount).toBe("CNY 0.00/Year")
    expect(amount.value).toBe("0")
    fireEvent.change(amount, { target: { value: "" } })
    fireEvent.blur(amount)
    expect(amount.value).toBe("")
    expect(amount.getAttribute("aria-invalid")).toBe("true")
    expect(
        screen.getByRole("button", { name: new RegExp("^" + i18n.t("PrivateNote.ActualCycle")) })
            .textContent,
    ).toContain(i18n.t("PublicNote.EveryYear"))
    fireEvent.change(amount, { target: { value: "12" } })
    fireEvent.blur(amount)
    expect(JSON.parse(saved()).billingDataMod.actualAmount).toBe("CNY 12.00/Year")
})
test.each(["", "免费节点", "odd cost"])(
    "choosing a period never serializes an unreadable amount %s",
    (raw) => {
        render(<Harness raw={JSON.stringify({ billingDataMod: { actualAmount: raw } })} />)
        fireEvent.click(
            screen.getByRole("button", {
                name: new RegExp("^" + i18n.t("PrivateNote.ActualCycle")),
            }),
        )
        fireEvent.click(screen.getByRole("button", { name: i18n.t("PublicNote.EveryYear") }))
        expect(JSON.parse(saved()).billingDataMod.actualAmount).toBe(raw)
        expect(
            screen
                .getByRole("textbox", { name: i18n.t("PrivateNote.ActualAmount") })
                .getAttribute("aria-invalid"),
        ).toBe("true")
    },
)
