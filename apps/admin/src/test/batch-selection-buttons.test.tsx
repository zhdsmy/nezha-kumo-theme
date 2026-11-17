import { HeaderBlockButtonGroup, HeaderButtonGroup } from "@/components/header-button-group"
import { IconButton } from "@/components/xui/icon-button"
import i18n from "@/lib/i18n"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig, useSWRConfig } from "swr"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

vi.mock("@/api/api", () => ({
    swrFetcher: async () => [
        {
            id: 101,
            uuid: "uuid-101",
            name: "Tokyo Edge",
            display_index: 1,
            host: { version: "1.18.2" },
            geoip: { ip: { ipv4_addr: "203.0.113.10", ipv6_addr: "" }, country_code: "jp" },
            note: "",
            public_note: "",
            hide_for_guest: false,
            enable_ddns: false,
        },
        {
            id: 102,
            uuid: "uuid-102",
            name: "Frankfurt Core",
            display_index: 2,
            host: { version: "1.18.2" },
            geoip: { ip: { ipv4_addr: "198.51.100.20", ipv6_addr: "" }, country_code: "de" },
            note: "",
            public_note: "",
            hide_for_guest: false,
            enable_ddns: false,
        },
    ],
}))

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({ servers: [], serverGroups: [] }),
}))

vi.mock("@/hooks/useSetting", () => ({
    default: () => ({
        data: {
            config: {
                install_host: "dash.example.com:8008",
                tls: true,
                agent_secret_key: "secret",
            },
        },
    }),
}))

beforeEach(async () => {
    await i18n.changeLanguage("zh-CN")
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

afterEach(async () => {
    cleanup()
    document.body.innerHTML = ""
    await i18n.changeLanguage("en")
})

test("ServerPage disables batch actions with localized tooltip when unselected, enables on select-all, and keeps InstallCommands enabled", async () => {
    const { default: ServerPage } = await import("@/routes/server")
    const cache = new Map()

    render(
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
            <ServerPage />
        </SWRConfig>,
    )

    await screen.findByText("Tokyo Edge")

    const deleteBtn = screen.getAllByRole("button", { name: "删除" })[0] as HTMLButtonElement
    const updateBtn = screen.getByRole("button", { name: "强制升级" }) as HTMLButtonElement
    const moveBtn = screen.getByRole("button", { name: "转移所有者" }) as HTMLButtonElement
    const batchConfigBtn = screen.getAllByRole("button", {
        name: "系统设置",
    })[0] as HTMLButtonElement
    const installBtn = screen.getByRole("button", { name: "安装命令" }) as HTMLButtonElement

    expect(deleteBtn.disabled).toBe(true)
    expect(updateBtn.disabled).toBe(true)
    expect(moveBtn.disabled).toBe(true)
    expect(batchConfigBtn.disabled).toBe(true)
    expect(installBtn.disabled).toBe(false)

    // Hover/focus trigger wrapper exposes both native title and Kumo floating tooltip
    const triggerWrapper = deleteBtn.closest("[data-base-ui-tooltip-trigger]") as HTMLElement
    expect(triggerWrapper).not.toBeNull()
    expect(triggerWrapper.getAttribute("title")).toBe("未选择任何行")
    await act(async () => {
        fireEvent.focus(triggerWrapper)
    })
    await waitFor(() => {
        expect(document.querySelector(".kumo-tooltip-popup")?.textContent).toContain("未选择任何行")
    })

    // Select all -> batch buttons become enabled
    const selectAll = screen.getByRole("checkbox", { name: "全选" })
    await act(async () => {
        fireEvent.click(selectAll)
    })

    await waitFor(() => {
        expect(
            (screen.getAllByRole("button", { name: "删除" })[0] as HTMLButtonElement).disabled,
        ).toBe(false)
        expect(
            (screen.getByRole("button", { name: "强制升级" }) as HTMLButtonElement).disabled,
        ).toBe(false)
        expect(
            (screen.getByRole("button", { name: "转移所有者" }) as HTMLButtonElement).disabled,
        ).toBe(false)
        expect(
            (screen.getAllByRole("button", { name: "系统设置" })[0] as HTMLButtonElement).disabled,
        ).toBe(false)
        expect(installBtn.disabled).toBe(false)
    })

    // Unselect all -> batch buttons return to disabled
    await act(async () => {
        fireEvent.click(screen.getByRole("checkbox", { name: "全选" }))
    })

    await waitFor(() => {
        expect(
            (screen.getAllByRole("button", { name: "删除" })[0] as HTMLButtonElement).disabled,
        ).toBe(true)
        expect(
            (screen.getByRole("button", { name: "强制升级" }) as HTMLButtonElement).disabled,
        ).toBe(true)
        expect(
            (screen.getByRole("button", { name: "转移所有者" }) as HTMLButtonElement).disabled,
        ).toBe(true)
        expect(
            (screen.getAllByRole("button", { name: "系统设置" })[0] as HTMLButtonElement).disabled,
        ).toBe(true)
        expect(installBtn.disabled).toBe(false)
    })
})

test("HeaderButtonGroup and HeaderBlockButtonGroup disable batch buttons while leaving Create action enabled", () => {
    const mutate = vi.fn()
    const { rerender } = render(
        <div>
            <HeaderButtonGroup delete={{ fn: vi.fn(), id: [], mutate }}>
                <IconButton icon="plus" />
            </HeaderButtonGroup>
            <HeaderBlockButtonGroup block={{ fn: vi.fn(), id: [], mutate }} />
        </div>,
    )

    expect((screen.getByRole("button", { name: "删除" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "封禁" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "创建" }) as HTMLButtonElement).disabled).toBe(false)

    rerender(
        <div>
            <HeaderButtonGroup delete={{ fn: vi.fn(), id: [1], mutate }}>
                <IconButton icon="plus" />
            </HeaderButtonGroup>
            <HeaderBlockButtonGroup block={{ fn: vi.fn(), id: ["198.51.100.1"], mutate }} />
        </div>,
    )

    expect((screen.getByRole("button", { name: "删除" }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole("button", { name: "封禁" }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole("button", { name: "创建" }) as HTMLButtonElement).disabled).toBe(false)
})

test("ADM-03: selection follows the server ID through reorder and is removed permanently after deletion", async () => {
    const { default: ServerPage } = await import("@/routes/server")
    const { swrFetcher } = await import("@/api/api")
    const rows = await swrFetcher<import("@/types").ModelServer[]>("/api/v1/server")
    let refresh: ReturnType<typeof useSWRConfig>["mutate"]
    function Page() {
        refresh = useSWRConfig().mutate
        return <ServerPage />
    }
    render(
        <SWRConfig value={{ provider: () => new Map() }}>
            <Page />
        </SWRConfig>,
    )
    await screen.findByText("Tokyo Edge")
    fireEvent.click(
        screen.getByText("Tokyo Edge").closest("tr")!.querySelector('[role="checkbox"]')!,
    )
    const selected = () =>
        [...document.querySelectorAll('tbody tr[data-state="selected"]')].map(
            (row) => row.textContent,
        )
    await act(async () => {
        await refresh!("/api/v1/server", [...rows].reverse(), false)
    })
    expect(selected()).toHaveLength(1)
    expect(selected()[0]).toContain("Tokyo Edge")
    await act(async () => {
        await refresh!("/api/v1/server", [rows[1]], false)
    })
    expect(selected()).toHaveLength(0)
    await act(async () => {
        await refresh!("/api/v1/server", rows, false)
    })
    expect(selected()).toHaveLength(0)
})
