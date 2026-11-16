import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

let width = 1440
let containerWidth = 360
let resize: (width: number) => void
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(containerWidth)
    vi.stubGlobal(
        "ResizeObserver",
        class {
            constructor(callback: ResizeObserverCallback) {
                resize = (value) =>
                    callback(
                        [{ contentRect: { width: value } } as ResizeObserverEntry],
                        this as unknown as ResizeObserver,
                    )
            }
            observe() {}
            disconnect() {}
        },
    )
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: width >= Number(query.match(/\d+/)?.[0]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }))
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

function List({ action }: { action: () => void }) {
    const [selected, setSelected] = useState(false)
    return (
        <Table
            columnPriority={[
                ["id", 64],
                ["details", 120],
            ]}
        >
            <TableHeader>
                <TableRow>
                    <TableHead data-col="select">
                        <Checkbox
                            aria-label="Select all"
                            checked={selected}
                            onCheckedChange={(v) => setSelected(!!v)}
                        />
                    </TableHead>
                    <TableHead data-col="name">Name</TableHead>
                    <TableHead data-col="id">ID</TableHead>
                    <TableHead data-col="details">Details</TableHead>
                    <TableHead data-col="actions">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow data-state={selected && "selected"}>
                    <TableCell data-col="select">
                        <Checkbox
                            aria-label="Select row"
                            checked={selected}
                            onCheckedChange={(v) => setSelected(!!v)}
                        />
                    </TableCell>
                    <TableCell data-col="name">Long server name</TableCell>
                    <TableCell data-col="id">42</TableCell>
                    <TableCell data-col="details">Extra details</TableCell>
                    <TableCell data-col="actions">
                        <button onClick={action}>Edit</button>
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}

test.each([
    [375, 800, "cards"],
    [767, 800, "cards"],
    [768, 360, "compact"],
    [1279, 800, "wide"],
    [1440, 360, "compact"],
])("selection and accessible row details at viewport %s / container %s", (w, available, layout) => {
    width = Number(w)
    containerWidth = Number(available)
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(containerWidth)
    render(<List action={vi.fn()} />)
    expect(document.querySelector(".nkt-table")?.getAttribute("data-layout")).toBe(layout)
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }))
    expect(screen.getByRole("checkbox", { name: "Select row" }).getAttribute("aria-checked")).toBe(
        "true",
    )
    if (layout !== "wide") {
        const expand = screen.getByRole("button", { name: "TableDetails" })
        fireEvent.click(expand)
        expect(expand.getAttribute("aria-expanded")).toBe("true")
        expect(expand.closest("tr")?.hasAttribute("data-open")).toBe(true)
        expect(
            screen.getByRole("checkbox", { name: "Select row" }).getAttribute("aria-checked"),
        ).toBe("true")
    }
    expect(document.querySelector('td[data-col="id"]')?.getAttribute("data-label")).toBe("ID")
})

test("container resize reveals columns in priority order without a viewport change", () => {
    width = 1024
    containerWidth = 360
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(containerWidth)
    render(<List action={vi.fn()} />)
    const hidden = () =>
        Array.from(document.querySelectorAll("thead [data-hidden]"), (e) =>
            e.getAttribute("data-col"),
        )
    expect(hidden()).toEqual(["id", "details"])
    act(() => resize(420))
    expect(hidden()).toEqual(["details"])
    act(() => resize(800))
    expect(hidden()).toEqual([])
    expect(screen.queryByRole("button", { name: "TableDetails" })).toBeNull()
    act(() => resize(360))
    expect(hidden()).toEqual(["id", "details"])
})

test("phone actions open without expanding the row", async () => {
    width = 375
    const action = vi.fn()
    render(<List action={action} />)
    fireEvent.click(screen.getByRole("button", { name: "Actions" }))
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "TableDetails" }).getAttribute("aria-expanded")).toBe(
        "false",
    )
})

test.each([
    [767, "sheet"],
    [768, "dialog"],
])("dialog uses the gutter boundary at %s", (w, layout) => {
    width = Number(w)
    render(
        <Dialog open>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>Configuration</DialogTitle>
            </DialogContent>
        </Dialog>,
    )
    expect(screen.getByRole("dialog").getAttribute("data-layout")).toBe(layout)
})
