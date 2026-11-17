import { useStore } from "@/app/store"
import { levelFor } from "@/core/fleet"
import { formatPercent } from "@/core/format"
import type { Bucket } from "@/core/live"
import type { Snapshot } from "@/core/model"
import { readStorage } from "@/core/storage"
import { Badge, Banner, Button, Empty, SkeletonLine } from "@cloudflare/kumo"
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

export type LoadingVariant = "home" | "node" | "charts" | "ping" | "history"

function InfoPanelSkeleton({ rows }: { rows: number }) {
    return (
        <div className="info-section">
            <div className="mb-2 flex items-center" style={{ height: 24 }}>
                <SkeletonLine minWidth={28} maxWidth={42} className="h-3.5" />
            </div>
            <dl>
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i}>
                        <dt className="flex items-center" style={{ height: 21 }}>
                            <SkeletonLine minWidth={100} maxWidth={100} className="w-20" />
                        </dt>
                        <dd className="flex items-center justify-end" style={{ height: 21 }}>
                            <SkeletonLine minWidth={35} maxWidth={65} />
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

export function Loading({ variant = "home" }: { variant?: LoadingVariant } = {}) {
    const { t } = useTranslation()
    const showOverview = useStore((s) => s.settings.showOverview)
    const showRegions = useStore((s) => s.settings.showRegions)
    const showBilling = useStore((s) => s.settings.showBilling)
    const compact = readStorage("nkt:view") === '"compact"'

    return (
        <div className="loading-state" role="status" aria-busy="true">
            <span className="sr-only">{t("status.connecting")}</span>
            {variant === "home" && (
                <div aria-hidden="true">
                    {showOverview && (
                        <div className="metric-grid">
                            {Array.from({ length: 4 }, (_, i) => (
                                <div key={i} className="metric-tile">
                                    <div className="tile-heading">
                                        <div
                                            className="tile-label flex items-center"
                                            style={{ height: "1lh" }}
                                        >
                                            <SkeletonLine minWidth={45} maxWidth={65} />
                                        </div>
                                        <div
                                            className="tile-value flex items-center"
                                            style={{ height: "1lh" }}
                                        >
                                            <SkeletonLine
                                                minWidth={35}
                                                maxWidth={55}
                                                className="h-5"
                                            />
                                        </div>
                                        <div
                                            className="tile-sub flex items-center"
                                            style={{ height: "1lh" }}
                                        >
                                            <SkeletonLine minWidth={50} maxWidth={75} />
                                        </div>
                                    </div>
                                    <div className="spark flex items-end px-3 pb-3">
                                        <SkeletonLine
                                            minWidth={100}
                                            maxWidth={100}
                                            className="h-5 rounded"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="servers-section">
                        <div className="section-heading">
                            <div className="flex items-center" style={{ height: 24 }}>
                                <SkeletonLine minWidth={100} maxWidth={100} className="h-4 w-24" />
                            </div>
                            <div className="section-controls">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-kumo-line bg-kumo-control">
                                    <SkeletonLine minWidth={45} maxWidth={45} />
                                </div>
                                <div className="sort-button flex h-9 w-24 items-center rounded-lg border border-kumo-line bg-kumo-control px-3">
                                    <SkeletonLine minWidth={100} maxWidth={100} />
                                </div>
                                <div className="view-switch">
                                    <div className="h-9 w-9 rounded-lg bg-kumo-tint" />
                                    <div className="h-9 w-9 rounded-lg" />
                                </div>
                            </div>
                        </div>
                        {showRegions && (
                            <div className="region-tabs flex h-9 w-64 max-w-full items-center gap-2 rounded-lg bg-kumo-recessed px-2">
                                <SkeletonLine minWidth={100} maxWidth={100} />
                            </div>
                        )}
                        {compact ? (
                            <div className="server-list">
                                <table className="fleet-table-skeleton">
                                    <thead>
                                        <tr>
                                            {[
                                                "server-name",
                                                "server-status",
                                                "",
                                                "",
                                                "wide-cell",
                                                "server-network",
                                            ].map((cls, c) => (
                                                <th
                                                    key={c}
                                                    className={`${cls} px-3 py-2 text-left`}
                                                >
                                                    <SkeletonLine minWidth={30} maxWidth={55} />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 6 }, (_, i) => (
                                            <tr key={i} className="server-row">
                                                <td className="server-name">
                                                    <SkeletonLine
                                                        minWidth={45}
                                                        maxWidth={70}
                                                        blockHeight={21}
                                                        className="h-3.5"
                                                    />
                                                    <SkeletonLine
                                                        minWidth={55}
                                                        maxWidth={80}
                                                        blockHeight={16}
                                                    />
                                                </td>
                                                <td className="server-status">
                                                    <SkeletonLine
                                                        minWidth={100}
                                                        maxWidth={100}
                                                        className="h-4 w-14 rounded-full"
                                                    />
                                                </td>
                                                {["server-cpu", "server-memory", "wide-cell"].map(
                                                    (cls) => (
                                                        <td key={cls} className={cls}>
                                                            <span className="meter-track">
                                                                <span style={{ width: "0%" }} />
                                                            </span>
                                                        </td>
                                                    ),
                                                )}
                                                <td className="server-network">
                                                    <span className="net-rates">
                                                        <SkeletonLine
                                                            minWidth={55}
                                                            maxWidth={75}
                                                            blockHeight={16}
                                                        />
                                                        <SkeletonLine
                                                            minWidth={55}
                                                            maxWidth={75}
                                                            blockHeight={16}
                                                        />
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="server-cards">
                                {Array.from({ length: 6 }, (_, i) => (
                                    <article key={i} className="server-card">
                                        <div className="card-head">
                                            <div className="min-w-0 flex-1">
                                                <div
                                                    className="flex items-center"
                                                    style={{ height: 20 }}
                                                >
                                                    <SkeletonLine
                                                        minWidth={45}
                                                        maxWidth={70}
                                                        className="h-3.5"
                                                    />
                                                </div>
                                                <div
                                                    className="card-meta flex items-center"
                                                    style={{ height: 16 }}
                                                >
                                                    <SkeletonLine minWidth={55} maxWidth={80} />
                                                </div>
                                            </div>
                                            <div
                                                className="flex items-center"
                                                style={{ height: 20 }}
                                            >
                                                <SkeletonLine
                                                    minWidth={100}
                                                    maxWidth={100}
                                                    className="h-4 w-14 rounded-full"
                                                />
                                            </div>
                                        </div>
                                        <div className="card-meters">
                                            {Array.from({ length: 3 }, (_, m) => (
                                                <div key={m} className="meter">
                                                    <span
                                                        className="meter-label flex items-center"
                                                        style={{ height: 18 }}
                                                    >
                                                        <SkeletonLine minWidth={55} maxWidth={80} />
                                                    </span>
                                                    <span className="num" />
                                                    <span className="meter-track">
                                                        <span style={{ width: "0%" }} />
                                                    </span>
                                                    <span
                                                        className="meter-detail flex items-center"
                                                        style={{ height: 14 }}
                                                    >
                                                        <SkeletonLine minWidth={50} maxWidth={75} />
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="card-facts">
                                            {Array.from({ length: showBilling ? 7 : 4 }, (_, f) => (
                                                <div key={f}>
                                                    <div
                                                        className="flex items-center"
                                                        style={{ height: 16 }}
                                                    >
                                                        <SkeletonLine minWidth={35} maxWidth={55} />
                                                    </div>
                                                    {f < 2 ? (
                                                        <div
                                                            className="mt-0.5 flex flex-col justify-around"
                                                            style={{ height: 32 }}
                                                        >
                                                            <SkeletonLine
                                                                minWidth={50}
                                                                maxWidth={75}
                                                            />
                                                            <SkeletonLine
                                                                minWidth={50}
                                                                maxWidth={75}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="mt-0.5 flex items-center"
                                                            style={{ height: 16 }}
                                                        >
                                                            <SkeletonLine
                                                                minWidth={50}
                                                                maxWidth={75}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mt-8 h-[18px]" aria-hidden="true" />
                </div>
            )}
            {variant === "node" && (
                <div aria-hidden="true">
                    <div className="node-live-strip">
                        {Array.from({ length: 3 }, (_, m) => (
                            <div key={m} className="meter">
                                <span
                                    className="meter-label flex items-center"
                                    style={{ height: 18 }}
                                >
                                    <SkeletonLine minWidth={35} maxWidth={55} />
                                </span>
                                <span className="num" />
                                <span className="meter-track">
                                    <span style={{ width: "0%" }} />
                                </span>
                                <span
                                    className="meter-detail flex items-center"
                                    style={{ height: 14 }}
                                >
                                    <SkeletonLine minWidth={45} maxWidth={70} />
                                </span>
                            </div>
                        ))}
                        <div className="node-net-reading">
                            <span className="meter-label flex items-center" style={{ height: 18 }}>
                                <SkeletonLine minWidth={35} maxWidth={55} />
                            </span>
                            <span className="net-rates">
                                <SkeletonLine minWidth={45} maxWidth={65} blockHeight={18} />
                                <SkeletonLine minWidth={45} maxWidth={65} blockHeight={18} />
                            </span>
                        </div>
                    </div>
                    <div className="node-subtabs">
                        <div className="flex h-9 w-full items-center gap-2 rounded-lg bg-kumo-recessed px-2">
                            <SkeletonLine minWidth={100} maxWidth={100} />
                        </div>
                    </div>
                    <div className="node-info-grid" data-has-billing={showBilling || undefined}>
                        <div className="node-info-panel" data-panel="system" data-active>
                            <InfoPanelSkeleton rows={7} />
                        </div>
                        <div className="node-info-panel" data-panel="network">
                            <InfoPanelSkeleton rows={5} />
                        </div>
                        {showBilling && (
                            <div className="node-info-panel" data-panel="billing">
                                <InfoPanelSkeleton rows={3} />
                            </div>
                        )}
                    </div>
                    <div className="mt-8 h-[18px]" aria-hidden="true" />
                </div>
            )}
            {variant === "charts" && (
                <div className="chart-grid" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="chart-card">
                            <div className="chart-heading">
                                <div className="flex flex-1 items-center" style={{ height: 21 }}>
                                    <SkeletonLine minWidth={25} maxWidth={45} className="h-3.5" />
                                </div>
                                <SkeletonLine minWidth={16} maxWidth={28} />
                            </div>
                            <div className="flex flex-col justify-between" style={{ height: 150 }}>
                                {Array.from({ length: 4 }, (_, r) => (
                                    <SkeletonLine key={r} minWidth={100} maxWidth={100} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {variant === "ping" && (
                <div className="chart-card latency-card" aria-hidden="true">
                    <div className="flex flex-col justify-between" style={{ height: 280 }}>
                        {Array.from({ length: 5 }, (_, r) => (
                            <SkeletonLine key={r} minWidth={100} maxWidth={100} />
                        ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2" style={{ minHeight: 28 }}>
                        <SkeletonLine minWidth={16} maxWidth={22} className="h-5 rounded-full" />
                        <SkeletonLine minWidth={16} maxWidth={22} className="h-5 rounded-full" />
                        <SkeletonLine minWidth={16} maxWidth={22} className="h-5 rounded-full" />
                    </div>
                </div>
            )}
            {variant === "history" && (
                <div className="chart-card" aria-hidden="true">
                    <div className="flex items-center justify-between" style={{ height: 21 }}>
                        <SkeletonLine minWidth={25} maxWidth={40} className="h-3.5" />
                        <SkeletonLine minWidth={20} maxWidth={30} />
                    </div>
                    <div className="hour-grid-rows">
                        {Array.from({ length: 7 }, (_, r) => (
                            <div key={r} className="hour-grid-cell flex items-center">
                                <SkeletonLine
                                    minWidth={100}
                                    maxWidth={100}
                                    className="h-full rounded-[1px]"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center" style={{ height: 16 }}>
                        <SkeletonLine minWidth={55} maxWidth={75} />
                    </div>
                </div>
            )}
        </div>
    )
}

export function ErrorBanner({
    title,
    description,
    onRetry,
}: {
    title?: string
    description?: string
    onRetry: () => void
}) {
    const { t } = useTranslation()
    return (
        <Banner
            variant="error"
            role="alert"
            title={title ?? t("app.loadError")}
            description={description}
            action={<Banner.Action onClick={onRetry}>{t("app.retry")}</Banner.Action>}
        />
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
                    <Button variant="secondary" size="sm" onClick={retry}>
                        {t("app.retry")}
                    </Button>
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
