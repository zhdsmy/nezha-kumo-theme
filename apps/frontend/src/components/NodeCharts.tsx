// Chart composition adapted from zool-theme/src/pages/NodePage.tsx (MIT, luoleiorg).
import { formatBytes, formatClock, formatNumber, formatPercent, formatSpeed } from "@/core/format"
import type { HistoryPoint, NodeInfo, PingData } from "@/core/model"
import { spikeLimit } from "@/core/summary"
import { type ReactNode, memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Chart, type ChartSeries } from "./Chart"
import { CHART_PALETTE } from "./ui"

function useTimeFormats(hours: number) {
    const { i18n } = useTranslation()
    const long = hours >= 24
    return {
        axis: (t: number) =>
            hours >= 168
                ? new Date(t).toLocaleDateString(i18n.language, {
                      month: "numeric",
                      day: "numeric",
                  })
                : formatClock(t, false, i18n.language),
        tooltip: (t: number) =>
            new Date(t).toLocaleString(i18n.language, {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                ...(long ? { month: "numeric", day: "numeric" } : { second: "2-digit" }),
            }),
    }
}

function ChartCard({
    title,
    value,
    children,
}: {
    title: string
    value?: ReactNode
    children: ReactNode
}) {
    return (
        <div className="chart-card">
            <div className="chart-heading">
                <h3>{title}</h3>
                {value && (
                    <p
                        className="num numeric-text"
                        title={typeof value === "string" ? value : undefined}
                    >
                        {value}
                    </p>
                )}
            </div>
            {children}
        </div>
    )
}

function SeriesDot({ color }: { color: string }) {
    return (
        <span
            className="mr-1 inline-block h-[6px] w-[6px] rounded-full align-[1px]"
            style={{ background: color }}
            aria-hidden
        />
    )
}

export const LoadCharts = memo(function LoadCharts({
    node,
    points,
    hours,
    height,
    memTotal,
    diskTotal,
}: {
    node: NodeInfo
    points: HistoryPoint[]
    hours: number
    height: number
    memTotal: number
    diskTotal: number
}) {
    const { t } = useTranslation()
    const fmt = useTimeFormats(hours)
    const s = (
        key: string,
        label: string,
        color: string,
        pick: (p: HistoryPoint) => number,
        area = false,
    ): ChartSeries => ({
        key,
        label,
        color,
        area,
        points: points.map((p) => ({ t: p.at, v: pick(p) })),
    })
    const common = { height, formatTime: fmt.axis, formatTooltipTime: fmt.tooltip }
    const last = points[points.length - 1]

    return (
        <div className="chart-grid">
            <ChartCard
                title={t("metric.cpu")}
                value={last ? `${formatPercent(last.cpu)}%` : undefined}
            >
                <Chart
                    {...common}
                    label={t("metric.cpu")}
                    yMax={100}
                    format={(v) => `${formatNumber(v, 0)}%`}
                    series={[s("cpu", t("metric.cpu"), CHART_PALETTE[0], (p) => p.cpu, true)]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.memory")}
                value={last ? `${formatBytes(last.memUsed)} / ${formatBytes(memTotal)}` : undefined}
            >
                <Chart
                    {...common}
                    label={t("metric.memory")}
                    yMax={memTotal || undefined}
                    format={(v) => formatBytes(v, 1)}
                    series={[
                        s("mem", t("metric.memory"), CHART_PALETTE[1], (p) => p.memUsed, true),
                        ...(node.swapTotal
                            ? [s("swap", t("metric.swap"), CHART_PALETTE[2], (p) => p.swapUsed)]
                            : []),
                    ]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.disk")}
                value={
                    last ? `${formatBytes(last.diskUsed)} / ${formatBytes(diskTotal)}` : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.disk")}
                    yMax={diskTotal || undefined}
                    format={(v) => formatBytes(v, 0)}
                    series={[
                        s("disk", t("metric.disk"), CHART_PALETTE[2], (p) => p.diskUsed, true),
                    ]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.network")}
                value={
                    last ? (
                        <>
                            <SeriesDot color={CHART_PALETTE[0]} />↑ {formatSpeed(last.netUp)} ·{" "}
                            <SeriesDot color={CHART_PALETTE[1]} />↓ {formatSpeed(last.netDown)}
                        </>
                    ) : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.network")}
                    format={(v) => formatSpeed(v)}
                    series={[
                        s("up", t("metric.upload"), CHART_PALETTE[0], (p) => p.netUp, true),
                        s("down", t("metric.download"), CHART_PALETTE[1], (p) => p.netDown),
                    ]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.connections")}
                value={
                    last ? (
                        <>
                            <SeriesDot color={CHART_PALETTE[0]} />
                            TCP {last.tcp} · <SeriesDot color={CHART_PALETTE[3]} />
                            UDP {last.udp}
                        </>
                    ) : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.connections")}
                    format={(v) => formatNumber(v, 0)}
                    series={[
                        s("tcp", t("metric.tcp"), CHART_PALETTE[0], (p) => p.tcp, true),
                        s("udp", t("metric.udp"), CHART_PALETTE[3], (p) => p.udp),
                    ]}
                />
            </ChartCard>
            <ChartCard
                title={`${t("metric.load")} · ${t("metric.process")}`}
                value={last ? `${formatNumber(last.load1)} · ${last.process}` : undefined}
            >
                <Chart
                    {...common}
                    label={t("metric.load")}
                    format={(v) =>
                        formatNumber(v, v > 0 && v < 1 && Math.round(v * 100) % 10 !== 0 ? 2 : 1)
                    }
                    series={[s("load", t("metric.load"), CHART_PALETTE[1], (p) => p.load1, true)]}
                />
            </ChartCard>
        </div>
    )
})

export const PingChart = memo(function PingChart({
    data,
    hours,
    height,
    shave,
}: {
    data: PingData
    hours: number
    height: number
    shave: boolean
}) {
    const { t } = useTranslation()
    const fmt = useTimeFormats(hours)
    // null = every line. The first click isolates a line, later clicks add or remove lines,
    // and removing the last one (or adding the last missing one) goes back to every line.
    const [shown, setShown] = useState<Set<number> | null>(null)
    const [focus, setFocus] = useState<number | null>(null)
    const color = (i: number) => CHART_PALETTE[i % CHART_PALETTE.length]
    const visible = (id: number) => shown === null || shown.has(id)
    const toggle = (id: number) =>
        setShown((prev) => {
            if (prev === null) return new Set([id])
            const next = new Set(prev)
            if (!next.delete(id)) next.add(id)
            return next.size === 0 || next.size === data.tasks.length ? null : next
        })
    const solo = shown?.size === 1 ? data.tasks.find((task) => shown.has(task.id)) : undefined
    const series: ChartSeries[] = useMemo(
        () =>
            data.tasks.flatMap((task, i) => {
                if (!visible(task.id)) return []
                let points = data.points
                    .filter((p) => p.task === task.id)
                    .map((p) => ({ t: p.at, v: p.value >= 0 ? p.value : null }))
                if (shave) {
                    // spikes are dropped, not blanked, so the line runs straight through them
                    const limit = spikeLimit(points.flatMap((p) => (p.v === null ? [] : [p.v])))
                    points = points.filter((p) => p.v === null || p.v <= limit)
                }
                return [{ key: String(task.id), label: task.name, color: color(i), points }]
            }),
        [data, shown, shave],
    )

    return (
        <div className="chart-card latency-card">
            <Chart
                series={series}
                height={height}
                robust
                focus={focus !== null && visible(focus) ? String(focus) : null}
                format={(v) => `${formatNumber(v, 0)} ms`}
                formatTime={fmt.axis}
                formatTooltipTime={fmt.tooltip}
                label={t("node.tabPing")}
            />
            {/* chips, not a table: a line's colour, name and average; the full figures show when it is the only line */}
            <div
                className="node-ping-list -mx-1.5 mt-2 flex flex-wrap gap-x-0.5"
                onPointerLeave={() => setFocus(null)}
            >
                {data.tasks.map((task, i) => (
                    <button
                        key={task.id}
                        type="button"
                        aria-pressed={visible(task.id)}
                        onClick={() => toggle(task.id)}
                        onPointerEnter={(e) => e.pointerType === "mouse" && setFocus(task.id)}
                        title={`${task.name} · ${t("node.min")} ${formatNumber(task.min, 0)} · ${t("node.max")} ${formatNumber(task.max, 0)} ms`}
                        className={`node-ping-row inline-flex max-w-full min-h-7 items-center gap-1.5 rounded-full px-1.5 text-[12px] transition-opacity hover:bg-kumo-tint ${visible(task.id) ? "" : "opacity-40"}`}
                    >
                        <span
                            className="size-2 shrink-0 rounded-full"
                            style={
                                visible(task.id)
                                    ? { background: color(i) }
                                    : { boxShadow: `inset 0 0 0 1.5px ${color(i)}` }
                            }
                        />
                        <span className="truncate">{task.name}</span>
                        <span className="num text-kumo-subtle">
                            {formatNumber(task.avg, task.avg < 10 ? 1 : 0)}
                        </span>
                    </button>
                ))}
                {shown !== null && (
                    <button
                        type="button"
                        className="min-h-7 rounded-full px-1.5 text-[12px] text-kumo-link hover:bg-kumo-tint"
                        onClick={() => setShown(null)}
                    >
                        {t("node.showAllLines")}
                    </button>
                )}
            </div>
            {solo && (
                <p className="node-ping-detail num mt-1 text-[12px] text-kumo-subtle">
                    {t("node.avg")}{" "}
                    <span className="text-kumo-default">{formatNumber(solo.avg, 1)} ms</span> ·{" "}
                    {t("node.min")} {formatNumber(solo.min, 0)} · {t("node.max")}{" "}
                    {formatNumber(solo.max, 0)}
                </p>
            )}
        </div>
    )
})
