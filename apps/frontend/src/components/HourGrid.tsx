// Adapted from zool-theme/src/components/HourGrid.tsx (MIT, luoleiorg).
import { ChartCard } from "@/components/NodeCharts"
import { formatNumber, ratio } from "@/core/format"
import { bucketSeries } from "@/core/live"
import type { HistoryPoint } from "@/core/model"
import { useTranslation } from "react-i18next"

const HOUR = 3_600_000

/**
 * Seven days, one cell per hour: filled when the node reported, hollow when it did not.
 *
 * Seven days is the longest range the backend keeps at hourly resolution — the 30-day range
 * is averaged to one point per day, which quietly swallows a real outage. Drawing 90 days
 * from it would be fiction, so this grid stops where the honest data stops.
 */
export function HourGrid({ points, days = 7 }: { points: readonly HistoryPoint[]; days?: number }) {
    const { t, i18n } = useTranslation()
    const now = Date.now()
    const since = now - days * 24 * HOUR
    const from = new Date(since).setHours(0, 0, 0, 0)
    const to = new Date(now).setHours(24, 0, 0, 0)
    const watched = points.filter((p) => p.at >= since && p.at <= now)
    const inWindow = (at: number) => at <= now && at + HOUR > since
    const buckets = bucketSeries(watched, (p) => p.at, (to - from) / HOUR, from, to)
    // Partial boundary cells contribute only their duration inside the rolling window.
    const elapsed = (now - since) / HOUR
    const seen = buckets.reduce(
        (sum, b) =>
            sum +
            (b.value === null
                ? 0
                : Math.max(0, Math.min(now, b.at + HOUR) - Math.max(since, b.at)) / HOUR),
        0,
    )
    const first = watched.length ? Math.min(...watched.map((p) => p.at)) : now
    const rows = new Map<string, typeof buckets>()
    for (const bucket of buckets) {
        const day = new Date(bucket.at).toLocaleDateString(i18n.language, {
            month: "numeric",
            day: "numeric",
        })
        const row = rows.get(day) ?? []
        row.push(bucket)
        rows.set(day, row)
    }
    const rate = formatNumber(ratio(seen, elapsed), 1)

    return (
        <ChartCard
            title={t("node.reportRate")}
            value={t("node.reportedHours", { rate, seen: formatNumber(seen, 1), count: elapsed })}
        >
            <div className="hour-grid-rows">
                {[...rows].map(([day, row]) => (
                    <div key={day} className="flex items-center gap-2">
                        <span className="num w-10 shrink-0 text-right text-[10px] text-kumo-subtle">
                            {day}
                        </span>
                        <span className="flex flex-1 gap-[2px]">
                            {row.map((cell) => {
                                const at = cell.at
                                // Hours we never watched, and hours still ahead of the clock, are not outages.
                                const state =
                                    !inWindow(at) || at < first - HOUR
                                        ? "unwatched"
                                        : cell.value !== null
                                          ? "up"
                                          : "down"
                                const hour = new Date(at)
                                const stamp = `${hour.toLocaleDateString(i18n.language, { month: "numeric", day: "numeric" })} ${String(hour.getHours()).padStart(2, "0")}:00`
                                return (
                                    <span
                                        key={at}
                                        // Padding outside the rolling window carries no reading or tooltip.
                                        title={inWindow(at) ? stamp : undefined}
                                        className={`hour-grid-cell flex-1 rounded-[1px] ${state === "up" ? "bg-kumo-success" : state === "down" ? "bg-kumo-danger" : "cell-empty"}`}
                                    />
                                )
                            })}
                        </span>
                    </div>
                ))}
            </div>
            <p className="muted mt-4 text-xs">{t("ui.historyHint")}</p>
        </ChartCard>
    )
}
