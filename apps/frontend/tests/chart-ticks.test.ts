import { describe, expect, it } from "vitest"

import { buildYTicks, stepDigits } from "../src/components/Chart"
import { formatBytes, formatNumber, formatSpeed } from "../src/core/format"

describe("chart y-axis ticks", () => {
    it("generates nice 1-2-5 decimal steps that cover dataMax and yMax", () => {
        expect(buildYTicks(37, { yMax: 100 })).toEqual({
            max: 100,
            step: 50,
            ticks: [0, 50, 100],
        })
        expect(buildYTicks(112, { yMax: 100 })).toEqual({
            max: 150,
            step: 50,
            ticks: [0, 50, 100, 150],
        })
        expect(buildYTicks(66.33333333333333, { minStep: 1 })).toEqual({
            max: 100,
            step: 50,
            ticks: [0, 50, 100],
        })

        for (const v of [0.03, 0.12, 0.78, 1, 1.4, 2.7, 7.1, 13, 35, 99, 420, 1350]) {
            const { max, step, ticks } = buildYTicks(v)
            expect(max).toBeGreaterThanOrEqual(v)
            expect(ticks[0]).toBe(0)
            expect(ticks.at(-1)).toBe(max)
            const exp = 10 ** Math.floor(Math.log10(step))
            const mantissa = Number((step / exp).toPrecision(6))
            expect([1, 2, 5]).toContain(mantissa)
            const labels = ticks.map((t) => formatNumber(t, stepDigits(step)))
            expect(new Set(labels).size).toBe(labels.length)
        }
    })

    it("keeps sub-millisecond and single-line latency ticks distinct", () => {
        const subMs = buildYTicks(0.78)
        expect(subMs.ticks).toEqual([0, 0.5, 1])
        const labels = subMs.ticks.map((v) => `${formatNumber(v, stepDigits(subMs.step))} ms`)
        expect(labels).toEqual(["0 ms", "0.5 ms", "1 ms"])

        const tiny = buildYTicks(0.08)
        const tinyLabels = tiny.ticks.map((v) => `${formatNumber(v, stepDigits(tiny.step))} ms`)
        expect(new Set(tinyLabels).size).toBe(tinyLabels.length)
        expect(tiny.max).toBeGreaterThanOrEqual(0.08)
    })

    it("generates 1024-aligned binary ticks with integer unit labels", () => {
        // 1017.1 MB and 987.1 MB (1 GB RAM hosts) -> 0 B, 512 MB, 1 GB
        for (const mb of [987.1, 1017.1]) {
            const res = buildYTicks(339 * 1024 ** 2, { scale: "binary", yMax: mb * 1024 ** 2 })
            expect(res.max).toBeGreaterThanOrEqual(mb * 1024 ** 2)
            expect(res.ticks.map((v) => formatBytes(v, 0))).toEqual(["0 B", "512 MB", "1 GB"])
        }

        // 14.8 GB disk -> 0 B, 8 GB, 16 GB (no 7 GB / 15 GB rounding mismatch)
        const disk = buildYTicks(5.76 * 1024 ** 3, { scale: "binary", yMax: 14.8 * 1024 ** 3 })
        expect(disk.max).toBeGreaterThanOrEqual(14.8 * 1024 ** 3)
        expect(disk.ticks.map((v) => formatBytes(v, 0))).toEqual(["0 B", "8 GB", "16 GB"])

        // 1.43 MB/s network speed -> 0 B/s, 1 MB/s, 2 MB/s
        const net = buildYTicks(1.43 * 1024 ** 2, { scale: "binary" })
        expect(net.max).toBeGreaterThanOrEqual(1.43 * 1024 ** 2)
        expect(net.ticks.map((v) => formatSpeed(v, 0))).toEqual(["0 B/s", "1 MB/s", "2 MB/s"])

        // Arbitrary binary scales produce strictly distinct, exact integer labels
        for (const b of [
            0.5,
            12,
            700,
            620 * 1024,
            2.5 * 1024 ** 2,
            21.5 * 1024 ** 3,
            2.1 * 1024 ** 4,
        ]) {
            const { max, ticks } = buildYTicks(b, { scale: "binary" })
            expect(max).toBeGreaterThanOrEqual(b)
            const formatted = ticks.map((v) => formatBytes(v, 0))
            expect(new Set(formatted).size).toBe(formatted.length)
            for (const label of formatted) {
                expect(label).toMatch(/^\d+ (B|KB|MB|GB|TB|PB|EB)$/)
            }
        }
    })

    it("handles all-zero, non-finite, and constant single-value series cleanly", () => {
        expect(buildYTicks(0)).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] })
        expect(buildYTicks(0, { minStep: 1 })).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] })
        expect(buildYTicks(0, { scale: "binary" })).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] })
        expect(buildYTicks(Number.NaN)).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] })
        expect(buildYTicks(-5)).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] })

        // Constant single value (e.g. flat line at 1 or 5 GB)
        const flatDec = buildYTicks(1)
        expect(flatDec.ticks).toEqual([0, 0.5, 1])
        expect(
            new Set(flatDec.ticks.map((v) => formatNumber(v, stepDigits(flatDec.step)))).size,
        ).toBe(flatDec.ticks.length)

        const flatConnections = buildYTicks(0.4, { minStep: 1 })
        expect(flatConnections).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] })

        const flatBin = buildYTicks(5 * 1024 ** 3, { scale: "binary" })
        expect(flatBin.ticks.map((v) => formatBytes(v, 0))).toEqual(["0 B", "2 GB", "4 GB", "6 GB"])
    })
})
