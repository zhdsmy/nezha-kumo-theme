import * as apiTokensApi from "@/api/api-tokens"
import * as serverApi from "@/api/server"
import { AlertRuleCard } from "@/components/alert-rule"
import { ServerConfigCard } from "@/components/server-config"
import i18n from "@/lib/i18n"
import * as utils from "@/lib/utils"
import zhTW from "@/locales/zh-TW/translation.json"
import ApiTokensPage from "@/routes/api-tokens"
import CronPage from "@/routes/cron"
import ServerPage from "@/routes/server"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig } from "swr"
import { afterEach, describe, expect, test, vi } from "vitest"

vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({
        profile: { id: 1, username: "admin", role: 0 },
        loading: false,
    }),
}))

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({
        servers: [],
        serverGroups: [],
    }),
}))

vi.mock("@/hooks/useNotfication", () => ({
    useNotification: () => ({
        notifierGroup: [{ group: { id: 1, name: "Ops" }, notifications: [1] }],
    }),
}))

afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    await i18n.changeLanguage("en")
})

describe("U7: localized AgentConfig & AlertRule labels, closing row menu on dialog open, zh-TW traditional characters, and unified timestamps", () => {
    test("ServerConfigCard localizes all 14 fields in zh-CN without raw snake_case keys", async () => {
        await i18n.changeLanguage("zh-CN")
        vi.spyOn(serverApi, "getServerConfig").mockResolvedValue(
            JSON.stringify({
                debug: false,
                disable_auto_update: true,
                ip_report_period: 60,
                report_delay: 2,
            }),
        )

        render(<ServerConfigCard sid={1} />)
        fireEvent.click(screen.getByRole("button"))
        const dialog = await screen.findByRole("dialog")
        await waitFor(() =>
            expect(dialog.textContent).toContain(i18n.t("EditServerConfig")),
        )

        expect(dialog.textContent).not.toContain("ip_report_period")
        expect(dialog.textContent).not.toContain("disable_auto_update")
        expect(dialog.textContent).toContain(i18n.t("AgentConfig.ip_report_period"))
        expect(dialog.textContent).toContain(i18n.t("AgentConfig.disable_auto_update"))
    })

    test("opening ServerConfigCard from ServerPage row MoreActions menu closes the dropdown menu", async () => {
        vi.spyOn(serverApi, "getServerConfig").mockResolvedValue(JSON.stringify({ debug: false }))
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = String(input)
            if (url.includes("/api/v1/server")) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        data: [
                            {
                                id: 1,
                                name: "tokyo-edge-01",
                                uuid: "uuid-1",
                                display_index: 0,
                                host: { version: "1.0.0" },
                                geoip: { ip: { ipv4_addr: "203.0.113.10" } },
                            },
                        ],
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                )
            }
            return new Response(JSON.stringify({ success: true, data: [] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        })

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter>
                    <ServerPage />
                </MemoryRouter>
            </SWRConfig>,
        )

        await screen.findByText("tokyo-edge-01")
        const moreBtn = screen.getAllByRole("button", { name: i18n.t("MoreActions") })[0]!
        fireEvent.pointerDown(moreBtn, { button: 0, ctrlKey: false })
        fireEvent.click(moreBtn)

        const configMenuItem = await screen.findByRole("menuitem", { name: i18n.t("Config") })
        fireEvent.click(configMenuItem)

        const dialog = await screen.findByRole("dialog")
        await waitFor(() => expect(dialog.textContent).toContain(i18n.t("EditServerConfig")))
        expect(screen.queryByRole("menu")).toBeNull()
        expect(document.querySelector('[role="menu"]')).toBeNull()
    })

    test("AlertRuleCard localizes rule field labels (duration, min, max, cover) in zh-CN", async () => {
        await i18n.changeLanguage("zh-CN")
        render(
            <AlertRuleCard
                mutate={vi.fn()}
                data={{
                    id: 1,
                    created_at: "2025-01-01T00:00:00Z",
                    updated_at: "2025-01-01T00:00:00Z",
                    name: "CPU High",
                    enable: true,
                    trigger_mode: 0,
                    notification_group_id: 1,
                    fail_trigger_tasks: [],
                    recover_trigger_tasks: [],
                    rules: [{ type: "cpu", min: 80, max: 100, duration: 30, cover: 0 }],
                }}
            />,
        )

        fireEvent.click(screen.getByRole("button"))
        const dialog = await screen.findByRole("dialog")
        expect(dialog.textContent).toContain(i18n.t("AlertRules.Duration"))
        expect(dialog.textContent).toContain(i18n.t("AlertRules.Min"))
        expect(dialog.textContent).toContain(i18n.t("AlertRules.Max"))
        expect(dialog.textContent).toContain(i18n.t("Coverage"))
    })

    test("formatDateTime formats per locale and CronPage + ApiTokensPage handle zero dates and expired tokens", async () => {
        const formatDateTime = utils.formatDateTime
        expect(typeof formatDateTime).toBe("function")
        expect(formatDateTime("0001-01-01T00:00:00Z", "zh-CN", "从未")).toBe("从未")
        expect(formatDateTime(0, "en", "Never")).toBe("Never")
        for (const lng of ["en", "zh-CN", "zh-TW", "ja"]) {
            const formatted = formatDateTime("2026-05-10T08:30:00Z", lng, "—")
            expect(formatted).not.toContain("T08:30:00Z")
            expect(formatted).toContain("2026")
        }

        await i18n.changeLanguage("zh-CN")
        vi.spyOn(apiTokensApi, "listApiTokens").mockResolvedValue([
            {
                id: 1,
                name: "ci-expired",
                scopes: ["nezha:server:read"],
                created_at: "2024-01-01T00:00:00Z",
                expires_at: "2024-06-01T00:00:00Z",
                last_used_at: undefined,
            },
        ])
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    success: true,
                    data: [
                        {
                            id: 1,
                            name: "Daily Backup",
                            task_type: 0,
                            scheduler: "0 3 * * *",
                            command: "backup.sh",
                            servers: [1],
                            cover: 0,
                            last_executed_at: "0001-01-01T00:00:00Z",
                            last_result: false,
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter>
                    <ApiTokensPage />
                    <CronPage />
                </MemoryRouter>
            </SWRConfig>,
        )

        await screen.findByText("ci-expired")
        await screen.findByText("Daily Backup")

        expect(screen.getByText(i18n.t("Expired"))).toBeTruthy()
        expect(document.body.textContent).not.toContain("0001-01-01")
        // Unused token last_used_at should say "从未" (Never), not "永不" (ApiTokenNever)
        const lastUsedCell = document.querySelector('td[data-col="lastUsed"]')
        expect(lastUsedCell?.textContent).toBe(i18n.t("Never"))
        expect(zhTW.BlockByUser).toBe("被管理員封鎖")
    })
})
