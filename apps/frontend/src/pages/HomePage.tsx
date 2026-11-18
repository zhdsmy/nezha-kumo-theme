// Region filter and strip adapted from zool-theme/src/pages/HomePage.tsx (MIT, luoleiorg).
import { useDailyCounters } from "@/app/history"
import { type MoneyPeriod, setMoneyPeriod, useMoney } from "@/app/money"
import { Link, RESET_EVENT, navigate, usePathname } from "@/app/router"
import { adapter, getSpark, getTraffic, seedLive, useStore, useVisibleNodes } from "@/app/store"
import { RegionFlag } from "@/components/RegionFlag"
import { useBilling } from "@/components/billing"
import { Meter, NoData, PageFootnote, Spark, Status, Tile } from "@/components/ui"
import { onlineMonthlyCost } from "@/core/cost"
import {
    matchGroups,
    parseFilterQuery,
    regionCounts,
    resolveRegion,
    serializeFilterQuery,
} from "@/core/filter"
import { type IssueReason, SORT_KEYS, type SortKey, nodeIssues, sortNodes } from "@/core/fleet"
import {
    duration,
    formatBytes,
    formatMoney,
    formatPercent,
    formatSpeed,
    formatUsage,
    ratio,
} from "@/core/format"
import { recentBuckets } from "@/core/live"
import type { NodeInfo, Snapshot } from "@/core/model"
import { regionName, stripFlag } from "@/core/region"
import { readStorage, writeStorage } from "@/core/storage"
import { dailyTraffic, hasDailyCounters, mergeHistoryTail, summariseFleetDay } from "@/core/summary"
import { uiLabels } from "@/i18n"
import { Button, DropdownMenu, InputGroup, Table, Tabs, Tooltip } from "@cloudflare/kumo"
import { Page } from "@nezha-kumo/ui"
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CaretDownIcon,
    MagnifyingGlassIcon,
    RowsIcon,
    SquaresFourIcon,
    XIcon,
} from "@phosphor-icons/react"
import { type ReactNode, memo, useEffect, useMemo, useRef, useState } from "react"
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
        [t("metric.uptime"), on ? t("unit.uptime", { ...days }) : "—"],
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

/** Card view: everything the list knows about a node, with nothing left behind an expander. */
const ServerCard = memo(function ServerCard({ node, snap, showBilling, showRegions }: RowProps) {
    const { t } = useTranslation()
    const memTotal = snap?.memTotal || node.memTotal
    const diskTotal = snap?.diskTotal || node.diskTotal
    const meta = [node.os, node.arch, ...node.groups].filter(Boolean).join(" · ")
    return (
        <article className="server-card" data-server={node.id}>
            <header className="card-head">
                <div className="min-w-0">
                    <Link className="card-name" href={adapter.nodePath(node.id)} title={node.name}>
                        <span className="card-name-text">
                            {showRegions && <RegionFlag code={node.region} className="mr-1.5" />}
                            {stripFlag(node.name)}
                        </span>
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
                    detail={formatUsage(snap?.memUsed ?? 0, memTotal)}
                />
                <Meter
                    label={t("metric.disk")}
                    value={ratio(snap?.diskUsed ?? 0, diskTotal)}
                    kind="disk"
                    detail={formatUsage(snap?.diskUsed ?? 0, diskTotal)}
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
                    <span className="block truncate">
                        {showRegions && <RegionFlag code={node.region} className="mr-1.5" />}
                        {stripFlag(node.name)}
                    </span>
                </Link>
                <span className="muted truncate" title={`${node.os} · ${node.groups.join(" · ")}`}>
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

type View = "cards" | "compact"

export function HomePage() {
    const { t, i18n } = useTranslation()
    const all = useVisibleNodes()
    const snapshots = useStore((s) => s.snapshots)
    const fed = useStore((s) => s.fed)
    const settings = useStore((s) => s.settings)
    const rates = useStore((s) => s.exchangeRates)
    const rateError = useStore((s) => s.exchangeRateError)
    const actual = useStore((s) => s.actualCosts)
    const version = useStore((s) => s.liveVersion)
    const [query, setQuery] = useState("")
    const [searchOpen, setSearchOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    // Group and region filters live in the address so a filtered view survives reload and sharing.
    const search = new URL(usePathname(), location.origin).search
    const parsedFilter = useMemo(() => parseFilterQuery(search), [search])
    const groups = useMemo(
        () => (settings.showGroups ? (parsedFilter.groups ?? []) : []),
        [parsedFilter.groups, settings.showGroups],
    )
    const rawRegion = parsedFilter.region ?? null
    // A picked group scopes the whole page, overview included.
    const nodes = useMemo(() => all.filter((n) => matchGroups(n, groups)), [all, groups])
    const listed = useMemo(
        () =>
            settings.showOffline
                ? nodes
                : nodes.filter((n) => snapshots[n.id]?.online || (!fed && !snapshots[n.id])),
        [nodes, snapshots, fed, settings.showOffline],
    )
    const regions = useMemo(() => regionCounts(listed), [listed])
    const offerRegions = settings.showRegions && regions.length > 1
    const pickedRegion = resolveRegion(rawRegion, regions, settings.showRegions)
    const [view, setView] = useState<View>(() =>
        readPreference<string>("nkt:view", "cards") === "compact" ? "compact" : "cards",
    )
    const [sort, setSort] = useState<SortKey>(() => {
        const v = readPreference<string>("nkt:sort", "default")
        return SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : "default"
    })
    const [desc, setDesc] = useState(() => readPreference<boolean>("nkt:desc", false) === true)
    const [sortTipOpen, setSortTipOpen] = useState(false)
    const sortMenuOpen = useRef(false)
    const suppressSortTip = useRef(false)
    const money = useMoney()
    // Counters and live seeds cover every node, so switching groups refetches nothing.
    const daily = useDailyCounters(settings.showOverview ? all : [])
    useEffect(() => {
        if (!settings.showOverview) return
        const ctrl = new AbortController()
        void seedLive(all, ctrl.signal).catch(() => {})
        return () => ctrl.abort()
    }, [all, settings.showOverview])
    useEffect(() => {
        writeStorage("nkt:sort", JSON.stringify(sort))
        writeStorage("nkt:desc", JSON.stringify(desc))
        writeStorage("nkt:view", JSON.stringify(view))
    }, [sort, desc, view])
    useEffect(() => {
        if (!all.length || !rawRegion || pickedRegion === rawRegion) return
        navigate(`/${serializeFilterQuery(search, { groups, region: pickedRegion })}`, {
            replace: true,
        })
    }, [all.length, rawRegion, pickedRegion, search, groups])
    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus()
    }, [searchOpen])
    useEffect(() => {
        const clear = () => {
            setQuery("")
            setSearchOpen(false)
        }
        window.addEventListener(RESET_EVENT, clear)
        return () => window.removeEventListener(RESET_EVENT, clear)
    }, [])
    const online = nodes.filter((n) => snapshots[n.id]?.online).length
    const offline = nodes.length - online
    const issues = useMemo(
        () =>
            fed
                ? nodes
                      .flatMap((node) => {
                          const reasons = nodeIssues(node, snapshots[node.id], fed)
                          return reasons.length ? [{ node, reasons }] : []
                      })
                      .sort(
                          (a, b) =>
                              Number(b.reasons[0].kind === "offline") -
                              Number(a.reasons[0].kind === "offline"),
                      )
                : [],
        [nodes, snapshots, fed],
    )
    const attention = issues.filter((i) => i.reasons[0].kind !== "offline").length
    const bandwidth = nodes.reduce(
        (sum, n) =>
            sum + (snapshots[n.id]?.online ? snapshots[n.id].netUp + snapshots[n.id].netDown : 0),
        0,
    )
    const avgCpu = online
        ? nodes.reduce((sum, n) => sum + (snapshots[n.id]?.online ? snapshots[n.id].cpu : 0), 0) /
          online
        : 0
    const cost = onlineMonthlyCost(
        nodes,
        snapshots,
        money.currency,
        rates?.rates,
        actual ?? undefined,
    )
    const costValue =
        cost.amount !== null
            ? formatMoney(cost.amount * (money.period === "year" ? 12 : 1), money.currency)
            : "—"
    const midnight = new Date().setHours(0, 0, 0, 0)
    const trafficPoints = useMemo(
        () =>
            daily &&
            Object.fromEntries(
                nodes.map((n) => [
                    n.id,
                    hasDailyCounters(daily[n.id], midnight)
                        ? mergeHistoryTail(daily[n.id], getTraffic(n.id), midnight)
                        : [],
                ]),
            ),
        [daily, nodes, version, midnight],
    )
    const { amount: traffic, included } = summariseFleetDay(
        nodes,
        snapshots,
        trafficPoints,
        midnight,
    )
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
            online: aggregate(
                nodes.map((n) => recentBuckets(getSpark(n.id), () => 1, 30, 15, now)),
            ),
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
                    const points = trafficPoints?.[n.id]
                    if (!points?.length) return []
                    return [
                        recentBuckets(
                            dailyTraffic(points, midnight),
                            (p) => (p.totalUp ?? NaN) + (p.totalDown ?? NaN),
                            30,
                            15,
                            now,
                        ),
                    ]
                }),
            ),
        }
    }, [nodes, version, trafficPoints, midnight])
    const needle = query.toLowerCase()
    const visible = sortNodes(
        listed.filter(
            (n) =>
                (!pickedRegion || n.region === pickedRegion) &&
                (!needle ||
                    `${n.name} ${n.os} ${n.region} ${n.groups.join(" ")}`
                        .toLowerCase()
                        .includes(needle)),
        ),
        snapshots,
        sort,
        desc,
    )
    const formatReason = (r: IssueReason) =>
        r.kind === "cpu" || r.kind === "memory" || r.kind === "disk"
            ? `${t(`metric.${r.kind}`)} ${r.percent}%`
            : r.kind === "expiring"
              ? t(r.days ? "status.expiringInDays" : "status.expiringToday", { count: r.days })
              : t(`status.${r.kind === "quota" ? "quotaExceeded" : r.kind}`)
    const nodesSub = !fed ? (
        t("status.connecting")
    ) : !nodes.length ? (
        t("status.noNodes")
    ) : issues.length ? (
        <DropdownMenu>
            <DropdownMenu.Trigger>
                <button
                    type="button"
                    className="status-trigger"
                    data-level={offline ? "danger" : "warn"}
                >
                    <span>
                        {[
                            offline && t("status.someOffline", { count: offline }),
                            attention && t("status.attention", { count: attention }),
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                    <CaretDownIcon size={12} />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" className="attention-menu">
                {issues.map(({ node, reasons }) => (
                    <DropdownMenu.Item
                        key={node.id}
                        className="attention-item"
                        render={
                            <Link href={adapter.nodePath(node.id)}>
                                <span className="attention-name" title={node.name}>
                                    {stripFlag(node.name)}
                                </span>
                                <span
                                    className="attention-reason num"
                                    data-level={reasons[0].kind === "offline" ? "danger" : "warn"}
                                >
                                    {reasons.map(formatReason).join(" · ")}
                                </span>
                            </Link>
                        }
                    />
                ))}
            </DropdownMenu.Content>
        </DropdownMenu>
    ) : (
        t("status.allNormal")
    )
    const groupTitle =
        groups.length === 1 ? groups[0] || t("toolbar.ungrouped") : groups.join(" · ")
    const costLabel = t(money.period === "year" ? "overview.costYear" : "overview.cost")
    const costHint =
        cost.amount === null
            ? t(rateError ? "overview.costUnavailable" : "overview.costLoading")
            : t("overview.costNodes", { count: cost.paid })
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
                                <DropdownMenu.Label>{t("money.period")}</DropdownMenu.Label>
                                <DropdownMenu.RadioGroup
                                    value={money.period}
                                    onValueChange={(v: string) => setMoneyPeriod(v as MoneyPeriod)}
                                >
                                    {(["month", "year"] as const).map((p) => (
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
                        sub={nodesSub}
                    >
                        <Spark buckets={sparks.online} />
                    </Tile>
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
                <div
                    className="section-heading"
                    data-search-open={searchOpen || query.length > 0 ? "true" : undefined}
                >
                    <h2>
                        {t("ui.servers")}{" "}
                        <span className="muted font-normal num">{visible.length}</span>
                    </h2>
                    <div className="section-controls">
                        {searchOpen || query.length > 0 ? (
                            <InputGroup className="inline-search">
                                <InputGroup.Addon align="start">
                                    <MagnifyingGlassIcon size={16} />
                                </InputGroup.Addon>
                                <InputGroup.Input
                                    ref={searchInputRef}
                                    autoFocus
                                    aria-label={t("toolbar.search")}
                                    placeholder={t("toolbar.searchPlaceholder")}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                            e.preventDefault()
                                            setQuery("")
                                            setSearchOpen(false)
                                        }
                                    }}
                                />
                                <InputGroup.Addon align="end">
                                    <InputGroup.Button
                                        className="search-clear"
                                        shape="square"
                                        aria-label={t("toolbar.clear")}
                                        tooltip={t("toolbar.clear")}
                                        onClick={() => {
                                            setQuery("")
                                            setSearchOpen(false)
                                        }}
                                    >
                                        <XIcon size={14} />
                                    </InputGroup.Button>
                                </InputGroup.Addon>
                            </InputGroup>
                        ) : (
                            <Button
                                variant="secondary"
                                shape="square"
                                aria-label={t("toolbar.search")}
                                title={t("toolbar.search")}
                                onClick={() => setSearchOpen(true)}
                            >
                                <MagnifyingGlassIcon size={16} />
                            </Button>
                        )}
                        <DropdownMenu
                            onOpenChange={(open) => {
                                sortMenuOpen.current = open
                                suppressSortTip.current = true
                                setSortTipOpen(false)
                            }}
                        >
                            <Tooltip
                                content={`${t("toolbar.sort")}: ${t(`sort.${sort}`)} (${t(desc ? "toolbar.descending" : "toolbar.ascending")})`}
                                open={sortTipOpen}
                                onOpenChange={(open) => {
                                    if (open && suppressSortTip.current) return
                                    setSortTipOpen(open)
                                }}
                                className="cursor-pointer"
                                render={
                                    <DropdownMenu.Trigger>
                                        <Button
                                            variant="secondary"
                                            className="sort-button"
                                            aria-label={t("toolbar.sort")}
                                            onBlur={() => {
                                                suppressSortTip.current = false
                                            }}
                                            onPointerEnter={() => {
                                                if (!sortMenuOpen.current)
                                                    suppressSortTip.current = false
                                            }}
                                        >
                                            <span>{t(`sort.${sort}`)}</span>
                                            {desc ? (
                                                <ArrowDownIcon size={14} />
                                            ) : (
                                                <ArrowUpIcon size={14} />
                                            )}
                                        </Button>
                                    </DropdownMenu.Trigger>
                                }
                            />
                            <DropdownMenu.Content align="end" className="min-w-44">
                                <DropdownMenu.Group>
                                    <DropdownMenu.Label>{t("toolbar.sort")}</DropdownMenu.Label>
                                    <DropdownMenu.RadioGroup
                                        value={sort}
                                        onValueChange={(v: string) => setSort(v as SortKey)}
                                    >
                                        {SORT_KEYS.map((k) => (
                                            <DropdownMenu.RadioItem key={k} value={k}>
                                                {t(`sort.${k}`)}
                                                <DropdownMenu.RadioItemIndicator />
                                            </DropdownMenu.RadioItem>
                                        ))}
                                    </DropdownMenu.RadioGroup>
                                </DropdownMenu.Group>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Group>
                                    <DropdownMenu.RadioGroup
                                        value={desc ? "desc" : "asc"}
                                        onValueChange={(v: string) => setDesc(v === "desc")}
                                    >
                                        {(["asc", "desc"] as const).map((d) => (
                                            <DropdownMenu.RadioItem key={d} value={d}>
                                                {t(
                                                    d === "desc"
                                                        ? "toolbar.descending"
                                                        : "toolbar.ascending",
                                                )}
                                                <DropdownMenu.RadioItemIndicator />
                                            </DropdownMenu.RadioItem>
                                        ))}
                                    </DropdownMenu.RadioGroup>
                                </DropdownMenu.Group>
                            </DropdownMenu.Content>
                        </DropdownMenu>
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
                    </div>
                </div>
                {offerRegions && (
                    <div aria-label={t("toolbar.regions")}>
                        <Tabs
                            variant="segmented"
                            className="region-tabs"
                            labels={uiLabels("tabs")}
                            value={pickedRegion ?? "all"}
                            onValueChange={(v) =>
                                navigate(
                                    `/${serializeFilterQuery(search, {
                                        groups,
                                        region: v === "all" ? null : v,
                                    })}`,
                                    { replace: true },
                                )
                            }
                            tabs={[
                                {
                                    value: "all",
                                    className: "region-tab",
                                    label: (
                                        <>
                                            <span>{t("toolbar.all")}</span>
                                            <span className="num muted">{listed.length}</span>
                                        </>
                                    ),
                                },
                                ...regions.map(([code, count]) => ({
                                    value: code,
                                    className: "region-tab",
                                    label: (
                                        <span
                                            className="region-tab-inner"
                                            title={regionName(code, i18n.language)}
                                        >
                                            <RegionFlag code={code} />
                                            <span className="region-code">{code}</span>
                                            <span className="num muted">{count}</span>
                                        </span>
                                    ),
                                })),
                            ]}
                        />
                    </div>
                )}
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
            <PageFootnote />
        </Page>
    )
}
