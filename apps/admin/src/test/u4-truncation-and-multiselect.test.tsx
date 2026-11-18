import "@/lib/i18n"
import { MultiSelect } from "@/components/xui/multi-select"
import DDNSPage from "@/routes/ddns"
import MCPOAuthManagementPage from "@/routes/mcp-oauth-management"
import TransferPage from "@/routes/transfer"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig } from "swr"
import { afterEach, describe, expect, test, vi } from "vitest"

vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({ profile: { id: 1, role: 0, username: "admin" }, loading: false }),
}))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("U4: long text truncation, MultiSelect overflow/duplicate clear, DDNS domains separator, and multiline cells", () => {
    test("DDNSPage joins multiple domains with ', ' instead of concatenating them", async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = String(input)
            if (url.includes("/api/v1/ddns/providers")) {
                return new Response(JSON.stringify({ success: true, data: ["cloudflare"] }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            }
            if (url.includes("/api/v1/ddns")) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        data: [
                            {
                                id: 1,
                                name: "Edge DNS",
                                provider: "cloudflare",
                                domains: ["ddns-a.example.com", "ddns-b.example.com"],
                                enable_ipv4: true,
                                enable_ipv6: false,
                                max_retries: 3,
                            },
                        ],
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                )
            }
            return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
        })

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter>
                    <DDNSPage />
                </MemoryRouter>
            </SWRConfig>,
        )

        const cellText = await screen.findByText("ddns-a.example.com, ddns-b.example.com")
        expect(cellText).toBeTruthy()
        expect(cellText.getAttribute("title")).toBe("ddns-a.example.com, ddns-b.example.com")
    })

    test("MultiSelect truncates 138-char pill label safely and avoids duplicate X icon when 1 option is selected", () => {
        const longLabel =
            "prod-apac-northeast-tokyo-dc04-rack19-blade07-nvme-raid10-high-memory-kubernetes-worker-node-primary-ingress-gateway-0001-extremely-long-host"
        const { rerender, container } = render(
            <MultiSelect
                options={[
                    { value: "1", label: longLabel },
                    { value: "2", label: "hk-edge-2" },
                ]}
                defaultValue={["1"]}
                onValueChange={() => undefined}
            />,
        )

        const labelSpan = screen.getByText(longLabel)
        expect(labelSpan.className).toContain("truncate")
        expect(labelSpan.getAttribute("title")).toBe(longLabel)

        // With 1 selected item, only the pill's own remove X should render (no duplicate clear-all X)
        const closeIconsSingle = container.querySelectorAll("svg.lucide-x")
        expect(closeIconsSingle.length).toBe(1)

        // With 2 selected items, each pill has an X plus 1 clear-all X = 3
        cleanup()
        const second = render(
            <MultiSelect
                options={[
                    { value: "1", label: longLabel },
                    { value: "2", label: "hk-edge-2" },
                ]}
                defaultValue={["1", "2"]}
                onValueChange={() => undefined}
            />,
        )
        expect(second.container.querySelectorAll("svg.lucide-x").length).toBe(3)
        void rerender
    })

    test("TransferPage renders multiline error cell without single-line truncate and toggles row open on click", async () => {
        const longError =
            "agent connection reset while re-keying transfer token: remote TLS handshake timed out after 30000ms on upstream relay gateway"
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    success: true,
                    data: [
                        {
                            id: 9,
                            server_id: 42,
                            from_user_id: 1,
                            to_user_id: 2,
                            initiator_id: 1,
                            status: 3,
                            last_error: longError,
                            created_at: "2026-11-18T02:00:00Z",
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter>
                    <TransferPage />
                </MemoryRouter>
            </SWRConfig>,
        )

        const errText = await screen.findByText(longError)
        const errCell = errText.closest('td[data-col="error"]')!
        expect(errCell.hasAttribute("data-multiline")).toBe(true)
        expect(errCell.className).not.toContain("truncate")

        const row = errCell.closest("tr")!
        fireEvent.click(errCell)
        expect(row.hasAttribute("data-open")).toBe(true)
    })

    test("MCPOAuthManagementPage marks stacked cells data-multiline so status and expiration lines are never clamped", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        items: [
                            {
                                id: "g1",
                                client_id: "claude-code-cli",
                                client_name: "Claude Code",
                                user_id: 1,
                                username: "admin",
                                status: "active",
                                scopes: ["nezha:server:read", "nezha:service:read", "nezha:cron:read"],
                                server_ids: [],
                                created_at: "2026-11-18T01:00:00Z",
                                expires_at: "2027-02-18T01:00:00Z",
                                last_used_at: "2026-11-18T02:00:00Z",
                                last_used_ip: "203.0.113.10",
                            },
                        ],
                        total: 1,
                    },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <MemoryRouter>
                    <MCPOAuthManagementPage />
                </MemoryRouter>
            </SWRConfig>,
        )

        await screen.findByText("Claude Code")
        expect(document.querySelector('td[data-col="name"]')?.hasAttribute("data-multiline")).toBe(
            true,
        )
        expect(
            document.querySelector('td[data-col="lifetime"]')?.hasAttribute("data-multiline"),
        ).toBe(true)
        expect(
            document.querySelector('td[data-col="permissions"]')?.hasAttribute("data-multiline"),
        ).toBe(true)
    })
})
