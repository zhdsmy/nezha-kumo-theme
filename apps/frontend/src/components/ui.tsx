import { useStore } from "@/app/store"
import { levelFor } from "@/core/fleet"
import { formatPercent } from "@/core/format"
import type { Bucket } from "@/core/live"
import type { Snapshot } from "@/core/model"
import { Badge, Empty, Loader } from "@cloudflare/kumo"
import { type ReactNode, useId } from "react"
import { useTranslation } from "react-i18next"

// Palette from measurements/traffic-chart-options-{light,dark}.json; same in both modes.
export const CHART_PALETTE = ["#4290F0", "#F5B647", "#E8649D", "#8D58EE", "#50C3B6", "#D37536"]

export function Status({ snapshot }: { snapshot?: Snapshot }) {
    const { t } = useTranslation()
    const fed = useStore((s) => s.fed)
    const kind = !snapshot && !fed ? "connecting" : snapshot?.online ? "online" : "offline"
    return (
        <span className="status" data-status={kind}>
            <Badge
                variant={kind === "online" ? "success" : kind === "offline" ? "error" : "warning"}
                appearance="dot"
            >
                {t(`status.${kind}`)}
            </Badge>
        </span>
    )
}

export function Meter({
    label,
    value,
    kind,
    detail,
}: {
    label: string
    value: number
    kind: "cpu" | "memory" | "disk"
    /** Small line under the track, for example "1.1 GB / 2 GB". */
    detail?: string
}) {
    return (
        <span className="meter" data-level={levelFor(kind, value)}>
            <span className="meter-label">{label}</span>
            <span className="num">{formatPercent(value)}%</span>
            <span className="meter-track" aria-hidden>
                <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
            </span>
            {detail && (
                <span className="meter-detail num" title={detail}>
                    {detail}
                </span>
            )}
        </span>
    )
}

// Gap-aware paths adapted from zool-theme/src/components/instruments.tsx (MIT, luoleiorg).
export function Spark({
    buckets,
    color = CHART_PALETTE[0],
}: {
    buckets: readonly Bucket[]
    color?: string
}) {
    const uid = useId().replace(/:/g, "")
    const max = Math.max(1, ...buckets.map((b) => b.value ?? 0))
    let line = "",
        area = "",
        start: number | null = null,
        lastX = 0
    buckets.forEach((b, i) => {
        const x = (i * 300) / Math.max(1, buckets.length - 1)
        if (b.value === null) {
            if (start !== null) area += `L${lastX},48L${start},48Z`
            start = null
            return
        }
        const y = 45 - (b.value / max) * 37
        const point = `${x.toFixed(1)},${y.toFixed(1)}`
        line += `${start === null ? "M" : "L"}${point}`
        area += `${start === null ? "M" : "L"}${point}`
        if (start === null) start = x
        lastX = x
    })
    if (start !== null) area += `L${lastX},48L${start},48Z`
    return (
        <svg className="spark" viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${uid})`} />
            <path
                d={line}
                stroke={color}
                strokeWidth={1.5}
                fill="none"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}

export function Tile({
    label,
    value,
    sub,
    children,
}: {
    label: string
    value: ReactNode
    sub?: ReactNode
    children?: ReactNode
}) {
    return (
        <div className="metric-tile">
            <div className="tile-heading">
                <p className="tile-label" title={label}>
                    {label}
                </p>
                <div className="tile-value num">{value}</div>
                {sub && (
                    <div className="tile-sub" title={typeof sub === "string" ? sub : undefined}>
                        {sub}
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}

export function Loading() {
    const { t } = useTranslation()
    return (
        <div className="loading-state" aria-busy="true">
            <Loader aria-label={t("status.connecting")} />
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
        </div>
    )
}

export function NoData({ title, retry }: { title: string; retry?: () => void }) {
    const { t } = useTranslation()
    return (
        <Empty
            size="sm"
            title={title}
            contents={
                retry && (
                    <button className="rounded-sm text-kumo-link" onClick={retry}>
                        {t("app.retry")}
                    </button>
                )
            }
        />
    )
}

export function Info({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
    return (
        <section className="info-section">
            <h2>{title}</h2>
            <dl>
                {rows
                    .filter(([, v]) => v !== undefined && v !== null && v !== "")
                    .map(([k, v]) => (
                        <div key={k}>
                            <dt>{k}</dt>
                            <dd title={typeof v === "string" ? v : undefined}>{v}</dd>
                        </div>
                    ))}
            </dl>
        </section>
    )
}

export function PageFootnote() {
    const note = useStore((s) => s.settings.footerNote)
    return <p className="page-footnote">{note || "Nezha · Kumo theme"}</p>
}
