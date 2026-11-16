import AdminShell from "@/components/admin-shell"
import UserMenu from "@/components/user-menu"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"
import { afterEach, expect, test, vi } from "vitest"

const auth = vi.hoisted(() => ({
    profile: { id: 100, username: "alice", role: 1 } as
        { id: number; username: string; role: number } | undefined,
}))
vi.mock("@/hooks/useMainStore", () => ({
    useMainStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}))
vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({ profile: auth.profile, logout: vi.fn() }),
}))
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }))
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { changeLanguage: vi.fn() },
    }),
}))

function stubViewport(viewportWidth: number) {
    Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: viewportWidth,
    })
    vi.stubGlobal("matchMedia", (query: string) => {
        const min = query.match(/min-width:\s*(\d+)px/)
        const max = query.match(/max-width:\s*(\d+)px/)
        const matches = min
            ? viewportWidth >= Number(min[1])
            : max
              ? viewportWidth <= Number(max[1])
              : false
        return {
            matches,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }
    })
}

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

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

test("sidebar brand links to /dashboard on desktop while preserving BackToHome link", () => {
    stubViewport(1280)
    auth.profile = { id: 1, username: "admin", role: 0 }
    render(
        <MemoryRouter initialEntries={["/dashboard/settings"]}>
            <Routes>
                <Route
                    element={
                        <AdminShell siteName="Demo Fleet" version="v1.0.0">
                            <Outlet />
                        </AdminShell>
                    }
                >
                    <Route path="/dashboard" element={<p>dashboard home</p>} />
                    <Route path="/dashboard/settings" element={<p>settings page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )

    expect(screen.getByText("settings page")).toBeTruthy()
    expect(document.querySelector(".nk-topbar-content a")).toBeNull()
    expect(screen.getByRole("link", { name: "BackToHome" }).getAttribute("href")).toBe("/")

    const brandLink = document.querySelector<HTMLAnchorElement>(".nk-brand a")
    expect(brandLink).not.toBeNull()
    expect(brandLink?.getAttribute("href")).toBe("/dashboard")
    expect(brandLink?.className).toContain("no-underline")
    fireEvent.click(brandLink!)
    expect(screen.getByText("dashboard home")).toBeTruthy()
})

test("mobile topbar site name and drawer brand both navigate to /dashboard and close drawer", async () => {
    stubViewport(375)
    auth.profile = { id: 1, username: "admin", role: 0 }
    render(
        <MemoryRouter initialEntries={["/dashboard/settings"]}>
            <Routes>
                <Route
                    element={
                        <AdminShell siteName="Demo Fleet" version="v1.0.0">
                            <Outlet />
                        </AdminShell>
                    }
                >
                    <Route path="/dashboard" element={<p>dashboard home</p>} />
                    <Route path="/dashboard/settings" element={<p>settings page</p>} />
                    <Route path="/dashboard/cron" element={<p>cron page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    )

    // 1. Mobile topbar site name navigates to /dashboard
    const topbarLink = document.querySelector<HTMLAnchorElement>(".nk-topbar-content a")
    expect(topbarLink).not.toBeNull()
    expect(topbarLink?.getAttribute("href")).toBe("/dashboard")
    fireEvent.click(topbarLink!)
    expect(screen.getByText("dashboard home")).toBeTruthy()

    // 2. Open drawer, navigate to /dashboard/cron first, then re-open drawer and click brand
    const openBtn = screen.getByRole("button", { name: "Open navigation" })
    fireEvent.click(openBtn)
    expect(openBtn.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(await screen.findByRole("link", { name: "Task" }))
    expect(screen.getByText("cron page")).toBeTruthy()
    expect(openBtn.getAttribute("aria-expanded")).toBe("false")

    fireEvent.click(openBtn)
    expect(openBtn.getAttribute("aria-expanded")).toBe("true")
    const drawerBrandLink = document.querySelector<HTMLAnchorElement>(".nk-brand a")
    expect(drawerBrandLink).not.toBeNull()
    fireEvent.click(drawerBrandLink!)
    expect(screen.getByText("dashboard home")).toBeTruthy()
    expect(openBtn.getAttribute("aria-expanded")).toBe("false")
})

