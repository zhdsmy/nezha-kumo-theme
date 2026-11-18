// Adapted from zool-theme/src/components/HourGrid.tsx (MIT, luoleiorg).
import { ChartCard } from "@/components/NodeCharts"
import { formatNumber, ratio } from "@/core/format"
import { bucketSeries } from "@/core/live"
import type { HistoryPoint } from "@/core/model"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const HOUR = 3_600_000
const SCALE_TICKS = ["00", "06", "12", "18"] as const

/**
 * Seven days, one cell per hour: filled when the node reported, hollow when it did not.
 *
 * Seven days is the longest range the backend keeps at hourly resolution — the 30-day range
 * is averaged to one point per day, which quietly swallows a real outage. Drawing 90 days
 * from it would be fiction, so this grid stops where the honest data stops.
 */
export function HourGrid({ points, days = 7 }: { points: readonly HistoryPoint[]; days?: number }) {
    const { t, i18n } = useTranslation()
    const [selected, setSelected] = useState<{
        at: number
        stamp: string
        state: "up" | "down"
        pinned: boolean
    } | null>(null)
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

    const pickFromTarget = (target: EventTarget | null, pin: boolean) => {
        const el = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-at]") : null
        if (!el) return
        const at = Number(el.dataset.at)
        const stamp = el.dataset.stamp ?? ""
        const state = el.dataset.state === "down" ? "down" : "up"
        setSelected((prev) => {
            if (pin && prev?.pinned && prev.at === at) return null
            if (!pin && prev?.pinned) return prev
            return { at, stamp, state, pinned: pin }
        })
    }

    return (
        <ChartCard
            title={t("node.reportRate")}
            value={t("node.reportedHours", { rate, seen: formatNumber(seen, 1), count: elapsed })}
        >
            <div
                className="hour-grid-scale mb-1.5 grid grid-cols-4 pl-12 text-[10px] text-kumo-subtle num"
                aria-hidden="true"
            >
                {SCALE_TICKS.map((tick) => (
                    <span key={tick}>{tick}</span>
                ))}
            </div>
            <div
                className="hour-grid-rows"
                onClick={(e) => pickFromTarget(e.target, true)}
                onPointerMove={(e) => {
                    if (e.pointerType === "mouse") pickFromTarget(e.target, false)
                }}
                onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") {
                        setSelected((prev) => (prev?.pinned ? prev : null))
                    }
                }}
            >
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
                                const interactive = state !== "unwatched"
                                return (
                                    <span
                                        key={at}
                                        data-at={interactive ? at : undefined}
                                        data-state={interactive ? state : undefined}
                                        data-stamp={interactive ? stamp : undefined}
                                        // Padding outside the rolling window carries no reading or tooltip.
                                        title={
                                            inWindow(at)
                                                ? `${t(state === "up" ? "node.historyUp" : state === "down" ? "node.historyDown" : "node.historyEmpty")} · ${stamp}`
                                                : undefined
                                        }
                                        className={`hour-grid-cell flex-1 rounded-[1px] ${interactive ? "cursor-pointer" : ""} ${state === "up" ? "bg-kumo-success" : state === "down" ? "bg-kumo-danger" : "cell-empty"}`}
                                    />
                                )
                            })}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="hour-grid-legend flex flex-wrap items-center gap-3 text-kumo-subtle">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-[1px] bg-kumo-success" aria-hidden="true" />
                        {t("node.historyUp")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-[1px] bg-kumo-danger" aria-hidden="true" />
                        {t("node.historyDown")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="cell-empty size-2 rounded-[1px]" aria-hidden="true" />
                        {t("node.historyEmpty")}
                    </span>
                </div>
                {selected ? (
                    <span className="hour-grid-selected num text-kumo-default">
                        {selected.stamp} ·{" "}
                        {t(selected.state === "up" ? "node.historyUp" : "node.historyDown")}
                    </span>
                ) : (
                    <span className="muted">{t("ui.historyHint")}</span>
                )}
            </div>
        </ChartCard>
    )
}
