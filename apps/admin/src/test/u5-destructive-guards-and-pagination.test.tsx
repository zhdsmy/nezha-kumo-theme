import i18n from "@/lib/i18n"
import { CopyButton } from "@/components/copy-button"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { NoteMenu } from "@/components/note-menu"
import { TablePagination } from "@/components/ui/pagination"
import UserPage from "@/routes/user"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig } from "swr"
import { afterEach, describe, expect, test, vi } from "vitest"

vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({
        profile: { id: 1, username: "admin", role: 0 },
        loading: false,
    }),
}))

afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    await i18n.changeLanguage("en")
})

describe("U5: self-delete guard, target-aware confirmation & Cancel label, batch count, empty pagination, and table previews", () => {
    test("UserPage prevents selecting or deleting the current logged-in user while allowing other users with named confirmation and Cancel button", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    success: true,
                    data: [
                        { id: 1, username: "admin", role: 0, updated_at: "2026-11-18T01:00:00Z" },
                        { id: 2, username: "alice", role: 1, updated_at: "2026-11-18T02:00:00Z" },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter>
                    <UserPage />
                </MemoryRouter>
            </SWRConfig>,
        )

        await screen.findByText("alice")
        const rowCheckboxes = screen.getAllByRole("checkbox", { name: i18n.t("SelectRow") })
        expect(rowCheckboxes[0]!.getAttribute("aria-disabled")).toBe("true")
        expect(rowCheckboxes[1]!.getAttribute("aria-disabled")).not.toBe("true")
        fireEvent.click(rowCheckboxes[0]!)
        expect(
            screen.getAllByRole("checkbox", { name: i18n.t("SelectRow") })[0]!.getAttribute(
                "aria-checked",
            ),
        ).toBe("false")

        // Self row has a disabled delete button explaining why
        const selfDeleteBtn = screen.getByRole("button", { name: i18n.t("CannotDeleteCurrentUser") })
        expect((selfDeleteBtn as HTMLButtonElement).disabled).toBe(true)

        // SelectAll only selects non-self user (#2), never self (#1)
        fireEvent.click(screen.getByRole("checkbox", { name: i18n.t("SelectAll") }))
        const updatedCheckboxes = screen.getAllByRole("checkbox", { name: i18n.t("SelectRow") })
        expect(updatedCheckboxes[0]!.getAttribute("aria-checked")).toBe("false")
        expect(updatedCheckboxes[1]!.getAttribute("aria-checked")).toBe("true")
        expect(screen.getByText(i18n.t("SelectedCount", { count: 1 }))).toBeTruthy()

        // Clicking alice's row delete opens confirmation showing "alice (#2)" and "Cancel" (not "Close")
        const enabledRowTrash = document.querySelectorAll(
            'td[data-col="actions"] .nkt-table-actions button:not([disabled])',
        )
        expect(enabledRowTrash.length).toBe(1)
        fireEvent.click(enabledRowTrash[0]!)
        const dialog = await screen.findByRole("alertdialog")
        expect(dialog.textContent).toContain("alice (#2)")
        expect(screen.getByRole("button", { name: i18n.t("Cancel") })).toBeTruthy()
    })

    test("HeaderButtonGroup shows selected count and ConfirmBatchDelete description with Cancel button", async () => {
        render(
            <HeaderButtonGroup
                delete={{
                    fn: vi.fn().mockResolvedValue(undefined),
                    id: [10, 11, 12],
                    mutate: vi.fn(),
                }}
            />,
        )

        expect(screen.getByText(i18n.t("SelectedCount", { count: 3 }))).toBeTruthy()
        fireEvent.click(screen.getByRole("button"))
        const dialog = await screen.findByRole("alertdialog")
        expect(dialog.textContent).toContain("3")
        expect(screen.getByRole("button", { name: i18n.t("Cancel") })).toBeTruthy()
    })

    test("TablePagination renders nothing when total <= 0 and renders normally when total > 0", () => {
        const { container, rerender } = render(
            <TablePagination page={1} pageSize={20} total={0} onPageChange={vi.fn()} />,
        )
        expect(container.firstChild).toBeNull()

        rerender(<TablePagination page={1} pageSize={20} total={5} onPageChange={vi.fn()} />)
        expect(screen.getByText(`${i18n.t("Total")}: 5`)).toBeTruthy()
    })

    test("CopyButton and NoteMenu render expanded preview text when showPreview is enabled", () => {
        const { container } = render(
            <div>
                <CopyButton text="uuid-abc-123" showPreview />
                <NoteMenu note={{ private: "rack-42" }} showPreview />
            </div>,
        )
        const previews = Array.from(container.querySelectorAll(".nkt-expanded-preview")).map(
            (el) => el.textContent,
        )
        expect(previews).toContain("uuid-abc-123")
        expect(previews).toContain("rack-42")
    })
})
