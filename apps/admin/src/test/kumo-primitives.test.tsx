import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import i18n from "@/lib/i18n"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.removeAttribute("data-mode")
    document.documentElement.classList.remove("light", "dark")
    vi.restoreAllMocks()
})

function ThemeButton() {
    const { setTheme } = useTheme()
    return <button onClick={() => setTheme("dark")}>Dark</button>
}

test("theme selection activates Kumo tokens and the existing dark utilities together", () => {
    render(
        <ThemeProvider defaultTheme="light">
            <ThemeButton />
        </ThemeProvider>,
    )
    expect(document.documentElement.dataset.mode).toBe("light")
    fireEvent.click(screen.getByRole("button", { name: "Dark" }))
    expect(document.documentElement.dataset.mode).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark")
})

test("batch selection retains mixed state and can select the remaining rows", () => {
    const onCheckedChange = vi.fn()
    render(
        <Checkbox
            aria-label="Select all"
            checked="indeterminate"
            onCheckedChange={onCheckedChange}
        />,
    )
    const checkbox = screen.getByRole("checkbox", { name: "Select all" })
    expect(checkbox.getAttribute("aria-checked")).toBe("mixed")
    fireEvent.click(checkbox)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
})

test("tabs render Kumo segmented indicator, localize overflow controls, and scroll trailing active tab into view", async () => {
    await i18n.changeLanguage("zh-CN")
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        return this.getAttribute("role") === "tablist" ? 300 : 120
    })
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        return this.getAttribute("role") === "tablist" ? 600 : 120
    })
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120)
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        return this.textContent === "API Tokens" ? 440 : 0
    })

    render(
        <Tabs value="tokens">
            <TabsList>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="tokens">API Tokens</TabsTrigger>
            </TabsList>
        </Tabs>,
    )

    const list = screen.getByRole("tablist")
    const active = screen.getByRole("tab", { name: "API Tokens" })
    expect(active.getAttribute("data-kumo-component")).toBe("Tabs")
    expect(active.getAttribute("aria-selected")).toBe("true")
    expect(active.className).not.toContain("data-[state=active]:bg-kumo-contrast")
    expect(
        document.querySelector('[data-kumo-part="overflow-control"][data-side="start"]')?.getAttribute(
            "aria-label",
        ),
    ).toBe("向左滚动标签页")
    expect(
        document.querySelector('[data-kumo-part="overflow-control"][data-side="end"]')?.getAttribute(
            "aria-label",
        ),
    ).toBe("向右滚动标签页")
    expect(list.scrollLeft).toBeGreaterThan(0)
})

test("route sub-navigation tabs use Kumo underline variant, set aria-current=page, and navigate via keyboard and click without page reload", async () => {
    const { MemoryRouter, Route, Routes, useLocation } = await import("react-router-dom")
    const { GroupTab } = await import("@/components/group-tab")
    const { NotificationTab } = await import("@/components/notification-tab")

    function Probe() {
        const { pathname } = useLocation()
        return <p data-testid="path">{pathname}</p>
    }

    const { unmount } = render(
        <MemoryRouter initialEntries={["/dashboard/server-group"]}>
            <GroupTab />
            <Routes>
                <Route path="*" element={<Probe />} />
            </Routes>
        </MemoryRouter>,
    )

    const list = screen.getByRole("tablist")
    expect(list.className).toContain("border-b")
    const serverTab = screen.getByRole("tab", { name: /Server|服务器/ })
    const notifTab = screen.getByRole("tab", { name: /Notification|通知/ })
    expect(serverTab.tagName).toBe("A")
    expect(serverTab.getAttribute("aria-current")).toBe("page")
    expect(notifTab.getAttribute("aria-current")).toBeNull()

    // Keyboard navigation: ArrowRight moves roving focus, Enter navigates via client router
    serverTab.focus()
    fireEvent.keyDown(serverTab, { key: "ArrowRight" })
    await Promise.resolve()
    expect(document.activeElement).toBe(notifTab)
    fireEvent.keyDown(notifTab, { key: "Enter" })
    expect(screen.getByTestId("path").textContent).toBe("/dashboard/notification-group")
    expect(notifTab.getAttribute("aria-current")).toBe("page")
    expect(serverTab.getAttribute("aria-current")).toBeNull()

    unmount()

    render(
        <MemoryRouter initialEntries={["/dashboard/notification"]}>
            <NotificationTab />
            <Routes>
                <Route path="*" element={<Probe />} />
            </Routes>
        </MemoryRouter>,
    )
    const alertTab = screen.getByRole("tab", { name: /Alert|警报/ })
    fireEvent.click(alertTab)
    expect(screen.getByTestId("path").textContent).toBe("/dashboard/alert-rule")
    expect(alertTab.getAttribute("aria-current")).toBe("page")
})

test("select trigger displays only item text when SelectItem has rich description", () => {
    render(
        <Select value="user-kumo">
            <SelectTrigger aria-label="Theme">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem
                    value="user-kumo"
                    description={<span>By NezhaHQ · Official</span>}
                >
                    Official Kumo Theme
                </SelectItem>
            </SelectContent>
        </Select>,
    )

    const trigger = screen.getByRole("combobox", { name: "Theme" })
    expect(trigger.textContent).toBe("Official Kumo Theme")
    expect(trigger.className).toContain("h-9")
    expect(trigger.className).not.toContain("py-8")
})

test("SelectAll and SelectedCount translations cover zh-CN, zh-TW, en, ja and fall back to en", async () => {
    await i18n.changeLanguage("zh-CN")
    expect(i18n.t("SelectAll")).toBe("全选")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("已选 3 项")

    await i18n.changeLanguage("zh-TW")
    expect(i18n.t("SelectAll")).toBe("全選")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("已選 3 項")

    await i18n.changeLanguage("ja-JP")
    expect(i18n.t("SelectAll")).toBe("すべて選択")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("3 件選択中")

    await i18n.changeLanguage("es-ES")
    expect(i18n.t("SelectAll")).toBe("Select all")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("3 selected")

    await i18n.changeLanguage("en-US")
    expect(i18n.t("SelectAll")).toBe("Select all")
    expect(i18n.t("SelectedCount", { count: 3 })).toBe("3 selected")
})

test("button maps variants and icon size to Kumo Button, supports loading/disabled, and renders IconButton tooltip", async () => {
    const { Button, buttonVariants } = await import("@/components/ui/button")
    const { IconButton } = await import("@/components/xui/icon-button")
    const { Dialog, DialogContent, DialogTitle, DialogTrigger } = await import(
        "@/components/ui/dialog"
    )
    await i18n.changeLanguage("zh-CN")

    const onClick = vi.fn()
    const { rerender } = render(
        <Button variant="default" onClick={onClick}>
            保存
        </Button>,
    )
    const primary = screen.getByRole("button", { name: "保存" })
    expect(primary.getAttribute("data-kumo-component")).toBe("Button")
    expect((primary as HTMLButtonElement).style.getPropertyValue("--kumo-button-emphasis-gradient-end")).toBe(
        "var(--color-kumo-brand)",
    )

    rerender(
        <Button variant="destructive" loading onClick={onClick}>
            删除
        </Button>,
    )
    const loadingBtn = screen.getByRole("button", { name: /删除/ }) as HTMLButtonElement
    expect(loadingBtn.disabled).toBe(true)
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy()
    fireEvent.click(loadingBtn)
    expect(onClick).not.toHaveBeenCalled()

    rerender(
        <Button variant="outline" size="icon" aria-label="刷新">
            <svg viewBox="0 0 16 16" />
        </Button>,
    )
    const squareBtn = screen.getByRole("button", { name: "刷新" })
    expect(squareBtn.className).toContain("size-9")
    expect(squareBtn.className).toContain("p-0")
    expect(buttonVariants({ variant: "outline", size: "sm" })).toContain("h-6.5")

    cleanup()
    render(
        <Dialog>
            <DialogTrigger asChild>
                <IconButton icon="edit" variant="outline" />
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>编辑对话框</DialogTitle>
            </DialogContent>
        </Dialog>,
    )
    const editBtn = screen.getByRole("button", { name: "编辑" })
    fireEvent.focus(editBtn)
    expect(await screen.findByText("编辑")).toBeTruthy()
    fireEvent.click(editBtn)
    expect(await screen.findByRole("dialog", { name: "编辑对话框" })).toBeTruthy()
})

test("badge, neutral switch, input, password-input, and textarea delegate to Kumo with controlled behavior and zero accessible-name warnings", async () => {
    const { useState } = await import("react")
    const { useForm } = await import("react-hook-form")
    const { Badge, badgeVariants } = await import("@/components/ui/badge")
    const { Switch } = await import("@/components/ui/switch")
    const { Input } = await import("@/components/ui/input")
    const { PasswordInput } = await import("@/components/ui/password-input")
    const { Textarea } = await import("@/components/ui/textarea")
    const { Form, FormControl, FormField, FormItem, FormLabel } = await import(
        "@/components/ui/form"
    )

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    function ControlledHarness() {
        const [enabled, setEnabled] = useState(false)
        const [notes, setNotes] = useState("init")
        const form = useForm({ defaultValues: { host: "node-1", secret: "pw-1" } })

        return (
            <Form {...form}>
                <Badge variant="default">Pending</Badge>
                <Badge variant="destructive" data-testid="err-badge">
                    Failed
                </Badge>
                <Switch
                    aria-label="Auto renewal"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                />
                <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Hostname</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="secret"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Agent Secret</FormLabel>
                            <FormControl>
                                <PasswordInput {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <Textarea
                    aria-label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </Form>
        )
    }

    render(<ControlledHarness />)

    expect(warnSpy).not.toHaveBeenCalled()

    const pendingBadge = screen.getByText("Pending")
    expect(pendingBadge.getAttribute("data-kumo-component")).toBe("Badge")
    expect(pendingBadge.className).toContain("bg-kumo-badge-inverted")
    const failedWrapper = screen.getByTestId("err-badge")
    expect(
        failedWrapper.querySelector('[data-kumo-component="Badge"]')?.className,
    ).toContain("bg-kumo-danger-tint")
    expect(badgeVariants({ variant: "outline" })).toContain("border-kumo-fill")

    const sw = screen.getByRole("switch", { name: "Auto renewal" })
    expect(sw.getAttribute("data-kumo-component")).toBe("Switch")
    expect(sw.getAttribute("aria-checked")).toBe("false")
    expect(sw.className).toContain("bg-neutral-150")
    fireEvent.click(sw)
    expect(sw.getAttribute("aria-checked")).toBe("true")
    expect(sw.className).toContain("bg-neutral-500")

    const hostInput = screen.getByLabelText("Hostname") as HTMLInputElement
    expect(hostInput.value).toBe("node-1")
    expect(hostInput.className).toContain("ring-kumo-line")
    fireEvent.change(hostInput, { target: { value: "node-2" } })
    expect(hostInput.value).toBe("node-2")

    const secretInput = screen.getByLabelText("Agent Secret") as HTMLInputElement
    expect(secretInput.type).toBe("password")
    fireEvent.click(screen.getByRole("button", { name: /Show password|显示密码/ }))
    expect(secretInput.type).toBe("text")

    const notesArea = screen.getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement
    expect(notesArea.value).toBe("init")
    expect(notesArea.className).toContain("ring-kumo-line")
    fireEvent.change(notesArea, { target: { value: "updated note" } })
    expect(notesArea.value).toBe("updated note")
})

test("checkbox delegates to Kumo, clicking FormLabel toggles state without warnings, and Table card mode counts selected rows once", async () => {
    const { useState } = await import("react")
    const { useForm } = await import("react-hook-form")
    const { Form, FormControl, FormField, FormItem, FormLabel } = await import(
        "@/components/ui/form"
    )
    const { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } = await import(
        "@/components/ui/table"
    )
    await i18n.changeLanguage("zh-CN")

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    )

    function CheckboxHarness() {
        const form = useForm({ defaultValues: { tls: false } })
        const [rows, setRows] = useState([true, false])
        const allState: boolean | "indeterminate" = rows.every(Boolean)
            ? true
            : rows.some(Boolean)
              ? "indeterminate"
              : false

        return (
            <div>
                <Form {...form}>
                    <FormField
                        control={form.control}
                        name="tls"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormLabel className="text-sm cursor-pointer">
                                        启用 TLS
                                    </FormLabel>
                                </div>
                            </FormItem>
                        )}
                    />
                </Form>
                <Table columnPriority={[["name", 120]]}>
                    <TableHeader>
                        <TableRow>
                            <TableHead data-col="select">
                                <Checkbox
                                    aria-label="Select all"
                                    checked={allState}
                                    onCheckedChange={(next) => setRows([next, next])}
                                />
                            </TableHead>
                            <TableHead data-col="name">Name</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((selected, idx) => (
                            <TableRow key={idx} data-state={selected ? "selected" : undefined}>
                                <TableCell data-col="select">
                                    <Checkbox
                                        aria-label={`Select row ${idx + 1}`}
                                        checked={selected}
                                        onCheckedChange={(next) =>
                                            setRows((prev) =>
                                                prev.map((v, i) => (i === idx ? next : v)),
                                            )
                                        }
                                    />
                                </TableCell>
                                <TableCell data-col="name">{`Node ${idx + 1}`}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    }

    try {
        render(<CheckboxHarness />)

        expect(warnSpy).not.toHaveBeenCalled()

        const tlsCheckbox = screen.getByRole("checkbox", { name: "启用 TLS" })
        expect(tlsCheckbox.getAttribute("data-kumo-component")).toBe("Checkbox")
        expect(tlsCheckbox.getAttribute("aria-checked")).toBe("false")

        fireEvent.click(screen.getByText("启用 TLS"))
        expect(tlsCheckbox.getAttribute("aria-checked")).toBe("true")
        fireEvent.click(screen.getByText("启用 TLS"))
        expect(tlsCheckbox.getAttribute("aria-checked")).toBe("false")

        const selectAll = screen.getByRole("checkbox", { name: "Select all" })
        expect(selectAll.getAttribute("aria-checked")).toBe("mixed")
        expect(await screen.findByText("已选 1 项")).toBeTruthy()

        fireEvent.click(screen.getByText("已选 1 项"))
        expect(await screen.findByText("已选 2 项")).toBeTruthy()
        expect(selectAll.getAttribute("aria-checked")).toBe("true")
    } finally {
        vi.unstubAllGlobals()
    }
})
