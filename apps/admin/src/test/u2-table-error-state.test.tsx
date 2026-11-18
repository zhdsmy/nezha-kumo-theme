import i18n from "@/lib/i18n"
import ApiTokensPage from "@/routes/api-tokens"
import ServerPage from "@/routes/server"
import ServicePage from "@/routes/service"
import TransferPage from "@/routes/transfer"
import WAFPage from "@/routes/waf"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig, useSWRConfig } from "swr"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const state = vi.hoisted(() => ({
    mode: "error" as "error" | "empty" | "ok",
    calls: 0,
}))

vi.mock("sonner", () => ({
    toast: Object.assign(vi.fn(), {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
    }),
}))

vi.mock("@/api/api", () => ({
    swrFetcher: async () => {
        state.calls += 1
        if (state.mode === "error") {
            throw new Error("Service Unavailable (503)")
        }
        return []
    },
}))

vi.mock("@/api/api-tokens", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/api/api-tokens")>()
    return {
        ...actual,
        listApiTokens: async () => {
            state.calls += 1
            if (state.mode === "error") {
                throw new Error("Token store offline")
            }
            return state.mode === "ok" ? [{ id: 1, name: "Existing entry" }] : []
        },
    }
})

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({ servers: [], serverGroups: [] }),
}))

vi.mock("@/hooks/useNotfication", () => ({
    useNotification: () => ({ notifierGroup: [] }),
}))

vi.mock("@/hooks/useSetting", () => ({
    default: () => ({
        data: { config: { install_host: "dash.example.com:8008", tls: true } },
    }),
}))

vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({ profile: { id: 1, username: "admin", role: 0 }, loading: false }),
}))

beforeEach(async () => {
    state.mode = "error"
    state.calls = 0
    await i18n.changeLanguage("en")
})

afterEach(() => {
    cleanup()
})

test("U2: resource tables render inline error reason and Retry button instead of NoResults on fetch failure, and recover to NoResults on retry", async () => {
    render(
        <MemoryRouter>
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
                <ServerPage />
            </SWRConfig>
        </MemoryRouter>,
    )

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Service Unavailable (503)")
    expect(screen.queryByText("No results")).toBeNull()

    const retryBtn = screen.getByRole("button", { name: "Retry" })
    state.mode = "empty"
    fireEvent.click(retryBtn)

    await waitFor(() => {
        expect(screen.getByText("No results")).toBeTruthy()
        expect(screen.queryByRole("alert")).toBeNull()
    })
})

test("U2: ServicePage, WAFPage, TransferPage, and ApiTokensPage all share inline error and retry state", async () => {
    for (const Component of [ServicePage, WAFPage, TransferPage, ApiTokensPage]) {
        state.mode = "error"
        const { unmount } = render(
            <MemoryRouter>
                <SWRConfig
                    value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
                >
                    <Component />
                </SWRConfig>
            </MemoryRouter>,
        )
        expect(await screen.findByRole("alert")).toBeTruthy()
        expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
        expect(screen.queryByText("No results")).toBeNull()
        unmount()
    }
})

test("R01: a cached resource row stays visible with its refresh error and retry", async () => {
    function Refresh() {
        const { mutate } = useSWRConfig()
        return <button onClick={() => void mutate(() => true)}>Refresh list</button>
    }
    state.mode = "ok"
    render(
        <MemoryRouter>
            <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
                <Refresh />
                <ApiTokensPage />
            </SWRConfig>
        </MemoryRouter>,
    )
    await screen.findByText("Existing entry")
    state.mode = "error"
    fireEvent.click(screen.getByRole("button", { name: "Refresh list" }))
    expect((await screen.findByRole("alert")).textContent).toContain("Refresh failed: Token store offline")
    expect(screen.getByText("Existing entry")).toBeTruthy()
    state.mode = "empty"
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await screen.findByText("No results")
})
