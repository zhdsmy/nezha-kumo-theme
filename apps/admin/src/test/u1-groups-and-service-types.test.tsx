import i18n from "@/lib/i18n"
import NotificationPage from "@/routes/notification"
import ServerPage from "@/routes/server"
import ServicePage from "@/routes/service"
import { serviceTypes } from "@/types/service"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SWRConfig } from "swr"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const state = vi.hoisted(() => ({
    serverGroups: undefined as
        | Array<{ group: { id: number; name: string }; servers: number[] }>
        | undefined,
    notifierGroup: undefined as
        | Array<{ group: { id: number; name: string }; notifications: number[] }>
        | undefined,
}))

vi.mock("@/api/api", () => ({
    swrFetcher: async (url: string) => {
        if (url === "/api/v1/server") {
            return [
                {
                    id: 1,
                    uuid: "uuid-1",
                    name: "edge-jp-01",
                    display_index: 10,
                    host: { version: "1.18.2" },
                    geoip: { ip: { ipv4_addr: "198.51.100.2", ipv6_addr: "" }, country_code: "jp" },
                    note: "",
                    public_note: "",
                    hide_for_guest: false,
                    enable_ddns: false,
                },
            ]
        }
        if (url === "/api/v1/notification") {
            return [
                {
                    id: 1,
                    name: "PagerDuty Primary",
                    url: "https://events.pagerduty.com/v2/enqueue",
                    request_method: 2,
                    request_type: 1,
                    request_header: "{}",
                    request_body: "{}",
                    verify_tls: true,
                },
            ]
        }
        if (url === "/api/v1/service/list") {
            return [
                {
                    id: 3,
                    name: "TLS Cert Expiry",
                    type: 4,
                    target: "status.example.com:443",
                    duration: 300,
                    cover: 0,
                    notify: true,
                    notification_group_id: 1,
                },
            ]
        }
        return []
    },
}))

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({ servers: [], serverGroups: state.serverGroups }),
}))

vi.mock("@/hooks/useNotfication", () => ({
    useNotification: () => ({ notifierGroup: state.notifierGroup }),
}))

vi.mock("@/hooks/useSetting", () => ({
    default: () => ({
        data: { config: { install_host: "dash.example.com:8008", tls: true } },
    }),
}))

beforeEach(async () => {
    state.serverGroups = undefined
    state.notifierGroup = undefined
    await i18n.changeLanguage("zh-CN")
})

afterEach(() => {
    cleanup()
})

test("U1: server and notification tables render group names even when group providers resolve after table rows", async () => {
    const cache = new Map()
    const { rerender } = render(
        <MemoryRouter initialEntries={["/dashboard/notification"]}>
            <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
                <ServerPage />
                <NotificationPage />
            </SWRConfig>
        </MemoryRouter>,
    )

    await screen.findByText("edge-jp-01")
    await screen.findByText("PagerDuty Primary")

    state.serverGroups = [
        { group: { id: 1, name: "亚太核心边缘" }, servers: [1, 2] },
        { group: { id: 2, name: "全球 Anycast BGP" }, servers: [1] },
    ]
    state.notifierGroup = [{ group: { id: 1, name: "NOC 值班核心组" }, notifications: [1] }]

    await act(async () => {
        rerender(
            <MemoryRouter initialEntries={["/dashboard/notification"]}>
                <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
                    <ServerPage />
                    <NotificationPage />
                </SWRConfig>
            </MemoryRouter>,
        )
    })

    await waitFor(() => {
        expect(screen.getByText("亚太核心边缘, 全球 Anycast BGP")).toBeTruthy()
        expect(screen.getByText("NOC 值班核心组")).toBeTruthy()
    })
})

test("U1: serviceTypes maps type 4 to TLS and renders TLS in ServicePage", async () => {
    expect(serviceTypes[4]).toBe("TLS")
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <ServicePage />
        </SWRConfig>,
    )
    await screen.findByText("TLS Cert Expiry")
    expect(screen.getByText("TLS")).toBeTruthy()
})
