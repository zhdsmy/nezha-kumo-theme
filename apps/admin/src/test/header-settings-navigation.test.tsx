import UserMenu from "@/components/user-menu"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, expect, test, vi } from "vitest"

const auth = vi.hoisted(() => ({
    profile: { id: 100, username: "alice", role: 1 } as
        { id: number; username: string; role: number } | undefined,
}))
vi.mock("@/hooks/useMainStore", () => ({
    useMainStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}))
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ logout: vi.fn() }) }))
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

test("members can reach settings from the account menu", async () => {
    auth.profile = { id: 100, username: "alice", role: 1 }
    render(
        <MemoryRouter>
            <Routes>
                <Route path="/" element={<UserMenu />} />
                <Route path="/dashboard/settings" element={<p>settings destination</p>} />
            </Routes>
        </MemoryRouter>,
    )
    const accountMenu = screen.getByRole("button", { name: "alice" })
    expect(accountMenu.textContent).toBe("AL")
    fireEvent.keyDown(accountMenu, { key: "Enter" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Settings" }))
    expect(await screen.findByText("settings destination")).toBeTruthy()
})

test("anonymous visitors have no account settings menu", () => {
    auth.profile = undefined
    render(
        <MemoryRouter>
            <UserMenu />
        </MemoryRouter>,
    )
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull()
    expect(screen.queryByRole("menuitem", { name: "Settings" })).toBeNull()
})
