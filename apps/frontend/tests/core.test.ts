// Adapted from zool-theme/tests/core.test.ts (MIT, luoleiorg).
import { describe, expect, it } from "vitest"

import {
    daysUntil,
    formatBytes,
    formatNumber,
    formatSpeed,
    monthlyCost,
    trafficUsed,
} from "../src/core/format"
import { flagToRegion, stripFlag } from "../src/core/region"
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/core/settings"
import { spikeLimit, summariseDay } from "../src/core/summary"

describe("format", () => {
    it("keeps fractional bytes and rates in base units", () => {
        for (const n of [0.1, 0.5, 0.99]) {
            expect(formatBytes(n)).toBe(`${n.toFixed(2)} B`)
            expect(formatSpeed(n)).toBe(`${n.toFixed(2)} B/s`)
        }
        expect(formatBytes(0.5, 1)).toBe("0.5 B")
        expect(formatSpeed(1)).toBe("1 B/s")
    })
    it("formats bytes with sensible precision", () => {
        expect(formatBytes(0)).toBe("0 B")
        expect(formatBytes(512)).toBe("512 B")
        expect(formatBytes(1536)).toBe("1.50 KB")
        expect(formatBytes(125 * 1024 ** 4)).toBe("125 TB")
    })

    it("trims only decimal zeros", () => {
        expect(formatNumber(100, 0)).toBe("100")
        expect(formatNumber(50, 1)).toBe("50")
        expect(formatNumber(0.5)).toBe("0.5")
        expect(formatNumber(2.0)).toBe("2")
    })

    it("follows the traffic limit type", () => {
        expect(trafficUsed("sum", 3, 4)).toBe(7)
        expect(trafficUsed("max", 3, 4)).toBe(4)
    })

    it("normalises prices to a month", () => {
        expect(monthlyCost(120, 365)).toBe(10)
        expect(monthlyCost(30, 90)).toBe(10)
        expect(monthlyCost(60, 182)).toBe(10)
        expect(monthlyCost(240, 730)).toBe(10)
        expect(monthlyCost(360, 1095)).toBe(10)
        expect(monthlyCost(10, 31)).toBe(10)
        expect(monthlyCost(365, 1)).toBeCloseTo((365 * 365) / 12)
        expect(monthlyCost(Infinity, 30)).toBe(0)
        expect(monthlyCost(-1, 30)).toBe(0)
        expect(monthlyCost(10, 0)).toBe(0)
        expect(daysUntil(Date.now() + 86_400_000 * 2.5)).toBe(3)
    })
})

describe("day summary", () => {
    const p = (
        at: number,
        netUp: number,
        netDown: number,
        totalUp?: number,
        totalDown?: number,
    ) => ({
        at,
        cpu: 0,
        memUsed: 0,
        swapUsed: 0,
        diskUsed: 0,
        netUp,
        netDown,
        load1: 0,
        tcp: 0,
        udp: 0,
        process: 0,
        totalUp,
        totalDown,
    })

    it("uses counter growth since midnight and the highest recorded rates", () => {
        const midnight = 1_000
        const s = summariseDay(
            [p(500, 9, 1, 100, 200), p(1_000, 3, 7, 150, 260), p(2_000, 5, 2, 400, 300)],
            { totalUp: 450, totalDown: 360 },
            midnight,
        )
        expect(s).toMatchObject({
            todayUp: 300,
            todayDown: 100,
            peakUp: 9,
            peakUpAt: 500,
            peakDown: 7,
            peakDownAt: 1_000,
        })
    })

    it("never reports negative traffic after a counter reset", () => {
        const s = summariseDay([p(2_000, 1, 1, 900, 900)], { totalUp: 10, totalDown: 10 }, 1_000)
        expect(s.todayUp).toBe(0)
        expect(s.todayDown).toBe(0)
    })
})

describe("region", () => {
    it("reads flag emoji", () => {
        expect(flagToRegion("🇺🇸 SJC")).toBe("US")
        expect(flagToRegion("🏠 Home")).toBe("")
        expect(stripFlag("🇭🇰 HK Bage")).toBe("HK Bage")
        expect(stripFlag("🏠 ChinaNet")).toBe("🏠 ChinaNet")
    })
})

describe("settings", () => {
    it("fills every key when the backend sends nothing", () => {
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
        expect(
            normalizeSettings({
                defaultAppearance: "nope",
                showCost: "false",
                hiddenNodes: "a, b",
            }),
        ).toMatchObject({
            defaultAppearance: "system",
            showCost: false,
            hiddenNodes: ["a", "b"],
        })
    })
})

describe("spikeLimit", () => {
    it("drops rare spikes but keeps normal jitter", () => {
        const line = [100, 96, 104, 98, 102, 101, 99, 97, 103, 100, 1151, 640]
        const limit = spikeLimit(line)
        expect(line.filter((v) => v > limit)).toEqual([1151, 640])
        expect(spikeLimit([2, 3, 2, 3, 2, 2, 3, 4, 2, 16])).toBeGreaterThanOrEqual(4)
        expect(spikeLimit([2, 3, 2, 3, 2, 2, 3, 4, 2, 16])).toBeLessThan(16)
        expect(spikeLimit([1, 500])).toBe(Infinity)
    })
})

describe("partial fleet daily counters", () => {
    it("sums only nodes with a current-day baseline and labels the coverage", async () => {
        const { summariseFleetDay } = await import("../src/core/summary")
        const { emptySnapshot } = await import("./snapshot")
        const nodes = [
            { id: "a" },
            { id: "b" },
            { id: "c" },
        ] as import("../src/core/model").NodeInfo[]
        const snapshots = Object.fromEntries(
            nodes.map((n) => [n.id, { ...emptySnapshot(), totalUp: 100, totalDown: 80 }]),
        )
        const point = { ...emptySnapshot(), at: 1000, totalUp: 50, totalDown: 40 }
        const result = summariseFleetDay(
            nodes,
            snapshots,
            { a: [point], b: [], c: [{ ...point, at: 999 }] },
            1000,
        )
        expect(result).toEqual({ amount: 90, included: 1 })
        expect(summariseFleetDay(nodes, snapshots, {}, 1000)).toEqual({ amount: null, included: 0 })
    })
})
