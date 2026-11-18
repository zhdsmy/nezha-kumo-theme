// Adapted from zool-theme/tests/store.test.ts (MIT, luoleiorg).
import { afterEach, describe, expect, it, vi } from "vitest"

type Listener = (event: { snapshots: Record<string, unknown>; nodes?: unknown[] }) => void

const fake = vi.hoisted(() => {
    const node = (id: string) => ({ id, name: id, groups: [], weight: 0 })
    const f = {
        listeners: [] as Listener[],
        unsubscribed: 0,
        resets: 0,
        loads: 0,
        nodes: [node("a")],
        groupOrder: ["Tencent", "AWS"],
        failNextLoad: false,
        loggedIn: false,
        privateLoads: 0,
        failPrivateLoad: false,
        node,
    }
    return f
})

vi.mock("@/adapters/nezha", () => ({
    nezha: {
        loadSite: async () => ({
            name: "x",
            description: "",
            settings: {},
            recordHours: 0,
            oauth: false,
            passwordLogin: true,
        }),
        loadNodes: async () => {
            fake.loads++
            if (fake.failNextLoad) {
                fake.failNextLoad = false
                throw new Error("offline")
            }
            return fake.nodes
        },
        loadGroupOrder: async () => fake.groupOrder,
        loadSession: async () => ({ loggedIn: fake.loggedIn }),
        loadActualCosts: async () => {
            fake.privateLoads++
            if (fake.failPrivateLoad) throw new Error("private API unavailable")
            return { a: { amount: 0, currency: "CNY" } }
        },
        subscribe: (l: Listener) => {
            fake.listeners.push(l)
            return () => {
                fake.unsubscribed++
                fake.listeners = fake.listeners.filter((x) => x !== l)
            }
        },
        reset: () => {
            fake.resets++
        },
    },
}))

const snap = {
    online: true,
    at: 1,
    cpu: 1,
    memUsed: 0,
    memTotal: 0,
    swapUsed: 0,
    swapTotal: 0,
    diskUsed: 0,
    diskTotal: 0,
    netUp: 0,
    netDown: 0,
    totalUp: 0,
    totalDown: 0,
    load1: 0,
    load5: 0,
    load15: 0,
    uptime: 0,
    tcp: 0,
    udp: 0,
    process: 0,
}
const emit = (id = "a") => fake.listeners.forEach((l) => l({ snapshots: { [id]: snap } }))

afterEach(() => {
    vi.useRealTimers()
})

describe("store: fed and refresh", () => {
    it("is not fed until the first live frame, then is", async () => {
        const { start, getState } = await import("../src/app/store")
        await start()
        expect(getState().phase).toBe("ready")
        expect(getState().groupOrder).toEqual(["Tencent", "AWS"])
        expect(getState().fed).toBe(false)
        emit()
        expect(getState().fed).toBe(true)
        expect(getState().snapshots.a).toBeTruthy()
    })

    it("refresh reloads nodes, resets the adapter, resubscribes and keeps snapshots", async () => {
        const { refresh, getState } = await import("../src/app/store")
        const before = { loads: fake.loads, resets: fake.resets, unsub: fake.unsubscribed }
        fake.nodes = [fake.node("a"), fake.node("b")]
        const running = refresh()
        expect(getState().refreshing).toBe(true)
        await running
        expect(fake.loads).toBe(before.loads + 1)
        expect(fake.resets).toBe(before.resets + 1)
        expect(fake.unsubscribed).toBe(before.unsub + 1)
        expect(fake.listeners).toHaveLength(1)
        expect(getState().nodes.map((n) => n.id)).toEqual(["a", "b"])
        expect(getState().snapshots.a).toBeTruthy()
        expect(getState().fed).toBe(true)
        expect(getState().refreshing).toBe(true)
        emit("b")
        expect(getState().refreshing).toBe(false)
    })

    it("ignores a second refresh while one is running", async () => {
        const { refresh } = await import("../src/app/store")
        const loads = fake.loads
        const first = refresh()
        const second = refresh()
        await Promise.all([first, second])
        expect(fake.loads).toBe(loads + 1)
        emit()
    })

    it("keeps what is shown when the reload fails, and still reconnects", async () => {
        const { refresh, getState } = await import("../src/app/store")
        const nodes = getState().nodes
        fake.failNextLoad = true
        const err = vi.spyOn(console, "error").mockImplementation(() => {})
        await refresh()
        err.mockRestore()
        expect(getState().nodes).toBe(nodes)
        expect(getState().phase).toBe("ready")
        expect(fake.listeners).toHaveLength(1)
        emit()
        expect(getState().refreshing).toBe(false)
    })

    it("marks a node that drops out of a frame offline and keeps its last readings", async () => {
        const { getState } = await import("../src/app/store")
        fake.listeners.forEach((l) => l({ snapshots: { a: snap, b: snap } }))
        expect(getState().snapshots.b.online).toBe(true)
        fake.listeners.forEach((l) => l({ snapshots: { a: snap } }))
        expect(getState().snapshots.b.online).toBe(false)
        expect(getState().snapshots.b.cpu).toBe(1)
        expect(getState().snapshots.a.online).toBe(true)
    })

    it("updates metadata even when the node identity and groups stay the same", async () => {
        const { getState } = await import("../src/app/store")
        const nodes = [{ ...fake.node("a"), cpuName: "new processor" }]
        fake.listeners.forEach((l) => l({ snapshots: { a: snap }, nodes }))
        expect(getState().nodes[0]).toMatchObject({ cpuName: "new processor" })
        const stable = getState().nodes
        fake.listeners.forEach((l) => l({ snapshots: { a: snap }, nodes: structuredClone(nodes) }))
        expect(getState().nodes).toBe(stable)
    })

    it("never loads private billing for guests", async () => {
        const { refresh, getState } = await import("../src/app/store")
        const before = fake.privateLoads
        await refresh()
        emit()
        expect(fake.privateLoads).toBe(before)
        expect(getState().actualCosts).toBeNull()
    })

    it("loads private billing after authentication and clears it before a logout refresh", async () => {
        const { refresh, getState } = await import("../src/app/store")
        fake.loggedIn = true
        await refresh()
        emit()
        expect(getState().actualCosts).toEqual({ a: { amount: 0, currency: "CNY" } })
        fake.loggedIn = false
        const before = fake.privateLoads
        const refreshing = refresh()
        expect(getState().actualCosts).toBeNull()
        await refreshing
        emit()
        expect(getState().session.loggedIn).toBe(false)
        expect(getState().actualCosts).toBeNull()
        expect(fake.privateLoads).toBe(before)
    })

    it("keeps private billing unavailable when the protected API fails", async () => {
        const { refresh, getState } = await import("../src/app/store")
        fake.loggedIn = true
        fake.failPrivateLoad = true
        await refresh()
        emit()
        expect(getState().session.loggedIn).toBe(true)
        expect(getState().actualCosts).toBeNull()
        fake.loggedIn = false
        fake.failPrivateLoad = false
    })
})

it("retains unchanged snapshot references while another row changes", async () => {
    const { getState } = await import("../src/app/store")
    fake.listeners.forEach((l) => l({ snapshots: { a: snap, b: snap } }))
    const before = getState().snapshots
    fake.listeners.forEach((l) =>
        l({ snapshots: { a: structuredClone(snap), b: { ...snap, cpu: 25 } } }),
    )
    expect(getState().snapshots.a).toBe(before.a)
    expect(getState().snapshots.b).not.toBe(before.b)
    const stable = getState().snapshots
    fake.listeners.forEach((l) =>
        l({ snapshots: { a: structuredClone(snap), b: { ...snap, cpu: 25 } } }),
    )
    expect(getState().snapshots).toBe(stable)
})

it("retains reset segments after chart eviction, handles late reports and clears yesterday", async () => {
    vi.useFakeTimers()
    const midnight = new Date(2026, 10, 17).getTime()
    vi.setSystemTime(midnight + 1000)
    const { getLive, getTraffic } = await import("../src/app/store")
    const { dailyTraffic, mergeHistoryTail } = await import("../src/core/summary")
    const report = (offset: number, totalUp: number) => {
        vi.setSystemTime(midnight + 1000 + offset)
        fake.listeners.forEach((l) =>
            l({ snapshots: { reset: { ...snap, at: midnight + offset, totalUp } } }),
        )
    }
    report(1000, 1000)
    report(2000, 1500)
    report(3000, 100)
    for (let i = 0; i < 500; i++) report(4000 + i, 200 + i)
    expect(getLive("reset")).toHaveLength(450)
    report(1500, 1200)
    const history = [
        { ...snap, at: midnight + 1000, totalUp: 1000 },
        { ...snap, at: midnight + 5000, totalUp: 699 },
    ]
    expect(
        dailyTraffic(mergeHistoryTail(history, getTraffic("reset"), midnight), midnight).at(-1)
            ?.totalUp,
    ).toBe(1199)
    expect(getTraffic("reset").length).toBeLessThanOrEqual(456)
    report(86_400_000, 800)
    expect(dailyTraffic(getTraffic("reset"), midnight + 86_400_000).map((p) => p.totalUp)).toEqual([
        0,
    ])
})

it("publishes counter reports even when their browser receipt timestamp is equal", async () => {
    vi.useFakeTimers()
    const now = new Date(2026, 10, 17, 12).getTime()
    vi.setSystemTime(now)
    const { getState, getTraffic } = await import("../src/app/store")
    const { dailyTraffic } = await import("../src/core/summary")
    const version = getState().liveVersion
    for (const [i, totalUp] of [1000, 1500, 100, 200].entries()) {
        fake.listeners.forEach((l) =>
            l({ snapshots: { burst: { ...snap, at: now - 1000 + i, totalUp } } }),
        )
    }
    expect(getState().liveVersion).toBe(version + 4)
    expect(dailyTraffic(getTraffic("burst"), now - 1000).at(-1)?.totalUp).toBe(700)
})

it("refreshes node references on live frames when crossing midnight or a renewal timestamp", async () => {
    vi.useFakeTimers()
    const beforeMidnight = new Date(2026, 10, 18, 23, 59, 58).getTime()
    const renewAt = new Date(2026, 10, 19, 12, 0, 0).getTime()
    const expAt = new Date(2026, 10, 26, 18, 0, 0).getTime()
    vi.setSystemTime(beforeMidnight)

    const { refresh, getState } = await import("../src/app/store")
    const { needsAttention } = await import("../src/core/fleet")
    const { resolveExpiry } = await import("../src/core/expiry")

    fake.nodes = [
        { ...fake.node("exp"), expiredAt: expAt, autoRenewal: false } as never,
        {
            ...fake.node("ren"),
            expiredAt: renewAt,
            autoRenewal: true,
            cycle: { count: 1, unit: "Month" },
        } as never,
    ]
    await refresh()
    emit("exp")
    const initialNodes = getState().nodes
    expect(needsAttention(initialNodes[0], { ...snap, at: beforeMidnight }, true)).toBe(false)

    // Frame 1 second later (same calendar day, before renewal): state.nodes stays identical
    vi.setSystemTime(beforeMidnight + 1000)
    emit("exp")
    expect(getState().nodes).toBe(initialNodes)

    // Cross local midnight -> next frame updates state.nodes so day count drops 8 -> 7 (attention!)
    const afterMidnight = new Date(2026, 10, 19, 0, 0, 2).getTime()
    vi.setSystemTime(afterMidnight)
    emit("exp")
    const midnightNodes = getState().nodes
    expect(midnightNodes).not.toBe(initialNodes)
    expect(needsAttention(midnightNodes[0], { ...snap, at: afterMidnight }, true)).toBe(true)

    // Cross renewal timestamp -> next frame updates state.nodes while preserving raw expiredAt
    vi.setSystemTime(renewAt + 1000)
    emit("ren")
    const renewedNodes = getState().nodes
    expect(renewedNodes).not.toBe(midnightNodes)
    expect(renewedNodes[1].expiredAt).toBe(renewAt)
    expect(resolveExpiry(renewedNodes[1])?.at).toBe(new Date(2026, 11, 19, 12, 0, 0).getTime())
})
