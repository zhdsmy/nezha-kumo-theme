// Adapted from zool-theme/tests/live.test.ts (MIT, luoleiorg).
import { describe, expect, it } from "vitest"

import { bucketSeries } from "../src/core/live"
import type { HistoryPoint } from "../src/core/model"

const point = (at: number, netUp = 0): HistoryPoint => ({
    at,
    cpu: 0,
    memUsed: 0,
    swapUsed: 0,
    diskUsed: 0,
    netUp,
    netDown: 0,
    load1: 0,
    tcp: 0,
    udp: 0,
    process: 0,
})

describe("bucketSeries", () => {
    it("averages samples and leaves empty buckets null", () => {
        // Buckets are 100 ms wide: 0 and 50 share the first one, 100 starts the second.
        const points = [point(0, 10), point(50, 20), point(100, 7), point(900, 5)]
        const buckets = bucketSeries(points, (p) => p.netUp, 10, 0, 1000)
        expect(buckets).toHaveLength(10)
        expect(buckets[0].value).toBe(15)
        expect(buckets[1].value).toBe(7)
        expect(buckets[2].value).toBeNull() // the gap stays visible
        expect(buckets[9].value).toBe(5)
    })

    it("ignores samples outside the window", () => {
        const buckets = bucketSeries([point(-500, 99), point(500, 3)], (p) => p.netUp, 4, 0, 1000)
        expect(buckets.filter((b) => b.value !== null)).toHaveLength(1)
    })
})
