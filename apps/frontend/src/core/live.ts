// Adapted from zool-theme/src/core/live.ts (MIT, luoleiorg).
import type { HistoryPoint } from "./model"

/**
 * Turning the live ring buffer into the shapes the instruments draw.
 *
 * The buffer holds up to 450 points at a ~2 s cadence (15 minutes). Instruments need far
 * fewer: a strip is ~64 px wide, so anything beyond ~60 points is invisible work. These
 * functions are pure so they can be tested without a browser.
 */

export interface Bucket {
    /** Bucket start, epoch ms. */
    at: number
    /** Average of the samples that landed in the bucket, or null when none did. */
    value: number | null
}

/**
 * Splits `[from, to]` into `count` equal buckets and averages each one. Buckets without a
 * sample stay `null` — that is what makes a gap visible instead of interpolated away.
 */
export function bucketSeries(
    points: readonly HistoryPoint[],
    pick: (p: HistoryPoint) => number,
    count: number,
    from: number,
    to: number,
): Bucket[] {
    const span = Math.max(1, to - from)
    const width = span / count
    const sums = new Float64Array(count)
    const hits = new Int32Array(count)
    for (const p of points) {
        if (p.at < from || p.at > to) continue
        const value = pick(p)
        if (!Number.isFinite(value)) continue
        const i = Math.min(count - 1, Math.floor((p.at - from) / width))
        sums[i] += value
        hits[i]++
    }
    return Array.from({ length: count }, (_, i) => ({
        at: from + i * width,
        value: hits[i] ? sums[i] / hits[i] : null,
    }))
}

/** Convenience wrapper: the last `minutes` of the buffer, ending now. */
export const recentBuckets = (
    points: readonly HistoryPoint[],
    pick: (p: HistoryPoint) => number,
    count: number,
    minutes: number,
    now = Date.now(),
) => bucketSeries(points, pick, count, now - minutes * 60_000, now)
