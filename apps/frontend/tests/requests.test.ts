import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

it("caps all requests at four and drains the queue without losing results", async () => {
    vi.resetModules()
    const releases: (() => void)[] = []
    let active = 0,
        peak = 0
    vi.stubGlobal(
        "fetch",
        () =>
            new Promise((resolve) => {
                active++
                peak = Math.max(peak, active)
                releases.push(() => {
                    active--
                    resolve(new Response('{"ok":true}'))
                })
            }),
    )
    const { request } = await import("../src/core/http")
    const requests = Array.from({ length: 11 }, (_, i) => request(`/test/${i}`))
    expect(releases).toHaveLength(4)
    for (let completed = 0; completed < 11;) {
        const batch = releases.splice(0)
        completed += batch.length
        batch.forEach((release) => release())
        if (completed < 11) await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0))
    }
    expect(await Promise.all(requests)).toEqual(Array.from({ length: 11 }, () => ({ ok: true })))
    expect(peak).toBe(4)
})

it("does not poll or start queued requests while hidden, and resumes once visible", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const doc = Object.assign(new EventTarget(), { visibilityState: "hidden" })
    vi.stubGlobal("document", doc)
    const fetch = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", fetch)
    const { request, pollVisible } = await import("../src/core/http")
    const pending = request("/queued")
    const load = vi.fn(async () => {})
    const stop = pollVisible(load, 600_000)
    await vi.advanceTimersByTimeAsync(1_200_000)
    expect(fetch).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    doc.visibilityState = "visible"
    doc.dispatchEvent(new Event("visibilitychange"))
    await pending
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(599_999)
    expect(load).toHaveBeenCalledTimes(1)
    doc.visibilityState = "hidden"
    doc.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(1_200_000)
    expect(load).toHaveBeenCalledTimes(1)
    doc.visibilityState = "visible"
    doc.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(2)
    stop()
})

it("shares metric periods across tabs, fetches only requested series and expires after ten minutes", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const fetch = vi.fn(
        async (_url: string) =>
            new Response(
                JSON.stringify({
                    success: true,
                    data: { data_points: [{ ts: Date.now(), value: 1 }] },
                }),
            ),
    )
    vi.stubGlobal("fetch", fetch)
    const { nezha, HISTORY_CACHE_MS } = await import("../src/adapters/nezha")
    await nezha.loadHistory("6", 24, "counters")
    expect(fetch).toHaveBeenCalledTimes(2)
    await nezha.loadHistory("6", 24, "billing")
    expect(fetch).toHaveBeenCalledTimes(4)
    await nezha.loadHistory("6", 24, "reports")
    expect(fetch).toHaveBeenCalledTimes(5)
    await nezha.loadHistory("6", 1, "reports")
    await nezha.loadHistory("6", 24, "billing")
    expect(fetch).toHaveBeenCalledTimes(5)
    await nezha.loadHistory("6", 168, "reports")
    expect(fetch).toHaveBeenCalledTimes(6)
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain("period=7d&metric=cpu")
    vi.setSystemTime(Date.now() + HISTORY_CACHE_MS + 1)
    await nezha.loadHistory("6", 24, "counters")
    expect(fetch).toHaveBeenCalledTimes(8)
})

it("keeps the left edge on a cached 4h to 1h switch and keeps reports clock-based", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const newest = Date.UTC(2026, 10, 19, 12)
    vi.setSystemTime(newest)
    const times = [65, 64, 60, 51, 0].map((minutes) => newest - minutes * 60_000)
    const fetch = vi.fn(async (url: string) =>
        Response.json({
            success: true,
            data: url.includes("/service?")
                ? [{ monitor_id: 1, created_at: times, avg_delay: [100, 90, 30, 20, 10] }]
                : { data_points: times.map((ts) => ({ ts, value: 1 })) },
        }),
    )
    vi.stubGlobal("fetch", fetch)
    const { nezha } = await import("../src/adapters/nezha")
    await nezha.loadHistory("6", 4, "overview")
    await nezha.loadPing("6", 4)
    const calls = fetch.mock.calls.length
    vi.setSystemTime(newest + 9 * 60_000)
    const overview = await nezha.loadHistory("6", 1, "overview")
    const ping = await nezha.loadPing("6", 1)
    const reports = await nezha.loadHistory("6", 1, "reports")
    expect(fetch).toHaveBeenCalledTimes(calls)
    expect(reports.map((p) => p.at)).toEqual(times.slice(3))
    expect(overview.map((p) => p.at)).toEqual(times.slice(1))
    expect(ping.points.map((p) => p.at)).toEqual(times.slice(1))
    expect(ping.tasks[0].avg).toBe(20)
})

it("cancels queued and in-flight requests cleanly, normalizes WebKit canceled fetches, and keeps timeouts as real errors", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    vi.stubGlobal(
        "fetch",
        (url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                const sig = init?.signal!
                signals.push(sig)
                if (url === "/webkit-unload") {
                    reject(
                        new TypeError(
                            "Fetch API cannot load http://127.0.0.1:5401/webkit-unload due to access control checks.",
                        ),
                    )
                    return
                }
                sig.addEventListener(
                    "abort",
                    () => reject(new DOMException("Aborted", "AbortError")),
                    { once: true },
                )
            }),
    )
    const { request, isCanceledError } = await import("../src/core/http")
    const slow = Array.from({ length: 4 }, (_, i) =>
        request(`/slow/${i}`, {}, 10_000).catch((e: unknown) => e),
    )
    const queuedCtrl = new AbortController()
    const queued = request("/queued", { signal: queuedCtrl.signal })
    queuedCtrl.abort()
    await expect(queued).rejects.toMatchObject({ name: "AbortError" })
    expect(signals).toHaveLength(4)

    await vi.advanceTimersByTimeAsync(10_000)
    for (const err of await Promise.all(slow)) {
        expect(isCanceledError(err)).toBe(false)
    }

    const wkErr = await request("/webkit-unload").catch((e: unknown) => e)
    expect(isCanceledError(wkErr)).toBe(true)
})

it("aborts underlying metric fetch only when all shared cache waiters cancel", async () => {
    vi.resetModules()
    const signals: AbortSignal[] = []
    let release!: () => void
    const fetch = vi.fn(
        (_url: string, init?: RequestInit) =>
            new Promise<Response>((resolve, reject) => {
                signals.push(init!.signal!)
                init!.signal!.addEventListener(
                    "abort",
                    () => reject(new DOMException("Aborted", "AbortError")),
                    { once: true },
                )
                release = () =>
                    resolve(
                        new Response(
                            JSON.stringify({
                                success: true,
                                data: { data_points: [{ ts: Date.now(), value: 2 }] },
                            }),
                        ),
                    )
            }),
    )
    vi.stubGlobal("fetch", fetch)
    const { nezha } = await import("../src/adapters/nezha")

    // Single waiter: abort cancels underlying fetch and evicts cache so next call refetches
    const c1 = new AbortController()
    const p1 = nezha.loadHistory("6", 1, "reports", c1.signal)
    c1.abort()
    await expect(p1).rejects.toMatchObject({ name: "AbortError" })
    expect(signals[0].aborted).toBe(true)

    // Shared waiters: aborting first waiter keeps underlying fetch alive for second waiter
    const c2 = new AbortController()
    const c3 = new AbortController()
    const p2 = nezha.loadHistory("6", 1, "reports", c2.signal)
    const p3 = nezha.loadHistory("6", 1, "reports", c3.signal)
    expect(fetch).toHaveBeenCalledTimes(2)
    c2.abort()
    await expect(p2).rejects.toMatchObject({ name: "AbortError" })
    expect(signals[1].aborted).toBe(false)
    release()
    await expect(p3).resolves.toHaveLength(1)
})

it.each([0.25, 1, 4, 24, 168, 720])(
    "uses the visible %sh for latency statistics and retains the left edge",
    async (hours) => {
        const end = Date.now() - 30_000
        const start = end - hours * 3_600_000
        vi.stubGlobal("fetch", async () =>
            Response.json({
                success: true,
                data: [
                    {
                        monitor_id: 1,
                        created_at: [start - 1000, start, end],
                        avg_delay: [900, 10, 20],
                    },
                    { monitor_id: 2, created_at: [start - 1000, start + 1], avg_delay: [800, -1] },
                ],
            }),
        )
        const { nezha } = await import("../src/adapters/nezha")
        const data = await nezha.loadPing("bounds-" + hours, hours)
        expect(data.tasks.map(({ avg, min, max }) => [avg, min, max])).toEqual([
            [15, 10, 20],
            [0, 0, 0],
        ])
        expect(data.points[0].at).toBe(start - 1000)
    },
)
