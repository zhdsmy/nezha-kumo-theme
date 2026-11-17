import { PublicNoteEditor } from "@/components/public-note/editor"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

afterEach(cleanup)
test("note selectors use Kumo groups and the calendar keeps navigation beside its caption", async () => {
    await i18n.changeLanguage("zh-CN")
    const { container } = render(
        <PublicNoteEditor
            value='{"billingDataMod":{"startDate":"2026-11-11T10:20:37+08:00"}}'
            onChange={vi.fn()}
        />,
    )
    expect(container.querySelector('[data-kumo-component="ButtonGroup"]')).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /^开始时间 · / }))
    expect(document.querySelector("[data-note-calendar] .rdp-dropdowns")).toBeTruthy()
})
