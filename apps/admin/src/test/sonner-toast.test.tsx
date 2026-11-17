import "@/lib/i18n"
import { ThemeProvider } from "@/components/theme-provider"
import { KUMO_SONNER_STYLE, Toaster } from "@/components/ui/sonner"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { SWRConfig } from "swr"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const runCronMock = vi.fn()
vi.mock("@/api/cron", () => ({
    deleteCron: vi.fn(),
    runCron: (...args: unknown[]) => runCronMock(...args),
}))

vi.mock("@/api/api", () => ({
    swrFetcher: async () => [
        {
            id: 42,
            name: "Nightly backup",
            scheduler: "0 3 * * *",
            command: "tar -czf /tmp/backup.tgz /etc",
            servers: [1],
            push_successful: false,
            notification_group_id: 0,
            cover: 0,
            task_type: 0,
            last_executed_at: "2026-01-01T00:00:00Z",
            last_result: true,
        },
    ],
}))

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({ servers: [], serverGroups: [] }),
}))

vi.mock("@/hooks/useNotfication", () => ({
    useNotification: () => ({ notifierGroup: [] }),
}))

beforeEach(() => {
    runCronMock.mockReset()
    localStorage.clear()
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: query.includes("min-width"),
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
        }),
    })
})

afterEach(() => {
    act(() => {
        toast.dismiss()
    })
    cleanup()
    document.body.innerHTML = ""
})

test("Toaster uses Kumo semantic CSS variables without hardcoded color literals and syncs with ThemeProvider", async () => {
    for (const [prop, value] of Object.entries(KUMO_SONNER_STYLE)) {
        const str = String(value)
        expect(str, `${prop} must reference Kumo CSS variables`).toContain("kumo-")
        expect(str, `${prop} must not hardcode hex/rgb/hsl/oklch colors`).not.toMatch(
            /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)\(/i,
        )
    }

    localStorage.setItem("vite-ui-theme", "dark")
    render(
        <ThemeProvider>
            <Toaster expand visibleToasts={5} />
        </ThemeProvider>,
    )

    act(() => {
        toast.error("Backend failed", { description: "permission denied" })
        toast.success("Saved", { description: "Settings updated" })
        toast.warning("Warning", { description: "Empty text" })
        toast("Clipboard is empty")
    })

    const toaster = await waitFor(() => {
        const el = document.querySelector("[data-sonner-toaster]") as HTMLElement | null
        expect(el).not.toBeNull()
        return el!
    })

    expect(toaster.getAttribute("data-sonner-theme")).toBe("dark")
    expect(toaster.style.getPropertyValue("--error-bg")).toContain("var(--color-kumo-danger)")
    expect(toaster.style.getPropertyValue("--success-bg")).toContain("var(--color-kumo-success)")
    expect(toaster.style.getPropertyValue("--warning-bg")).toContain("var(--color-kumo-warning)")
    expect(toaster.style.getPropertyValue("--normal-bg")).toBe("var(--color-kumo-base)")

    await waitFor(() => {
        expect(
            document.querySelector('[data-sonner-toast][data-rich-colors="true"][data-type="error"]'),
        ).not.toBeNull()
        expect(
            document.querySelector(
                '[data-sonner-toast][data-rich-colors="true"][data-type="success"]',
            ),
        ).not.toBeNull()
        expect(
            document.querySelector(
                '[data-sonner-toast][data-rich-colors="true"][data-type="warning"]',
            ),
        ).not.toBeNull()
        const neutralToast = document.querySelector("[data-sonner-toast]:not([data-type])")
        expect(neutralToast).not.toBeNull()
        expect(neutralToast?.querySelector("[data-icon]")).toBeNull()
    })
})

test("CronPage run action triggers error toast with server error message on failure and success toast on resolve", async () => {
    const { default: CronPage } = await import("@/routes/cron")
    const errorSpy = vi.spyOn(toast, "error")
    const successSpy = vi.spyOn(toast, "success")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const cache = new Map()
    render(
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
            <ThemeProvider>
                <CronPage />
                <Toaster />
            </ThemeProvider>
        </SWRConfig>,
    )

    await screen.findByText("Nightly backup")
    const playButton = screen.getByRole("button", { name: "Run" }) as HTMLButtonElement
    expect(playButton).toBeTruthy()

    runCronMock.mockRejectedValueOnce(new Error("agent 7 offline"))
    await act(async () => {
        fireEvent.click(playButton)
    })

    await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ description: "agent 7 offline" }),
        ),
    )
    expect(successSpy).not.toHaveBeenCalled()

    errorSpy.mockClear()
    runCronMock.mockResolvedValueOnce(undefined)
    await act(async () => {
        fireEvent.click(playButton)
    })

    await waitFor(() => expect(successSpy).toHaveBeenCalledOnce())
    expect(errorSpy).not.toHaveBeenCalled()

    consoleError.mockRestore()
})
