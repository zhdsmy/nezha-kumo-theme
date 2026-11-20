import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { nezha } from "../src/adapters/nezha"
import { backfillLive, getLive, getState, liveNeedsFill, start } from "../src/app/store"
import type { LiveEvent } from "../src/core/model"
import { emptySnapshot } from "./snapshot"

const base = Date.UTC(2026, 10, 19, 4)
let emit: (event: LiveEvent) => void
const point = (seconds: number) => ({ ...emptySnapshot(true), at: base + seconds * 1000 })

function frame(id: string, seconds: number) {
    const sample = point(seconds)
    vi.setSystemTime(sample.at)
    emit({ nodes: [], snapshots: { [id]: sample } })
}

beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(base)
    vi.spyOn(nezha, "loadSite").mockResolvedValue({
        name: "",
        settings: {},
        recordHours: 24,
        oauth: false,
    })
    vi.spyOn(nezha, "loadNodes").mockResolvedValue([])
    vi.spyOn(nezha, "loadGroupOrder").mockResolvedValue([])
    vi.spyOn(nezha, "loadSession").mockResolvedValue({ loggedIn: false })
    vi.spyOn(nezha, "subscribe").mockImplementation((listener) => {
        emit = listener
        return () => {}
    })
    await start()
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

it("fills the leading gap after all pre-pause frames expire", async () => {
    const id = "long-pause"
    const history = vi.spyOn(nezha, "loadHistory").mockResolvedValue([])
    frame(id, 0)
    await backfillLive(id)
    frame(id, 960)
    expect(liveNeedsFill(id)).toBe(true)
    history.mockResolvedValue([point(59), point(60), point(930)])
    await backfillLive(id)
    expect(getLive(id).map((p) => p.at)).toEqual([60, 930, 960].map((s) => point(s).at))
    expect(liveNeedsFill(id)).toBe(false)
})

it("retries the failed first fill on the ten-second cycle", async () => {
    const id = "first-fill"
    const history = vi
        .spyOn(nezha, "loadHistory")
        .mockRejectedValueOnce(Error("offline"))
        .mockResolvedValue([point(-30)])
    frame(id, 0)
    await backfillLive(id)
    for (let s = 2; s <= 10; s += 2) {
        vi.advanceTimersByTime(2000)
        frame(id, s)
        if (liveNeedsFill(id)) await backfillLive(id)
        expect(history).toHaveBeenCalledTimes(s < 10 ? 1 : 2)
    }
    expect(getLive(id)[0].at).toBe(point(-30).at)
})

it("drops the pending retry when the page that asked for the fill leaves", async () => {
    const id = "left-page"
    vi.spyOn(nezha, "loadHistory").mockRejectedValue(Error("offline"))
    frame(id, 0)
    const ctrl = new AbortController()
    await backfillLive(id, ctrl.signal)
    expect(vi.getTimerCount()).toBe(1)
    const version = getState().liveVersion
    ctrl.abort()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(getState().liveVersion).toBe(version)
})

it("fills every live metric fresh after home spark loading and keeps other periods cached", async () => {
    const id = "warm-cache"
    const fetch = vi.fn(async (url: string) =>
        Response.json({
            success: true,
            data: url.includes("/service?")
                ? []
                : { data_points: [{ ts: Date.now() - 30_000, value: 22 }] },
        }),
    )
    vi.stubGlobal("fetch", fetch)
    frame(id, 0)
    await nezha.loadHistory(id, 0.25, "spark")
    await nezha.loadHistory(id, 168, "reports")
    await nezha.loadPing(id, 720)
    frame(id, 240)
    await backfillLive(id)
    expect(getLive(id).find((p) => p.at === point(210).at)).toMatchObject({
        cpu: 22,
        netUp: 22,
        netDown: 22,
        memUsed: 22,
    })
    fetch.mockClear()
    await nezha.loadHistory(id, 168, "reports")
    await nezha.loadPing(id, 720)
    expect(fetch).not.toHaveBeenCalled()
})

it("coalesces pending fills and leaves an aborted gap eligible", async () => {
    const id = "pending"
    frame(id, 0)
    frame(id, 60)
    let release!: () => void
    const history = vi.spyOn(nezha, "loadHistory").mockImplementation(
        () =>
            new Promise((resolve) => {
                release = () => resolve([point(30)])
            }),
    )
    const ctrl = new AbortController()
    const first = backfillLive(id, ctrl.signal)
    frame(id, 80)
    const second = backfillLive(id, ctrl.signal)
    expect(history).toHaveBeenCalledTimes(1)
    ctrl.abort()
    release()
    await Promise.all([first, second])
    expect(getLive(id).some((p) => p.at === point(30).at)).toBe(false)
    expect(liveNeedsFill(id)).toBe(true)
})

it("keeps the successful mark when an earlier failure would have retried", async () => {
    const id = "newer-fill"
    frame(id, 0)
    frame(id, 60)
    vi.spyOn(nezha, "loadHistory").mockRejectedValueOnce(Error("offline")).mockResolvedValue([])
    await backfillLive(id)
    vi.advanceTimersByTime(2000)
    await backfillLive(id)
    vi.advanceTimersByTime(8000)
    expect(liveNeedsFill(id)).toBe(false)
})

it("rejects future history without losing the next live frame", async () => {
    const id = "future"
    frame(id, 0)
    vi.spyOn(nezha, "loadHistory").mockResolvedValue([point(-30), point(60)])
    await backfillLive(id)
    frame(id, 2)
    expect(getLive(id).map((p) => p.at)).toEqual([-30, 0, 2].map((s) => point(s).at))
})
