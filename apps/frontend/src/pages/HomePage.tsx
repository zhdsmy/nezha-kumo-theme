import { useDailyCounters } from "@/app/history"
import { type MoneyPeriod, setMoneyCurrency, setMoneyPeriod, useMoney } from "@/app/money"
import { Link, navigate, usePathname } from "@/app/router"
import { adapter, getLive, getSpark, seedLive, useStore, useVisibleNodes } from "@/app/store"
import { useBilling } from "@/components/billing"
import { Meter, NoData, Spark, Status, Tile } from "@/components/ui"
import { onlineMonthlyCost, sharedCurrency } from "@/core/cost"
import { matchGroups, parseFilterQuery } from "@/core/filter"
import { SORT_KEYS, type SortKey, needsAttention, sortNodes } from "@/core/fleet"
import {
    duration,
    formatBytes,
    formatMoney,
    formatPercent,
    formatSpeed,
    ratio,
} from "@/core/format"
import { recentBuckets } from "@/core/live"
import type { NodeInfo, Snapshot } from "@/core/model"
import { stripFlag } from "@/core/region"
import { readStorage, writeStorage } from "@/core/storage"
import { summariseFleetDay } from "@/core/summary"
import { Button, DropdownMenu, Input, Select, Table } from "@cloudflare/kumo"
import { Page } from "@nezha-kumo/ui"
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CaretDownIcon,
    RowsIcon,
    SquaresFourIcon,
} from "@phosphor-icons/react"
import { type ReactNode, memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

function readPreference<T>(key: string, fallback: T): T {
    try {
        return JSON.parse(readStorage(key) ?? "null") ?? fallback
    } catch {
        return fallback
    }
}

function ServerFacts({ node, snap, showBilling }: RowProps) {
    const { t } = useTranslation()
    const billing = useBilling()
    const on = !!snap?.online
    const days = duration(snap?.uptime ?? 0)
    const expiry = billing.expiry(node)
    const facts: [string, ReactNode, string?][] = [
        [
            t("metric.network"),
            <>
                <span>↑ {on ? formatSpeed(snap!.netUp) : "—"}</span>
                <span>↓ {on ? formatSpeed(snap!.netDown) : "—"}</span>
            </>,
        ],
        [
            t("metric.traffic"),
            <>
                <span>↑ {formatBytes(snap?.totalUp ?? 0)}</span>
                <span>↓ {formatBytes(snap?.totalDown ?? 0)}</span>
            </>,
        ],
        [t("metric.uptime"), on ? `${days.days}d ${days.hours}h ${days.minutes}m` : "—"],
        [
            t("metric.load"),
            on
                ? [snap!.load1, snap!.load5, snap!.load15].map((v) => v.toFixed(2)).join(" / ")
                : "—",
        ],
    ]
    if (showBilling)
        facts.push(
            [t("metric.price"), billing.price(node) || "—"],
            [t("metric.quota"), billing.quota(node)],
            [t("metric.expiry"), expiry?.text || "—", expiry?.level],
        )
    return (
        <dl className="card-facts">
            {facts.map(([k, v, level]) => (
                <div key={k}>
                    <dt>{k}</dt>
                    <dd className="num" data-level={level}>
                        {v}
                    </dd>
                </div>
            ))}
        </dl>
    )
}

interface RowProps {
    node: NodeInfo
    snap?: Snapshot
    showBilling: boolean
    showRegions: boolean
}

const usage = (used: number, total: number) =>
    total ? `${formatBytes(used)} / ${formatBytes(total)}` : "—"

/** Card view: everything the list knows about a node, with nothing left behind an expander. */
const ServerCard = memo(function ServerCard({ node, snap, showBilling, showRegions }: RowProps) {
    const { t } = useTranslation()
    const memTotal = snap?.memTotal || node.memTotal
    const diskTotal = snap?.diskTotal || node.diskTotal
    const meta = [showRegions && node.region, node.os, node.arch, ...node.groups]
        .filter(Boolean)
        .join(" · ")
    return (
        <article className="server-card" data-server={node.id}>
            <header className="card-head">
                <div className="min-w-0">
                    <Link className="card-name" href={adapter.nodePath(node.id)} title={node.name}>
                        {stripFlag(node.name)}
                    </Link>
                    <span className="card-meta muted" title={meta}>
                        {meta || "—"}
                    </span>
                </div>
                <Status snapshot={snap} />
            </header>
            <div className="card-meters">
                <Meter
                    label={t("metric.cpu")}
                    value={snap?.cpu ?? 0}
                    kind="cpu"
                    detail={node.cpuCores ? t("metric.cores", { count: node.cpuCores }) : undefined}
                />
                <Meter
                    label={t("metric.memory")}
                    value={ratio(snap?.memUsed ?? 0, memTotal)}
                    kind="memory"
                    detail={usage(snap?.memUsed ?? 0, memTotal)}
                />
                <Meter
                    label={t("metric.disk")}
                    value={ratio(snap?.diskUsed ?? 0, diskTotal)}
                    kind="disk"
                    detail={usage(snap?.diskUsed ?? 0, diskTotal)}
                />
            </div>
            <ServerFacts
                node={node}
                snap={snap}
                showBilling={showBilling}
                showRegions={showRegions}
            />
        </article>
    )
})

/** Compact view: one table row of the readings that matter at a glance. */
const ServerRow = memo(function ServerRow({ node, snap, showRegions }: RowProps) {
    const { t } = useTranslation()
    return (
        <Table.Row className="server-row" data-server={node.id}>
            <Table.Cell className="server-name">
                <Link href={adapter.nodePath(node.id)} title={node.name}>
                    {stripFlag(node.name)}
                </Link>
                <span className="muted truncate" title={`${node.os} · ${node.groups.join(" · ")}`}>
                    {showRegions && node.region ? `${node.region} · ` : ""}
                    {node.os || node.groups.join(" · ")}
                </span>
            </Table.Cell>
            <Table.Cell className="server-status">
                <Status snapshot={snap} />
            </Table.Cell>
            <Table.Cell className="server-cpu">
                <Meter label={t("metric.cpu")} value={snap?.cpu ?? 0} kind="cpu" />
            </Table.Cell>
            <Table.Cell className="server-memory">
                <Meter
                    label={t("metric.memory")}
                    value={ratio(snap?.memUsed ?? 0, snap?.memTotal || node.memTotal)}
                    kind="memory"
                />
            </Table.Cell>
            <Table.Cell className="wide-cell">
                <Meter
                    label={t("metric.disk")}
                    value={ratio(snap?.diskUsed ?? 0, snap?.diskTotal || node.diskTotal)}
                    kind="disk"
                />
            </Table.Cell>
            <Table.Cell className="server-network">
                <span className="cell-label">{t("metric.network")}</span>
                <span className="net-rates num">
                    <span>↑ {snap?.online ? formatSpeed(snap.netUp) : "—"}</span>
                    <span>↓ {snap?.online ? formatSpeed(snap.netDown) : "—"}</span>
                </span>
            </Table.Cell>
        </Table.Row>
    )
})

const CURRENCIES = ["original", "CNY", "USD", "EUR", "GBP", "JPY", "TWD", "HKD"]
type View = "cards" | "compact"

export function HomePage() {
    const { t } = useTranslation()
    const all = useVisibleNodes()
    const snapshots = useStore((s) => s.snapshots)
    const fed = useStore((s) => s.fed)
    const settings = useStore((s) => s.settings)
    const rates = useStore((s) => s.exchangeRates)
    const rateError = useStore((s) => s.exchangeRateError)
    const actual = useStore((s) => s.actualCosts)
    const version = useStore((s) => s.liveVersion)
    const [query, setQuery] = useState("")
    // The sidebar's group links are the filter: it lives in the address only.
    const search = new URL(usePathname(), location.origin).search
    const groups = useMemo(
        () => (settings.showGroups ? (parseFilterQuery(search).groups ?? []) : []),
        [search, settings.showGroups],
    )
    // A picked group scopes the whole page, overview included.
    const nodes = useMemo(() => all.filter((n) => matchGroups(n, groups)), [all, groups])
    const [view, setView] = useState<View>(() =>
        readPreference<string>("nkt:view", "cards") === "compact" ? "compact" : "cards",
    )
    const [sort, setSort] = useState<SortKey>(() => {
        const v = readPreference<string>("nkt:sort", "default")
        return SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : "default"
    })
    const [desc, setDesc] = useState(() => readPreference<boolean>("nkt:desc", false) === true)
    const money = useMoney()
    // Counters and live seeds cover every node, so switching groups refetches nothing.
    const daily = useDailyCounters(settings.showOverview ? all : [])
    useEffect(() => {
        if (settings.showOverview) void seedLive(all)
    }, [all, settings.showOverview])
    useEffect(() => {
        writeStorage("nkt:sort", JSON.stringify(sort))
        writeStorage("nkt:desc", JSON.stringify(desc))
        writeStorage("nkt:view", JSON.stringify(view))
    }, [sort, desc, view])
    const online = nodes.filter((n) => snapshots[n.id]?.online).length
    const attention = nodes.filter((n) => needsAttention(n, snapshots[n.id], fed)).length
    const offline = nodes.length - online
    const bandwidth = nodes.reduce(
        (sum, n) =>
            sum + (snapshots[n.id]?.online ? snapshots[n.id].netUp + snapshots[n.id].netDown : 0),
        0,
    )
    const avgCpu = online
        ? nodes.reduce((sum, n) => sum + (snapshots[n.id]?.online ? snapshots[n.id].cpu : 0), 0) /
          online
        : 0
    const currency =
        money.currency === "original"
            ? sharedCurrency(nodes, snapshots, actual ?? undefined)
            : money.currency
    const cost = currency
        ? onlineMonthlyCost(nodes, snapshots, currency, rates?.rates, actual ?? undefined)
        : null
    const costValue =
        cost?.amount !== null && cost?.amount !== undefined
            ? formatMoney(cost.amount * (money.period === "year" ? 12 : 1), currency!)
            : "—"
    const midnight = new Date().setHours(0, 0, 0, 0)
    const { amount: traffic, included } = summariseFleetDay(nodes, snapshots, daily, midnight)
    const sparks = useMemo(() => {
        const now = Date.now()
        const aggregate = (series: ReturnType<typeof recentBuckets>[], average = false) =>
            Array.from({ length: 30 }, (_, i) => {
                const values = series.flatMap((b) => (b[i].value === null ? [] : [b[i].value!]))
                return {
                    at: now - 15 * 60_000 + i * 30_000,
                    value: values.length
                        ? values.reduce((a, b) => a + b, 0) / (average ? values.length : 1)
                        : null,
                }
            })
        return {
            network: aggregate(
                nodes.map((n) =>
                    recentBuckets(getSpark(n.id), (p) => p.netUp + p.netDown, 30, 15, now),
                ),
            ),
            cpu: aggregate(
                nodes.map((n) => recentBuckets(getSpark(n.id), (p) => p.cpu, 30, 15, now)),
                true,
            ),
            traffic: aggregate(
                nodes.flatMap((n) => {
                    const baselinePoints = daily?.[n.id]?.filter(
                        (p) =>
                            p.at >= midnight &&
                            p.totalUp !== undefined &&
                            p.totalDown !== undefined,
                    )
                    if (!baselinePoints?.length) return []
                    const current = getLive(n.id)
                    const points = [
                        ...baselinePoints.filter((p) => p.at < (current[0]?.at ?? Infinity)),
                        ...current,
                    ]
                    const baseline = baselinePoints[0].totalUp! + baselinePoints[0].totalDown!
                    return [
                        recentBuckets(
                            points,
                            (p) =>
                                Math.max(
                                    0,
                                    (p.totalUp ?? baseline) + (p.totalDown ?? 0) - baseline,
                                ),
                            30,
                            15,
                            now,
                        ),
                    ]
                }),
            ),
        }
    }, [nodes, version, daily, midnight])
    const visible = sortNodes(
        nodes.filter(
            (n) =>
                (settings.showOffline || snapshots[n.id]?.online) &&
                `${n.name} ${n.os} ${n.region} ${n.groups.join(" ")}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
        ),
        snapshots,
        sort,
        desc,
    )
    const headline = !fed
        ? t("status.connecting")
        : !nodes.length
          ? t("status.noNodes")
          : offline
            ? t("status.someOffline", { count: offline })
            : attention
              ? t("status.attention", { count: attention })
              : t("status.allOnline")
    const groupTitle =
        groups.length === 1 ? groups[0] || t("toolbar.ungrouped") : groups.join(" · ")
    const costLabel = t(money.period === "year" ? "overview.costYear" : "overview.cost")
    const costHint =
        cost?.amount === null || !currency
            ? t(rateError ? "overview.costUnavailable" : "overview.costLoading")
            : t("overview.costNodes", { count: cost?.paid ?? 0 })
    return (
        <Page
            title={groups.length ? groupTitle : t("ui.overview")}
            eyebrow={groups.length ? t("toolbar.groups") : undefined}
            actions={
                settings.showCost && (
                    <DropdownMenu>
                        <DropdownMenu.Trigger>
                            <Button variant="secondary" className="cost-button" title={costHint}>
                                <span className="muted">{costLabel}</span>
                                <span className="num cost-value">{costValue}</span>
                                <CaretDownIcon size={14} />
                            </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end" className="min-w-40">
                            <DropdownMenu.Group>
                                <DropdownMenu.Label>{t("money.currency")}</DropdownMenu.Label>
                                <DropdownMenu.RadioGroup
                                    value={money.currency}
                                    onValueChange={(v: string) => setMoneyCurrency(v)}
                                >
                                    {CURRENCIES.map((c) => (
                                        <DropdownMenu.RadioItem key={c} value={c}>
                                            {c === "original" ? t("money.original") : c}
                                            <DropdownMenu.RadioItemIndicator />
                                        </DropdownMenu.RadioItem>
                                    ))}
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.Group>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Group>
                                <DropdownMenu.Label>{t("money.period")}</DropdownMenu.Label>
                                <DropdownMenu.RadioGroup
                                    value={money.period}
                                    onValueChange={(v: string) => setMoneyPeriod(v as MoneyPeriod)}
                                >
                                    {(["original", "month", "year"] as const).map((p) => (
                                        <DropdownMenu.RadioItem key={p} value={p}>
                                            {t(`money.${p}`)}
                                            <DropdownMenu.RadioItemIndicator />
                                        </DropdownMenu.RadioItem>
                                    ))}
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.Group>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                )
            }
            description={
                <span
                    className="status-headline"
                    data-level={offline ? "danger" : attention ? "warn" : "good"}
                >
                    {headline}
                </span>
            }
        >
            {settings.showOverview && (
                <section className="metric-grid" aria-label={t("ui.overview")}>
                    <Tile
                        label={t("overview.nodes")}
                        value={
                            <span
                                className="status-number"
                                data-level={offline ? "danger" : "good"}
                            >
                                {fed ? online : "—"}
                                <span className="tile-denominator"> / {nodes.length}</span>
                            </span>
                        }
                        sub={t("status.summary", { online, count: nodes.length })}
                    />
                    <Tile
                        label={t("overview.bandwidth")}
                        value={fed ? formatSpeed(bandwidth) : "—"}
                        sub={t("node.rangeLive")}
                    >
                        <Spark buckets={sparks.network} />
                    </Tile>
                    <Tile
                        label={t("ui.todayTraffic")}
                        value={traffic === null ? "—" : formatBytes(traffic)}
                        sub={
                            traffic === null
                                ? t("ui.dailyUnavailable")
                                : included < nodes.length
                                  ? t("ui.dailyIncluded", { count: included, total: nodes.length })
                                  : t("ui.sinceMidnight")
                        }
                    >
                        <Spark buckets={sparks.traffic} />
                    </Tile>
                    <Tile
                        label={t("ui.averageCpu")}
                        value={fed ? `${formatPercent(avgCpu)}%` : "—"}
                        sub={t("ui.onlineOnly")}
                    >
                        <Spark buckets={sparks.cpu} />
                    </Tile>
                </section>
            )}
            <section className="servers-section" aria-label={t("ui.servers")}>
                <div className="section-heading">
                    <h2>
                        {t("ui.servers")}{" "}
                        <span className="muted font-normal">{visible.length}</span>
                    </h2>
                </div>
                <div className="list-toolbar">
                    <Input
                        aria-label={t("toolbar.search")}
                        placeholder={t("toolbar.searchPlaceholder")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Select
                        aria-label={t("toolbar.sort")}
                        value={sort}
                        onValueChange={(v) => v && setSort(v as SortKey)}
                        items={Object.fromEntries(SORT_KEYS.map((k) => [k, t(`sort.${k}`)]))}
                    />
                    <Button
                        variant="secondary"
                        shape="square"
                        aria-label={t(desc ? "toolbar.ascending" : "toolbar.descending")}
                        onClick={() => setDesc(!desc)}
                    >
                        {desc ? <ArrowDownIcon size={16} /> : <ArrowUpIcon size={16} />}
                    </Button>
                    <div className="view-switch" role="group" aria-label={t("toolbar.view")}>
                        {(
                            [
                                ["cards", <SquaresFourIcon size={16} />],
                                ["compact", <RowsIcon size={16} />],
                            ] as const
                        ).map(([v, icon]) => (
                            <Button
                                key={v}
                                variant={view === v ? "secondary" : "ghost"}
                                shape="square"
                                aria-pressed={view === v}
                                aria-label={t(`toolbar.${v}`)}
                                title={t(`toolbar.${v}`)}
                                onClick={() => setView(v)}
                            >
                                {icon}
                            </Button>
                        ))}
                    </div>
                    {query || groups.length ? (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setQuery("")
                                if (groups.length) navigate("/")
                            }}
                        >
                            {t("toolbar.clear")}
                        </Button>
                    ) : null}
                </div>
                {!visible.length ? (
                    <NoData title={t("toolbar.empty")} />
                ) : view === "cards" ? (
                    <div className="server-cards">
                        {visible.map((n) => (
                            <ServerCard
                                key={n.id}
                                node={n}
                                snap={snapshots[n.id]}
                                showBilling={settings.showBilling}
                                showRegions={settings.showRegions}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="server-list">
                        <Table className="fleet-table" layout="fixed">
                            <Table.Header variant="compact">
                                <Table.Row>
                                    <Table.Head className="server-name">
                                        {t("sort.name")}
                                    </Table.Head>
                                    <Table.Head className="server-status">
                                        {t("ui.status")}
                                    </Table.Head>
                                    <Table.Head>{t("metric.cpu")}</Table.Head>
                                    <Table.Head>{t("metric.memory")}</Table.Head>
                                    <Table.Head className="wide-cell">
                                        {t("metric.disk")}
                                    </Table.Head>
                                    <Table.Head className="server-network">
                                        {t("metric.network")}
                                    </Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {visible.map((n) => (
                                    <ServerRow
                                        key={n.id}
                                        node={n}
                                        snap={snapshots[n.id]}
                                        showBilling={settings.showBilling}
                                        showRegions={settings.showRegions}
                                    />
                                ))}
                            </Table.Body>
                        </Table>
                    </div>
                )}
            </section>
            <p className="page-footnote">{settings.footerNote || "Nezha · Kumo theme"}</p>
        </Page>
    )
}
