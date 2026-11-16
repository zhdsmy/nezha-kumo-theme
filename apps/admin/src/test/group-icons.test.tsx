import { ServerGroupCard } from "@/components/server-group"
import i18n from "@/lib/i18n"
import ServerGroupPage from "@/routes/server-group"
import type { ModelSetting, ModelSettingResponse } from "@/types"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig } from "swr"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
    parseGroupIcons,
    serializeGroupIconsBlock,
    updateGroupIconsInCustomCode,
} from "../../../../packages/shared/group-icons"

vi.mock("sonner", () => ({ toast: vi.fn() }))
vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({
        servers: [
            { id: 10, name: "Node A" },
            { id: 20, name: "Node B" },
        ],
    }),
}))

function createBaseConfig(customCode: string): ModelSetting {
    return {
        admin_template: "admin-dist",
        agent_real_ip_header: "CF-Connecting-IP",
        cover: 1,
        custom_code: customCode,
        custom_code_dashboard: "<style>.dash{}</style>",
        dns_servers: "1.1.1.1,8.8.8.8",
        enable_ip_change_notification: true,
        enable_plain_ip_in_notification: false,
        enable_mcp: true,
        ignored_ip_notification: "10,20",
        ignored_ip_notification_server_ids: { "10": true, "20": true },
        install_host: "agent.example.com:8008",
        dashboard_host: "panel.example.com",
        ip_change_notification_group_id: 2,
        language: "zh-CN",
        oauth2_providers: ["GitHub"],
        nat_member_domains: ["tunnel.example.com"],
        reserved_hosts: "panel.example.com",
        online_stats_days: 90,
        site_name: "My Fleet",
        tls: true,
        user_template: "kumo-dist",
        web_real_ip_header: "X-Forwarded-For",
    }
}

interface RecordedCall {
    method: string
    url: string
    body: unknown
}

let currentSetting: ModelSettingResponse
let currentGroups: {
    group: { id: number; name: string; created_at: string; updated_at: string }
    servers: number[]
}[]
let nextGroupId: number
let calls: RecordedCall[]

beforeEach(async () => {
    await i18n.changeLanguage("en-US")
    calls = []
    nextGroupId = 42
    currentSetting = {
        config: createBaseConfig(
            '<script>window.CustomDesc = {"keep": "exact  bytes"};</script>\n<script type="application/json" id="nezha-kumo-group-icons">{"1":"https://example.com/tencent.svg","3":"☁️"}</script>\n<style>.tail{opacity:1}</style>',
        ),
        frontend_templates: [],
        version: "2.0.13",
    }
    currentGroups = [
        {
            group: { id: 1, name: "Tencent", created_at: "2026-01-01", updated_at: "2026-01-01" },
            servers: [10],
        },
        {
            group: { id: 3, name: "Cloud", created_at: "2026-01-01", updated_at: "2026-01-01" },
            servers: [20],
        },
        {
            group: { id: 9, name: "Plain", created_at: "2026-01-01", updated_at: "2026-01-01" },
            servers: [],
        },
    ]

    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)
            const method = (init?.method ?? "GET").toUpperCase()
            const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
            calls.push({ method, url, body })

            if (method === "GET" && url.endsWith("/api/v1/setting")) {
                return new Response(JSON.stringify({ success: true, data: currentSetting }))
            }
            if (method === "PATCH" && url.endsWith("/api/v1/setting")) {
                currentSetting = {
                    ...currentSetting,
                    config: body as ModelSetting,
                }
                return new Response(JSON.stringify({ success: true }))
            }
            if (method === "GET" && url.endsWith("/api/v1/server-group")) {
                return new Response(JSON.stringify({ success: true, data: currentGroups }))
            }
            if (method === "POST" && url.endsWith("/api/v1/server-group")) {
                const id = nextGroupId++
                currentGroups = [
                    ...currentGroups,
                    {
                        group: {
                            id,
                            name: (body as { name: string }).name,
                            created_at: "2026-01-02",
                            updated_at: "2026-01-02",
                        },
                        servers: (body as { servers: number[] }).servers,
                    },
                ]
                return new Response(JSON.stringify({ success: true, data: id }))
            }
            if (method === "PATCH" && url.includes("/api/v1/server-group/")) {
                const id = Number(url.split("/").pop())
                currentGroups = currentGroups.map((item) =>
                    item.group.id === id
                        ? {
                              ...item,
                              group: { ...item.group, name: (body as { name: string }).name },
                              servers: (body as { servers: number[] }).servers,
                          }
                        : item,
                )
                return new Response(JSON.stringify({ success: true }))
            }
            if (method === "POST" && url.endsWith("/api/v1/batch-delete/server-group")) {
                const deleted = new Set(body as number[])
                currentGroups = currentGroups.filter((item) => !deleted.has(item.group.id))
                return new Response(JSON.stringify({ success: true }))
            }
            return new Response(JSON.stringify({ success: true }))
        }),
    )
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

function renderFresh(ui: React.ReactElement) {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <MemoryRouter>{ui}</MemoryRouter>
        </SWRConfig>,
    )
}

describe("admin group-icons save, preview, delete, and i18n", () => {
    test("creating a group saves group first, then PATCHes full setting copy with new ID and preserves custom_code bytes", async () => {
        const snapshotBefore = structuredClone(currentSetting.config)
        const mutate = vi.fn().mockResolvedValue(undefined)
        renderFresh(<ServerGroupCard mutate={mutate} />)

        await act(async () => {
            fireEvent.click(screen.getByRole("button"))
        })
        const dialog = await screen.findByRole("dialog")
        const nameInput = within(dialog).getByPlaceholderText("Group Name")
        const iconInput = within(dialog).getByLabelText("Icon")

        await act(async () => {
            fireEvent.change(nameInput, { target: { value: "New Group" } })
            fireEvent.change(iconInput, { target: { value: "🚀" } })
        })
        expect(within(dialog).getByTestId("group-icon-preview").textContent).toBe("🚀")

        await act(async () => {
            fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }))
        })

        await waitFor(() =>
            expect(
                calls.some((c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting")),
            ).toBe(true),
        )

        const createIdx = calls.findIndex(
            (c) => c.method === "POST" && c.url.endsWith("/api/v1/server-group"),
        )
        const getSettingIdx = calls.findIndex(
            (c, idx) => idx > createIdx && c.method === "GET" && c.url.endsWith("/api/v1/setting"),
        )
        const patchSettingIdx = calls.findIndex(
            (c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting"),
        )

        expect(createIdx).toBeGreaterThanOrEqual(0)
        expect(getSettingIdx).toBeGreaterThan(createIdx)
        expect(patchSettingIdx).toBeGreaterThan(getSettingIdx)
        expect(calls[createIdx].body).toEqual({ name: "New Group", servers: [] })

        const expectedCustomCode =
            '<script>window.CustomDesc = {"keep": "exact  bytes"};</script>\n' +
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"https://example.com/tencent.svg","3":"☁️","42":"🚀"}</script>\n' +
            "<style>.tail{opacity:1}</style>"

        expect(calls[patchSettingIdx].body).toEqual({
            ...snapshotBefore,
            custom_code: expectedCustomCode,
        })
    })

    test("editing group previews https image, shows error hint on image load failure, and clearing removes only its entry", async () => {
        const snapshotBefore = structuredClone(currentSetting.config)
        const mutate = vi.fn().mockResolvedValue(undefined)
        renderFresh(<ServerGroupCard data={currentGroups[0]} mutate={mutate} />)

        await waitFor(() =>
            expect(calls.some((c) => c.method === "GET" && c.url.endsWith("/api/v1/setting"))).toBe(
                true,
            ),
        )
        await act(async () => {
            fireEvent.click(screen.getByRole("button"))
        })

        const dialog = await screen.findByRole("dialog")
        const iconInput = within(dialog).getByLabelText("Icon") as HTMLInputElement
        await waitFor(() => expect(iconInput.value).toBe("https://example.com/tencent.svg"))

        const previewImg = within(dialog)
            .getByTestId("group-icon-preview")
            .querySelector("img") as HTMLImageElement
        expect(previewImg).not.toBeNull()
        expect(previewImg.getAttribute("src")).toBe("https://example.com/tencent.svg")

        await act(async () => {
            fireEvent.error(previewImg)
        })
        expect(within(dialog).getByRole("alert").textContent).toBe("Failed to load icon image")

        // Clear the icon -> removes group "1" from the JSON block while keeping group "3".
        await act(async () => {
            fireEvent.change(iconInput, { target: { value: "" } })
        })
        await act(async () => {
            fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }))
        })

        await waitFor(() =>
            expect(
                calls.some((c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting")),
            ).toBe(true),
        )
        const patchCall = calls.find(
            (c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting"),
        )!
        expect(patchCall.body).toEqual({
            ...snapshotBefore,
            custom_code:
                '<script>window.CustomDesc = {"keep": "exact  bytes"};</script>\n' +
                '<script type="application/json" id="nezha-kumo-group-icons">{"3":"☁️"}</script>\n' +
                "<style>.tail{opacity:1}</style>",
        })
    })

    test("does not PATCH /api/v1/setting when the JSON block is unchanged", async () => {
        const mutate = vi.fn().mockResolvedValue(undefined)
        renderFresh(<ServerGroupCard data={currentGroups[1]} mutate={mutate} />)

        await waitFor(() =>
            expect(calls.some((c) => c.method === "GET" && c.url.endsWith("/api/v1/setting"))).toBe(
                true,
            ),
        )
        await act(async () => {
            fireEvent.click(screen.getByRole("button"))
        })
        const dialog = await screen.findByRole("dialog")
        const nameInput = within(dialog).getByPlaceholderText("Group Name")
        const iconInput = within(dialog).getByLabelText("Icon") as HTMLInputElement
        await waitFor(() => expect(iconInput.value).toBe("☁️"))

        await act(async () => {
            fireEvent.change(nameInput, { target: { value: "Cloud Renamed" } })
        })
        await act(async () => {
            fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }))
        })

        await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
        expect(calls.some((c) => c.method === "PATCH" && c.url.includes("/server-group/3"))).toBe(
            true,
        )
        expect(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting"))).toBe(
            false,
        )
    })

    test("deleting a group removes its icon entry, while deleting an iconless group skips PATCH /api/v1/setting", async () => {
        renderFresh(<ServerGroupPage />)
        await screen.findByText("Cloud")

        // Row 2 is group 9 ("Plain", no icon): deleting it must NOT PATCH /api/v1/setting.
        const plainRow = screen.getByText("Plain").closest("tr")!
        const plainButtons = within(plainRow).getAllByRole("button")
        await act(async () => {
            fireEvent.click(plainButtons[plainButtons.length - 1])
        })
        const confirmDialog1 = await screen.findByRole("alertdialog")
        await act(async () => {
            fireEvent.click(within(confirmDialog1).getByRole("button", { name: "Confirm" }))
        })
        await waitFor(() => expect(screen.queryByText("Plain")).toBeNull())
        expect(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting"))).toBe(
            false,
        )

        // Row for group 3 ("Cloud", has icon "☁️"): deleting it removes "3" via PATCH /api/v1/setting.
        const cloudRow = screen.getByText("Cloud").closest("tr")!
        const cloudButtons = within(cloudRow).getAllByRole("button")
        await act(async () => {
            fireEvent.click(cloudButtons[cloudButtons.length - 1])
        })
        const confirmDialog2 = await screen.findByRole("alertdialog")
        await act(async () => {
            fireEvent.click(within(confirmDialog2).getByRole("button", { name: "Confirm" }))
        })
        await waitFor(() =>
            expect(
                calls.some((c) => c.method === "PATCH" && c.url.endsWith("/api/v1/setting")),
            ).toBe(true),
        )
        expect(parseGroupIcons(currentSetting.config.custom_code)).toEqual({
            "1": "https://example.com/tencent.svg",
        })
    })

    test("shared serializer escapes </ and admin locales cover zh-CN, zh-TW, en-US, ja-JP with en-US fallback", async () => {
        const block = serializeGroupIconsBlock({ "1": "https://example.com/a.svg?x=</script>" })
        expect(block).toContain("<\\/script>")
        expect(
            parseGroupIcons(updateGroupIconsInCustomCode("", { "1": "https://example.com/a.svg?x=</script>" })),
        ).toEqual({ "1": "https://example.com/a.svg?x=</script>" })

        for (const lng of ["zh-CN", "zh-TW", "en-US", "ja-JP", "fr-FR"]) {
            await i18n.changeLanguage(lng)
            for (const key of [
                "GroupIcon",
                "GroupIconPlaceholder",
                "GroupIconHint",
                "GroupIconLoadError",
                "GroupIconInvalid",
            ]) {
                const value = i18n.t(key)
                expect(value).not.toBe(key)
                expect(value.length).toBeGreaterThan(0)
            }
        }
    })
})
