import { CopyButton } from "@/components/copy-button"
import { NoteMenu } from "@/components/note-menu"
import { UserAvatar, getAvatarColor, getAvatarInitials } from "@/components/ui/avatar"
import { TablePagination } from "@/components/ui/pagination"
import { PasswordInput } from "@/components/ui/password-input"
import UserMenu from "@/components/user-menu"
import ApiTokensPage, { RevealedTokenDialog } from "@/routes/api-tokens"
import ProfilePage from "@/routes/profile"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig } from "swr"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    lang: "en" as "en" | "zh-CN",
    toast: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    toastWarning: vi.fn(),
    copyFallback: vi.fn<(text: string) => Promise<boolean>>(),
    listApiTokens: vi.fn(),
    createApiToken: vi.fn(),
    deleteApiToken: vi.fn(),
    auth: {
        profile: { id: 1, username: "admin", role: 0, login_ip: "127.0.0.1" },
        loading: false,
        logout: vi.fn(),
    },
    mainStore: {
        profile: { id: 1, username: "admin", role: 0, login_ip: "127.0.0.1" },
        setProfile: vi.fn(),
    },
}))

const DICT: Record<"en" | "zh-CN", Record<string, string>> = {
    en: {
        ShowPassword: "Show password",
        HidePassword: "Hide password",
        Copy: "Copy",
        Copied: "Copied to clipboard",
        Error: "Error",
        ClipboardWriteFailed: "Clipboard write failed",
        Done: "Done",
        Close: "Close",
        Confirm: "Confirm",
        Revoke: "Revoke",
        ApiTokenCreated: "API token created",
        ApiTokenRevealOnce: "Copy this token now. It will never be shown again.",
        ApiTokenStoreSafely: "Treat this token like a password.",
        ApiTokenRevoked: "API token revoked.",
        ConfirmDeleteApiToken: "Revoke API token '{{name}}'? This cannot be undone.",
        Total: "Total",
        "MCPOAuthManager.Previous": "Previous",
        "MCPOAuthManager.Next": "Next",
    },
    "zh-CN": {
        ShowPassword: "显示密码",
        HidePassword: "隐藏密码",
        Copy: "复制",
        Copied: "已复制到剪贴板",
        Error: "错误",
        ClipboardWriteFailed: "剪贴板写入失败",
        Done: "完成",
        Close: "关闭",
        Confirm: "确认",
        Revoke: "撤销",
        ApiTokenCreated: "API 令牌已创建",
        ApiTokenRevealOnce: "请立即复制此令牌，关闭后将无法再次查看。",
        ApiTokenStoreSafely: "请像保管密码一样保管此令牌。",
        ApiTokenRevoked: "API 令牌已撤销。",
        ConfirmDeleteApiToken: "确定撤销 API 令牌「{{name}}」？该操作不可恢复。",
        Total: "总计",
        "MCPOAuthManager.Previous": "上一页",
        "MCPOAuthManager.Next": "下一页",
    },
}

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            const template = DICT[mocks.lang][key] ?? key
            if (!opts) return template
            return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(opts[k] ?? ""))
        },
    }),
    initReactI18next: { type: "3rdParty", init: () => undefined },
}))

vi.mock("sonner", () => ({
    toast: Object.assign(mocks.toast, {
        error: mocks.toastError,
        success: mocks.toastSuccess,
        warning: mocks.toastWarning,
    }),
}))

vi.mock("copy-to-clipboard", () => ({
    default: mocks.copyFallback,
}))

vi.mock("@/api/api-tokens", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/api/api-tokens")>()
    return {
        ...actual,
        listApiTokens: mocks.listApiTokens,
        createApiToken: mocks.createApiToken,
        deleteApiToken: mocks.deleteApiToken,
    }
})

vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => mocks.auth,
}))

vi.mock("@/hooks/useMainStore", () => ({
    useMainStore: (selector?: (s: typeof mocks.mainStore) => unknown) =>
        selector ? selector(mocks.mainStore) : mocks.mainStore,
}))

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({ servers: [], serverGroups: [] }),
}))

vi.mock("@/hooks/useSetting", () => ({
    default: () => ({ data: { config: { oauth2_providers: [] } } }),
}))

beforeEach(() => {
    vi.clearAllMocks()
    mocks.lang = "en"
    mocks.copyFallback.mockResolvedValue(true)
    mocks.listApiTokens.mockResolvedValue([])
    mocks.deleteApiToken.mockResolvedValue(undefined)
    mocks.mainStore.profile = { id: 1, username: "admin", role: 0, login_ip: "127.0.0.1" }
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("PasswordInput", () => {
    test("masks input by default, toggles visibility, and localizes screen-reader labels", () => {
        const { rerender } = render(
            <PasswordInput aria-label="Secret field" defaultValue="s3cr3t!" autoComplete="off" />,
        )
        const input = screen.getByLabelText("Secret field") as HTMLInputElement
        expect(input.type).toBe("password")
        expect(input.autocomplete).toBe("off")

        const showBtn = screen.getByRole("button", { name: "Show password" })
        fireEvent.click(showBtn)
        expect(input.type).toBe("text")
        expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Hide password" }))
        expect(input.type).toBe("password")

        mocks.lang = "zh-CN"
        rerender(
            <PasswordInput aria-label="Secret field" defaultValue="s3cr3t!" autoComplete="off" />,
        )
        expect(screen.getByRole("button", { name: "显示密码" })).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "显示密码" }))
        expect(screen.getByRole("button", { name: "隐藏密码" })).toBeTruthy()
    })
})

describe("RevealedTokenDialog & CopyButton", () => {
    const sampleToken = {
        id: 42,
        name: "deploy-bot",
        token: "nzp_secret_one_time_token_12345",
        prefix: "nzp_secr",
        scopes: ["nezha:server:read"],
        created_at: "2026-01-01T00:00:00Z",
    }

    test("does not close on Escape or outside pointer click, and closes only via Done button", () => {
        const onClose = vi.fn()
        render(<RevealedTokenDialog token={sampleToken} onClose={onClose} />)

        const dialog = screen.getByRole("dialog")
        expect(screen.getByText(sampleToken.token)).toBeTruthy()
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull()

        fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" })
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByText(sampleToken.token)).toBeTruthy()

        const overlay = document.querySelector("[data-state='open']") as HTMLElement
        fireEvent.pointerDown(overlay)
        fireEvent.click(overlay)
        expect(onClose).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole("button", { name: "Done" }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    test("falls back to copy-to-clipboard and shows success or failure toast", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("Insecure context"))
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        })

        render(<RevealedTokenDialog token={sampleToken} onClose={vi.fn()} />)

        mocks.copyFallback.mockResolvedValueOnce(true)
        fireEvent.click(screen.getByRole("button", { name: "Copy" }))
        await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Copied to clipboard"))
        expect(mocks.copyFallback).toHaveBeenCalledWith(sampleToken.token)

        mocks.toast.mockClear()
        mocks.copyFallback.mockResolvedValueOnce(false)
        fireEvent.click(screen.getByRole("button", { name: "Copy" }))
        await waitFor(() =>
            expect(mocks.toastError).toHaveBeenCalledWith("Error", {
                description: "Clipboard write failed",
            }),
        )
    })

    test("CopyButton waits for copy resolution before showing check icon and handles failure", async () => {
        let resolveCopy!: (value: void) => void
        const writeText = vi.fn(
            () =>
                new Promise<void>((res) => {
                    resolveCopy = res
                }),
        )
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        })

        const { container } = render(<CopyButton text="hello-world" />)
        const btn = container.querySelector("button")!

        fireEvent.click(btn)
        expect(container.querySelector(".lucide-check")).toBeNull()
        expect(container.querySelector(".lucide-clipboard")).toBeTruthy()
        expect(btn.getAttribute("aria-label")).toBe("Copy")

        await act(async () => {
            resolveCopy()
        })
        await waitFor(() => expect(container.querySelector(".lucide-check")).toBeTruthy())
        expect(btn.getAttribute("aria-label")).toBe("Copied to clipboard")
    })

    test("CopyButton shows error toast and keeps copy icon when clipboard fails", async () => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
        })
        mocks.copyFallback.mockResolvedValueOnce(false)

        const { container } = render(<CopyButton text="secret" />)
        fireEvent.click(container.querySelector("button")!)

        await waitFor(() =>
            expect(mocks.toastError).toHaveBeenCalledWith("Error", {
                description: "Clipboard write failed",
            }),
        )
        expect(container.querySelector(".lucide-check")).toBeNull()
    })
})

describe("ApiTokensPage AlertDialog confirmation", () => {
    test("cancelling revoke sends no request; confirming sends deleteApiToken", async () => {
        mocks.listApiTokens.mockResolvedValue([
            {
                id: 9,
                name: "ci-runner",
                prefix: "nzp_1234",
                scopes: ["nezha:server:read"],
                created_at: "2026-01-01T00:00:00Z",
            },
        ])

        const cache = new Map()
        render(
            <MemoryRouter>
                <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
                    <ApiTokensPage />
                </SWRConfig>
            </MemoryRouter>,
        )

        await screen.findByText("ci-runner")
        fireEvent.click(screen.getByRole("button", { name: "Revoke" }))

        expect(
            await screen.findByText("Revoke API token 'ci-runner'? This cannot be undone."),
        ).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Close" }))
        expect(mocks.deleteApiToken).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole("button", { name: "Revoke" }))
        const confirmBtn = await screen.findByRole("button", { name: "Confirm" })
        expect(confirmBtn.className).toContain("nkt-emphasis-danger")
        fireEvent.click(confirmBtn)

        await waitFor(() => expect(mocks.deleteApiToken).toHaveBeenCalledExactlyOnceWith(9))
    })
})

describe("TablePagination keyboard accessibility", () => {
    test("uses native focusable buttons, sets aria-current=page, and disables boundary Previous/Next", () => {
        const onPageChange = vi.fn()
        const { rerender } = render(
            <TablePagination page={1} pageSize={10} total={30} onPageChange={onPageChange} />,
        )

        expect(document.querySelectorAll("nav[aria-label='pagination'] a")).toHaveLength(0)

        const prev = screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement
        const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement
        const page1 = screen.getByRole("button", { name: "1" }) as HTMLButtonElement
        const page2 = screen.getByRole("button", { name: "2" }) as HTMLButtonElement

        expect(prev.disabled).toBe(true)
        expect(prev.getAttribute("aria-disabled")).toBe("true")
        expect(next.disabled).toBe(false)
        expect(next.getAttribute("aria-disabled")).toBeNull()

        expect(page1.getAttribute("aria-current")).toBe("page")
        expect(page2.getAttribute("aria-current")).toBeNull()
        expect(page2.className).toContain("focus-visible:ring-2")

        page2.focus()
        expect(document.activeElement).toBe(page2)
        fireEvent.click(page2)
        expect(onPageChange).toHaveBeenCalledWith(2)

        rerender(<TablePagination page={3} pageSize={10} total={30} onPageChange={onPageChange} />)
        const nextAtEnd = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement
        const prevAtEnd = screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement
        expect(nextAtEnd.disabled).toBe(true)
        expect(nextAtEnd.getAttribute("aria-disabled")).toBe("true")
        expect(prevAtEnd.disabled).toBe(false)
        expect(screen.getByRole("button", { name: "3" }).getAttribute("aria-current")).toBe("page")
    })
})

function relativeLuminance(hex: string): number {
    const clean = hex.replace("#", "")
    const channels = [0, 2, 4].map((offset) => {
        const c = parseInt(clean.slice(offset, offset + 2), 16) / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(fgHex: string, bgHex: string): number {
    const l1 = relativeLuminance(fgHex)
    const l2 = relativeLuminance(bgHex)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
}

describe("UserAvatar local initials & contrast", () => {
    test("computes Latin, CJK, and empty initials deterministically with >= 4.5:1 contrast", () => {
        expect(getAvatarInitials("admin")).toBe("AD")
        expect(getAvatarInitials("John Doe")).toBe("JD")
        expect(getAvatarInitials("alice_bob")).toBe("AB")
        expect(getAvatarInitials("x")).toBe("X")
        expect(getAvatarInitials("管理员")).toBe("管")
        expect(getAvatarInitials("東京太郎")).toBe("東")
        expect(getAvatarInitials("")).toBe("")
        expect(getAvatarInitials("   ")).toBe("")
        expect(getAvatarInitials(undefined)).toBe("")

        const sampleUsers = ["admin", "alice", "bob", "charlie", "管理员", "ops-team", "root", "z"]
        for (const name of sampleUsers) {
            const c1 = getAvatarColor(name)
            const c2 = getAvatarColor(name)
            expect(c1).toEqual(c2)
            expect(contrastRatio(c1.color, c1.backgroundColor)).toBeGreaterThanOrEqual(4.5)
        }
        const emptyColor = getAvatarColor("")
        expect(contrastRatio(emptyColor.color, emptyColor.backgroundColor)).toBeGreaterThanOrEqual(
            4.5,
        )
    })

    test("renders local initials or fallback icon with zero external avatar requests", () => {
        const { container, rerender } = render(<UserAvatar username="admin" />)
        expect(container.textContent).toBe("AD")
        expect(container.querySelector("img")).toBeNull()

        rerender(<UserAvatar username="管理员" />)
        expect(container.textContent).toBe("管")
        expect(container.querySelector("img")).toBeNull()

        rerender(<UserAvatar username="" />)
        expect(container.textContent).toBe("")
        expect(container.querySelector("svg")).not.toBeNull()
        expect(container.querySelector("img")).toBeNull()
    })

    test("ProfilePage and UserMenu render local UserAvatar without dicebear images", () => {
        mocks.mainStore.profile = { id: 1, username: "Michael Chen", role: 0, login_ip: "1.1.1.1" }
        const { container } = render(
            <MemoryRouter>
                <UserMenu />
                <ProfilePage />
            </MemoryRouter>,
        )
        expect(screen.getAllByText("MC")).toHaveLength(2)
        expect(container.querySelectorAll("img")).toHaveLength(0)
        expect(container.innerHTML.toLowerCase()).not.toContain("dicebear")
    })
})

test("ADM-08: NoteMenu reports clipboard failure and allows a successful retry", async () => {
    const writeText = vi
        .fn()
        .mockRejectedValueOnce(new Error("denied"))
        .mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    mocks.copyFallback.mockResolvedValue(false)
    const { container } = render(<NoteMenu note={{ private: "test note" }} />)
    const trigger = container.querySelector("button")!
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Private" }))
    await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith("Error", {
            description: "Clipboard write failed",
        }),
    )
    expect(container.querySelector(".lucide-check")).toBeNull()
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Private" }))
    await waitFor(() => expect(container.querySelector(".lucide-check")).not.toBeNull())
    expect(writeText).toHaveBeenCalledTimes(2)
})
