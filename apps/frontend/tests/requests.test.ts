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
