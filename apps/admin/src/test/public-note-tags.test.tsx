import { TagInput } from "@/components/public-note/tag-input"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
})
afterEach(cleanup)
test("tags support Enter, commas, paste, dedupe and whole-tag deletion", () => {
    const change = vi.fn()
    function Harness() {
        const [value, setValue] = useState("4837[联通]")
        return (
            <TagInput
                value={value}
                label="路由"
                onChange={(next) => {
                    change(next)
                    setValue(next || "")
                }}
                suggestions={["CN2", "CMI"]}
            />
        )
    }
    render(<Harness />)
    let input = screen.getByRole("combobox", { name: "路由" })
    fireEvent.change(input, { target: { value: " CN2 " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(change).toHaveBeenLastCalledWith("4837[联通],CN2")
    fireEvent.change(input, { target: { value: "CMI，" } })
    input = screen.getByRole("combobox", { name: "路由" })
    expect(document.activeElement).toBe(input)
    fireEvent.paste(input, { clipboardData: { getData: () => " cn2、9929; CMI" } })
    input = screen.getByRole("combobox", { name: "路由" })
    expect(change).toHaveBeenLastCalledWith("4837[联通],CN2,CMI,9929")
    fireEvent.keyDown(input, { key: "Backspace" })
    expect(change).toHaveBeenLastCalledWith("4837[联通],CN2,CMI")
    fireEvent.click(screen.getByRole("button", { name: "删除 CN2" }))
    expect(change).toHaveBeenLastCalledWith("4837[联通],CMI")
})

test("paste replaces the selection and splits newlines", () => {
    const change = vi.fn()
    render(<TagInput label="路由" onChange={change} />)
    const input = screen.getByRole("textbox", { name: "路由" }) as HTMLInputElement
    fireEvent.change(input, { target: { value: "preTARGETpost" } })
    input.setSelectionRange(3, 9)
    fireEvent.paste(input, { clipboardData: { getData: () => "A\r\nB" } })
    expect(change).toHaveBeenLastCalledWith("preA,Bpost")
})
test("non-string tags remain unknown and unchanged until replacement", () => {
    const change = vi.fn()
    render(<TagInput label="备注" value={["a", "b"]} onChange={change} />)
    expect(screen.getByText('["a","b"]')).toBeTruthy()
    expect(screen.getByText(i18n.t("PublicNote.Unrecognized"))).toBeTruthy()
    fireEvent.blur(screen.getByRole("textbox", { name: "备注" }))
    expect(change).not.toHaveBeenCalled()
})

test("Kumo tag draft shares its frame with chips and preserves duplicate display", () => {
    render(<TagInput label="Tags" value="A,A" onChange={vi.fn()} />)
    const input = screen.getByRole("textbox", { name: "Tags" }) as HTMLInputElement
    expect(input.placeholder).toBe(i18n.t("PublicNote.TagsPlaceholder"))
    expect(screen.getAllByText("A")).toHaveLength(2)
    expect(input.parentElement?.textContent).toContain("A")
})

test("tags use a short placeholder and retain full screen reader instructions", () => {
    render(<TagInput label="routes" value="CN2" onChange={vi.fn()} />)
    const input = screen.getByRole("textbox", { name: "routes" })
    expect(input.getAttribute("placeholder")).toBe(i18n.t("PublicNote.TagsPlaceholder"))
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
        i18n.t("PublicNote.TagsHint"),
    )
})
