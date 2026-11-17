import { describe, expect, it } from "vitest"

import { buildXTicks, buildYTicks, stepDigits } from "../src/components/Chart"
import { formatTimeAxis, formatTimeTick } from "../src/components/NodeCharts"
import { formatBytes, formatClock, formatNumber, formatSpeed } from "../src/core/format"

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

describe("chart x-axis time ticks", () => {
    const locales = ["en", "zh-CN", "zh-TW", "ja"] as const

    it("keeps < 24h clock-only and >= 168h date-only across all 4 locales", () => {
        const ticks = [
            new Date(2026, 10, 16, 17, 30).getTime(),
            new Date(2026, 10, 17, 1, 30).getTime(),
            new Date(2026, 10, 17, 9, 30).getTime(),
            new Date(2026, 10, 17, 17, 30).getTime(),
        ]
        for (const locale of locales) {
            for (const hours of [0.25, 1, 4, 23]) {
                expect(formatTimeAxis(ticks, hours, locale)).toEqual(
                    ticks.map((t) => formatClock(t, false, locale)),
                )
            }
            for (const hours of [168, 720]) {
                expect(formatTimeAxis(ticks, hours, locale)).toEqual(
                    ticks.map((t) =>
                        new Date(t).toLocaleDateString(locale, {
                            month: "numeric",
                            day: "numeric",
                        }),
                    ),
                )
            }
        }
    })

    it("shows Intl date+clock on start and midnight transitions for [24h, 168h) across 4 locales", () => {
        const t0 = new Date(2026, 10, 16, 17, 30).getTime()
        const t1 = new Date(2026, 10, 17, 1, 30).getTime()
        const t2 = new Date(2026, 10, 17, 9, 30).getTime()
        const t3 = new Date(2026, 10, 17, 17, 30).getTime()
        const ticks = [t0, t1, t2, t3]

        for (const locale of locales) {
            const labels = formatTimeAxis(ticks, 24, locale)
            // First tick (Nov 16) and second tick (crossed midnight into Nov 17) carry date + clock
            expect(labels[0]).toBe(formatClock(t0, true, locale))
            expect(labels[1]).toBe(formatClock(t1, true, locale))
            expect(labels[0]).toContain("16")
            expect(labels[1]).toContain("17")
            expect(labels[0]).not.toBe(labels[1])
            // Same-day subsequent ticks stay compact clock-only
            expect(labels[2]).toBe(formatClock(t2, false, locale))
            expect(labels[3]).toBe(formatClock(t3, false, locale))
            expect(labels[2]).not.toContain("11")
            expect(labels[3]).not.toContain("11")
        }

        // Multi-day < 168h (e.g. 72h) shows each new day while keeping < 168h clock resolution
        const threeDays = [
            new Date(2026, 10, 14, 18, 0).getTime(),
            new Date(2026, 10, 15, 18, 0).getTime(),
            new Date(2026, 10, 16, 18, 0).getTime(),
            new Date(2026, 10, 17, 18, 0).getTime(),
        ]
        for (const locale of locales) {
            expect(formatTimeAxis(threeDays, 72, locale)).toEqual(
                threeDays.map((t) => formatClock(t, true, locale)),
            )
        }
    })

    it("prevents label overlap or out-of-bounds truncation across 375/867/952/1440 plot widths", () => {
        const startOffsets = [0, 2, 6, 12, 17.5, 23.5]
        // Representative plotW values for 375 (~245px), 867 (~455px), 952 (~540px), 1440 2-col (~454px) & PingChart (~990px)
        const plotWidths = [240, 255, 454, 540, 990]

        for (const locale of locales) {
            for (const offsetHours of startOffsets) {
                const end = new Date(2026, 11, 28, 0, 0).getTime() + offsetHours * 3_600_000
                const start = end - 24 * 3_600_000
                const fmt = (t: number, i: number, arr: readonly number[]) =>
                    formatTimeTick(t, i, arr, 24, locale)

                for (const plotW of plotWidths) {
                    const { ticks, labels } = buildXTicks(start, end, plotW, fmt)
                    expect(ticks.length).toBeGreaterThanOrEqual(2)
                    let prevRight = -Infinity
                    for (let i = 0; i < labels.length; i++) {
                        // Conservative upper bound matching measured 12px Inter tabular widths
                        const w = labels[i].length > 5 ? 75 : 34
                        const cx = (plotW * i) / (labels.length - 1)
                        const left = i === 0 ? 0 : i === labels.length - 1 ? plotW - w : cx - w / 2
                        const right = left + w
                        expect(left).toBeGreaterThanOrEqual(-0.5)
                        expect(right).toBeLessThanOrEqual(plotW + 0.5)
                        if (i > 0) expect(left - prevRight).toBeGreaterThanOrEqual(4)
                        prevRight = right
                    }
                }
            }
        }
    })
})
