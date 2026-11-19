// Adapted from zool-theme/src/core/summary.ts (MIT, luoleiorg).
import type { HistoryPoint, NodeInfo, Snapshot } from "./model"

interface DaySummary {
    todayUp: number
    todayDown: number
    peakUp: number
    peakUpAt: number
    peakDown: number
    peakDownAt: number
}

/** Merge counter observations by report time; history wins duplicate readings. */
export function mergeHistoryTail(
    history: readonly HistoryPoint[],
    live: readonly HistoryPoint[],
    since: number,
) {
    const readings = new Map<number, HistoryPoint>()
    for (const p of [...live, ...history]) {
        const at = p.reportedAt ?? p.at
        if (at < since) continue
        const previous = readings.get(at)
        readings.set(at, {
            ...p,
            at,
            totalUp: p.totalUp ?? previous?.totalUp,
            totalDown: p.totalDown ?? previous?.totalDown,
        })
    }
    return [...readings.values()].sort((a, b) => a.at - b.at)
}

/** Counter drops start a new segment; its first reading is traffic observed since reset. */
export function dailyTraffic(points: readonly HistoryPoint[], midnight: number): HistoryPoint[] {
    let previousUp: number | undefined, previousDown: number | undefined
    let up = 0,
        down = 0
    return mergeHistoryTail(points, [], midnight).map((p) => {
        if (p.totalUp !== undefined) {
            if (previousUp !== undefined)
                up += p.totalUp >= previousUp ? p.totalUp - previousUp : p.totalUp
            previousUp = p.totalUp
        }
        if (p.totalDown !== undefined) {
            if (previousDown !== undefined)
                down += p.totalDown >= previousDown ? p.totalDown - previousDown : p.totalDown
            previousDown = p.totalDown
        }
        return {
            ...p,
            totalUp: previousUp === undefined ? undefined : up,
            totalDown: previousDown === undefined ? undefined : down,
        }
    })
}

/**
 * Today's traffic sums counter increments since local midnight, including resets, so it
 * does not depend on how the backend buckets its records. Peaks are the highest recorded
 * averages in the given points (the node page passes the last 24 hours).
 */
export function summariseDay(
    points: HistoryPoint[],
    now: Pick<Snapshot, "at" | "totalUp" | "totalDown"> | undefined,
    midnight: number,
): DaySummary {
    const s: DaySummary = {
        todayUp: 0,
        todayDown: 0,
        peakUp: 0,
        peakUpAt: 0,
        peakDown: 0,
        peakDownAt: 0,
    }
    for (const p of points) {
        if (p.netUp > s.peakUp) {
            s.peakUp = p.netUp
            s.peakUpAt = p.at
        }
        if (p.netDown > s.peakDown) {
            s.peakDown = p.netDown
            s.peakDownAt = p.at
        }
    }
    const readings =
        now && points.length
            ? mergeHistoryTail(
                  points,
                  [{ ...points[points.length - 1], ...now, reportedAt: now.at }],
                  midnight,
              )
            : points
    const total = dailyTraffic(readings, midnight).at(-1)
    s.todayUp = total?.totalUp ?? 0
    s.todayDown = total?.totalDown ?? 0
    return s
}

/** Chart bounds use the newest raw sample, before route selection or downsampling. */
export const chartWindow = (end: number, hours: number) => ({ start: end - hours * 3_600_000, end })

/**
 * Latency above this counts as a spike: Tukey's far-out fence (Q3 + 3 × IQR), never
 * tighter than 1.5 × the median, so a steady 2 ms line keeps its normal 3–4 ms jitter.
 */
export function spikeLimit(values: number[]): number {
    if (values.length < 8) return Infinity
    const s = [...values].sort((a, b) => a - b)
    const q = (f: number) => s[Math.floor((s.length - 1) * f)]
    return Math.max(q(0.75) + 3 * (q(0.75) - q(0.25)), q(0.5) * 1.5)
}

/** Each direction needs its own recorded baseline; a live snapshot cannot supply it. */
export const hasDailyCounters = (points: readonly HistoryPoint[] | undefined, midnight: number) =>
    (["totalUp", "totalDown"] as const).every((key) =>
        points?.some((p) => (p.reportedAt ?? p.at) >= midnight && Number.isFinite(p[key])),
    )

export function summariseFleetDay(
    nodes: readonly NodeInfo[],
    snapshots: Record<string, Snapshot>,
    counters: Record<string, HistoryPoint[]> | null,
    midnight: number,
) {
    let amount = 0,
        included = 0
    for (const n of nodes) {
        const points = counters?.[n.id]
        if (!snapshots[n.id] || !points || !hasDailyCounters(points, midnight)) continue
        const day = summariseDay(points, snapshots[n.id], midnight)
        amount += day.todayUp + day.todayDown
        included++
    }
    return { amount: included ? amount : null, included }
}
