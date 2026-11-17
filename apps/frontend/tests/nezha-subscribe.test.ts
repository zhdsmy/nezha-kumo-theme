// Adapted from zool-theme/tests/nezha-subscribe.test.ts (MIT, luoleiorg).
import { afterAll, beforeAll, expect, it, vi } from "vitest"

import { nezha } from "../src/adapters/nezha"
import type { LiveEvent } from "../src/core/model"
import frame from "./fixtures/nezha-frame.json"
import groups from "./fixtures/nezha-groups.json"

/** A socket that opens and delivers one recorded frame on the next tick. */
class FakeSocket {
    static OPEN = 1
    static frame: object = frame
    static latest: FakeSocket
    readyState = 1
    onopen: (() => void) | null = null
    onmessage: ((e: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    constructor() {
        FakeSocket.latest = this
        setTimeout(() => {
            this.onopen?.()
            this.onmessage?.({ data: JSON.stringify(FakeSocket.frame) })
        }, 0)
    }
    send() {}
    close() {}
}

beforeAll(() => {
    vi.useFakeTimers()
    vi.stubGlobal("window", {
        location: { protocol: "https:", host: "status.test" },
        NezhaKumoConfig: {},
    })
    vi.stubGlobal("WebSocket", FakeSocket)
    vi.stubGlobal(
        "fetch",
        async (url: string) =>
            new Response(
                JSON.stringify(url.includes("server-group") ? groups : { success: true, data: {} }),
                { status: 200 },
            ),
    )
})

afterAll(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

it.each([503, 200])(
    "retries failed groups (%s) for nodes, order, icons and live mapping",
    async (status) => {
        nezha.reset()
        let failed = true
        let calls = 0
        vi.stubGlobal("fetch", async (url: string) => {
            if (url.includes("server-group")) {
                calls++
                return new Response(JSON.stringify(failed ? { success: false } : groups), {
                    status: failed ? status : 200,
                })
            }
            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        config: {
                            custom_code:
                                '<script type="application/json" id="nezha-kumo-group-icons">{"1":"☁️"}</script>',
                        },
                    },
                }),
            )
        })
        const first = Promise.allSettled([
            nezha.loadNodes(),
            nezha.loadGroupOrder(),
            nezha.loadSite(),
        ])
        await vi.advanceTimersByTimeAsync(0)
        expect((await first).map((r) => r.status)).toEqual(["rejected", "rejected", "rejected"])
        expect(calls).toBe(1)
        failed = false
        const [nodes, order, site] = await Promise.all([
            nezha.loadNodes(),
            nezha.loadGroupOrder(),
            nezha.loadSite(),
        ])
        expect(calls).toBe(2)
        expect(order.length).toBeGreaterThan(0)
        expect(Object.keys(site.groupIcons ?? {})).toHaveLength(1)
        const events: LiveEvent[] = []
        const stop = nezha.subscribe((event) => events.push(event))
        expect(events[0].nodes?.map((n) => n.groups)).toEqual(nodes.map((n) => n.groups))
        stop()
        nezha.reset()
    },
)

it("keeps groups on the first live event after loadNodes (no flicker)", async () => {
    const loading = nezha.loadNodes()
    // Deliver the socket's first frame without waiting for a real event-loop tick.
    await vi.advanceTimersByTimeAsync(0)
    const nodes = await loading
    expect(vi.getTimerCount()).toBe(1) // Live socket inactivity watchdog.
    const grouped = nodes.filter((n) => n.groups.length).length
    expect(grouped).toBeGreaterThan(10)

    const events: LiveEvent[] = []
    const stop = nezha.subscribe((e) => events.push(e))
    // The hub replays the last frame synchronously on subscribe.
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].nodes!.filter((n) => n.groups.length).length).toBe(grouped)
    stop()
})

it("reset drops the cached frame and socket, so the next load waits for a new frame", async () => {
    const created = vi.fn()
    vi.stubGlobal(
        "WebSocket",
        class extends FakeSocket {
            constructor() {
                super()
                created()
            }
        },
    )
    const fetches = vi.fn()
    vi.stubGlobal("fetch", async (url: string) => {
        fetches(url)
        return new Response(
            JSON.stringify(url.includes("server-group") ? groups : { success: true, data: {} }),
            { status: 200 },
        )
    })

    nezha.reset!()
    let settled = false
    const loading = nezha.loadNodes().then((n) => {
        settled = true
        return n
    })
    // Not answered from the old frame: nothing resolves before the new socket delivers.
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(created).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(0)
    const nodes = await loading
    expect(nodes.length).toBeGreaterThan(0)
    // Groups are fetched again rather than served from the previous promise.
    expect(fetches.mock.calls.some(([u]) => String(u).includes("server-group"))).toBe(true)
})

it("replaces note cache on reconnect even when the new first frame omits the note", async () => {
    const server = { id: 999, name: "cache test" }
    nezha.reset()
    FakeSocket.frame = {
        now: Date.now(),
        servers: [
            {
                ...server,
                public_note: JSON.stringify({
                    billingDataMod: { amount: "USD 12", cycle: "Month" },
                }),
            },
        ],
    }
    const first = nezha.loadNodes()
    await vi.advanceTimersByTimeAsync(0)
    expect((await first)[0].price).toBe(12)
    const events: LiveEvent[] = []
    const stop = nezha.subscribe((e) => events.push(e))
    FakeSocket.frame = { now: Date.now(), servers: [server] }
    FakeSocket.latest.onclose?.()
    await vi.advanceTimersByTimeAsync(2001)
    expect(events.at(-1)?.nodes?.[0].price).toBe(0)
    stop()
    nezha.reset()
    FakeSocket.frame = frame
})

it("accepts the official empty-fleet frame with omitted servers", async () => {
    nezha.reset()
    FakeSocket.frame = { now: Date.now(), online: 0 }
    try {
        const loading = nezha.loadNodes()
        await vi.advanceTimersByTimeAsync(0)
        const result = await Promise.race([loading, Promise.resolve("pending")])
        expect(result).toEqual([])
    } finally {
        nezha.reset()
        FakeSocket.frame = frame
    }
})
