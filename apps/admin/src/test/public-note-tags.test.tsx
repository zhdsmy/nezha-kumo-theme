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
    const input = screen.getByRole("combobox", { name: "路由" })
    fireEvent.change(input, { target: { value: " CN2 " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(change).toHaveBeenLastCalledWith("4837[联通],CN2")
    fireEvent.change(input, { target: { value: "CMI，" } })
    fireEvent.paste(input, { clipboardData: { getData: () => " cn2、9929; CMI" } })
    expect(change).toHaveBeenLastCalledWith("4837[联通],CN2,CMI,9929")
    fireEvent.keyDown(input, { key: "Backspace" })
    expect(change).toHaveBeenLastCalledWith("4837[联通],CN2,CMI")
    fireEvent.click(screen.getByRole("button", { name: "删除 CN2" }))
    expect(change).toHaveBeenLastCalledWith("4837[联通],CMI")
})
