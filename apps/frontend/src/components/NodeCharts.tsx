// Chart composition adapted from zool-theme/src/pages/NodePage.tsx (MIT, luoleiorg).
import { formatBytes, formatClock, formatNumber, formatPercent, formatSpeed } from "@/core/format"
import type { HistoryPoint, NodeInfo, PingData } from "@/core/model"
import { chartWindow, spikeLimit } from "@/core/summary"
import { Popover } from "@cloudflare/kumo/components/popover"
import { Switch } from "@cloudflare/kumo/components/switch"
import { InfoIcon } from "@phosphor-icons/react"
import { type ReactNode, memo, useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Chart, type ChartSeries, stepDigits } from "./Chart"
import { CHART_PALETTE } from "./ui"

const HOURS_PER_DAY = 24
const HOURS_PER_WEEK = 168

function sameLocalDay(a: number, b: number): boolean {
    const da = new Date(a)
    const db = new Date(b)
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    )
}

export function formatTimeTick(
    t: number,
    index: number,
    ticks: readonly number[],
    hours: number,
    locale?: string,
): string {
    if (hours >= HOURS_PER_WEEK) {
        return new Date(t).toLocaleDateString(locale, {
            month: "numeric",
            day: "numeric",
        })
    }
    const showDate = hours >= HOURS_PER_DAY && (index === 0 || !sameLocalDay(ticks[index - 1], t))
    return formatClock(t, showDate, locale)
}

export function formatTimeAxis(ticks: readonly number[], hours: number, locale?: string): string[] {
    return ticks.map((t, i) => formatTimeTick(t, i, ticks, hours, locale))
}

function useTimeFormats(hours: number) {
    const { i18n } = useTranslation()
    const long = hours >= HOURS_PER_DAY
    return {
        axis: (t: number, index = 0, ticks: readonly number[] = [t]) =>
            formatTimeTick(t, index, ticks, hours, i18n.language),
        tooltip: (t: number) =>
            long
                ? formatClock(t, true, i18n.language)
                : new Date(t).toLocaleString(i18n.language, {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                  }),
    }
}

export function ChartCard({
    title,
    value,
    action,
    children,
}: {
    title: string
    value?: ReactNode
    action?: ReactNode
    children: ReactNode
}) {
    const headingId = useId()
    return (
        <section className="chart-card" aria-labelledby={headingId}>
            <div className="chart-heading">
                <h3 id={headingId}>{title}</h3>
                {value && (
                    <p
                        className="num numeric-text"
                        title={typeof value === "string" ? value : undefined}
                    >
                        {value}
                    </p>
                )}
                {action}
            </div>
            {children}
        </section>
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
        points: points.map((p) => ({ t: p.at, v: Number.isFinite(pick(p)) ? pick(p) : null })),
    })
    const common = {
        height,
        formatTime: fmt.axis,
        formatTooltipTime: fmt.tooltip,
        timeWindow: chartWindow(points.at(-1)?.at ?? 0, hours),
    }
    const last = points[points.length - 1]
    const reading = (value: number, format: (value: number) => string) =>
        Number.isFinite(value) ? format(value) : "—"

    return (
        <div className="chart-grid">
            <ChartCard
                title={t("metric.cpu")}
                value={last ? reading(last.cpu, (v) => `${formatPercent(v)}%`) : undefined}
            >
                <Chart
                    {...common}
                    label={t("metric.cpu")}
                    yMax={100}
                    format={(v) => `${formatPercent(v)}%`}
                    formatTick={(v, step) => `${formatNumber(v, stepDigits(step))}%`}
                    series={[s("cpu", t("metric.cpu"), CHART_PALETTE[0], (p) => p.cpu, true)]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.memory")}
                value={
                    last ? (
                        node.swapTotal ? (
                            <>
                                <SeriesDot color={CHART_PALETTE[1]} />
                                {reading(last.memUsed, formatBytes)} / {formatBytes(memTotal)} ·{" "}
                                <SeriesDot color={CHART_PALETTE[2]} />
                                {t("metric.swap")} {reading(last.swapUsed, formatBytes)} /{" "}
                                {formatBytes(node.swapTotal)}
                            </>
                        ) : (
                            `${reading(last.memUsed, formatBytes)} / ${formatBytes(memTotal)}`
                        )
                    ) : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.memory")}
                    scale="binary"
                    yMax={memTotal || undefined}
                    format={(v) => formatBytes(v)}
                    formatTick={(v) => formatBytes(v, 0)}
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
                    last
                        ? `${reading(last.diskUsed, formatBytes)} / ${formatBytes(diskTotal)}`
                        : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.disk")}
                    scale="binary"
                    yMax={diskTotal || undefined}
                    format={(v) => formatBytes(v)}
                    formatTick={(v) => formatBytes(v, 0)}
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
                            <SeriesDot color={CHART_PALETTE[0]} />↑{" "}
                            {reading(last.netUp, formatSpeed)} ·{" "}
                            <SeriesDot color={CHART_PALETTE[1]} />↓{" "}
                            {reading(last.netDown, formatSpeed)}
                        </>
                    ) : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.network")}
                    scale="binary"
                    format={(v) => formatSpeed(v)}
                    formatTick={(v) => formatSpeed(v, 0)}
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
                            TCP {reading(last.tcp, (v) => formatNumber(v, 0))} ·{" "}
                            <SeriesDot color={CHART_PALETTE[3]} />
                            UDP {reading(last.udp, (v) => formatNumber(v, 0))}
                        </>
                    ) : undefined
                }
            >
                <Chart
                    {...common}
                    label={t("metric.connections")}
                    minStep={1}
                    format={(v) => formatNumber(v, 0)}
                    formatTick={(v) => formatNumber(v, 0)}
                    series={[
                        s("tcp", t("metric.tcp"), CHART_PALETTE[0], (p) => p.tcp, true),
                        s("udp", t("metric.udp"), CHART_PALETTE[3], (p) => p.udp),
                    ]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.load1")}
                value={last ? reading(last.load1, (v) => v.toFixed(2)) : undefined}
            >
                <Chart
                    {...common}
                    label={t("metric.load1")}
                    format={(v) => v.toFixed(2)}
                    formatTick={(v, step) => formatNumber(v, stepDigits(step))}
                    series={[s("load", t("metric.load1"), CHART_PALETTE[1], (p) => p.load1, true)]}
                />
            </ChartCard>
            <ChartCard
                title={t("metric.process")}
                value={last ? reading(last.process, (v) => formatNumber(v, 0)) : undefined}
            >
                <Chart
                    {...common}
                    label={t("metric.process")}
                    minStep={1}
                    format={(v) => formatNumber(v, 0)}
                    formatTick={(v) => formatNumber(v, 0)}
                    series={[
                        s("process", t("metric.process"), CHART_PALETTE[4], (p) => p.process, true),
                    ]}
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
    onShaveChange,
}: {
    data: PingData
    hours: number
    height: number
    shave: boolean
    onShaveChange: (on: boolean) => void
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
    const timeWindow = chartWindow(data.points.at(-1)?.at ?? 0, hours)
    const series: ChartSeries[] = useMemo(
        () =>
            data.tasks.flatMap((task, i) => {
                if (!visible(task.id)) return []
                let points = data.points
                    .filter((p) => p.task === task.id)
                    .map((p) => ({ t: p.at, v: p.value >= 0 ? p.value : null }))
                if (shave) {
                    // spikes are dropped, not blanked, so the line runs straight through them
                    const limit = spikeLimit(
                        points.flatMap((p) =>
                            p.t >= timeWindow.start && p.v !== null ? [p.v] : [],
                        ),
                    )
                    points = points.filter((p) => p.v === null || p.v <= limit)
                }
                return [{ key: String(task.id), label: task.name, color: color(i), points }]
            }),
        [data, shown, shave, timeWindow.start],
    )

    return (
        <ChartCard
            title={t("node.pingLines", { count: data.tasks.length })}
            action={
                <div className="shave-action">
                    <Switch
                        size="sm"
                        checked={shave}
                        onCheckedChange={onShaveChange}
                        label={t("node.shave")}
                    />
                    <Popover.Root>
                        <Popover.Trigger
                            openOnHover
                            delay={150}
                            render={(props) => (
                                <button
                                    {...props}
                                    type="button"
                                    className="info-trigger"
                                    aria-label={t("ui.moreInfo")}
                                >
                                    <InfoIcon size={15} />
                                </button>
                            )}
                        />
                        <Popover.Content
                            side="top"
                            align="end"
                            className="max-w-64 px-3 py-2 text-xs leading-relaxed"
                        >
                            {t("node.shaveHint")}
                        </Popover.Content>
                    </Popover.Root>
                </div>
            }
        >
            <Chart
                series={series}
                height={height}
                robust
                focus={focus !== null && visible(focus) ? String(focus) : null}
                format={(v) => `${v.toFixed(1)} ms`}
                formatTick={(v, step) => `${formatNumber(v, stepDigits(step))} ms`}
                formatTime={fmt.axis}
                formatTooltipTime={fmt.tooltip}
                timeWindow={timeWindow}
                showFailedProbes
                label={t("ui.latency")}
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
                        className={`node-ping-row inline-flex max-w-full min-h-8 min-w-8 items-center gap-1.5 rounded-full px-2 text-[12px] transition-opacity hover:bg-kumo-tint ${visible(task.id) ? "" : "opacity-40"}`}
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
                        <span className="num text-kumo-subtle">{`${task.avg.toFixed(1)} ms`}</span>
                    </button>
                ))}
                {shown !== null && (
                    <button
                        type="button"
                        className="min-h-8 min-w-8 rounded-full px-2 text-[12px] text-kumo-link hover:bg-kumo-tint"
                        onClick={() => setShown(null)}
                    >
                        {t("node.showAllLines")}
                    </button>
                )}
            </div>
            {solo && (
                <p className="node-ping-detail num mt-1 text-[12px] text-kumo-subtle">
                    {t("node.avg")}{" "}
                    <span className="text-kumo-default">{`${solo.avg.toFixed(1)} ms`}</span> ·{" "}
                    {t("node.min")} {formatNumber(solo.min, 0)} · {t("node.max")}{" "}
                    {formatNumber(solo.max, 0)}
                </p>
            )}
        </ChartCard>
    )
})
