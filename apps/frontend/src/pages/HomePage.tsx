import { useDailyCounters } from "@/app/history"
import { type MoneyPeriod, setMoneyCurrency, setMoneyPeriod, useMoney } from "@/app/money"
import { Link } from "@/app/router"
import { adapter, getLive, getSpark, seedLive, useStore, useVisibleNodes } from "@/app/store"
import { useBilling } from "@/components/billing"
import { Meter, NoData, Spark, Status, Tile } from "@/components/ui"
import { onlineMonthlyCost, sharedCurrency } from "@/core/cost"
import { groupCounts, matchGroups, parseFilterQuery, serializeFilterQuery } from "@/core/filter"
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
import { regionName, stripFlag } from "@/core/region"
import { readStorage, writeStorage } from "@/core/storage"
import { summariseFleetDay } from "@/core/summary"
import { Button, Input, Select, Table } from "@cloudflare/kumo"
import { Page } from "@nezha-kumo/ui"
import { ArrowDownIcon, ArrowUpIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react"
import { Fragment, memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

function readPreference<T>(key: string, fallback: T): T {
    try {
        return JSON.parse(readStorage(key) ?? "null") ?? fallback
    } catch {
        return fallback
    }
}

const ServerRow = memo(function ServerRow({
    node,
    snap,
    showBilling,
    showRegions,
}: {
    node: NodeInfo
    snap?: Snapshot
    showBilling: boolean
    showRegions: boolean
}) {
    const { t, i18n } = useTranslation()
    const [expanded, setExpanded] = useState(false)
    const billing = useBilling()
    const cpu = snap?.cpu ?? 0,
        mem = ratio(snap?.memUsed ?? 0, snap?.memTotal || node.memTotal)
    const disk = ratio(snap?.diskUsed ?? 0, snap?.diskTotal || node.diskTotal)
    const expiry = billing.expiry(node)
    const days = duration(snap?.uptime ?? 0)
    return (
        <Fragment>
            <Table.Row className="server-row" data-server={node.id}>
                <Table.Cell className="server-name">
                    <Link href={adapter.nodePath(node.id)} title={node.name}>
                        {stripFlag(node.name)}
                    </Link>
                    <span
                        className="muted truncate"
                        title={`${node.os} · ${node.groups.join(" · ")}`}
                    >
                        {showRegions && node.region ? `${node.region} · ` : ""}
                        {node.os || node.groups.join(" · ")}
                    </span>
                </Table.Cell>
                <Table.Cell className="server-status">
                    <Status snapshot={snap} />
                </Table.Cell>
                <Table.Cell className="server-cpu">
                    <Meter label={t("metric.cpu")} value={cpu} kind="cpu" />
                </Table.Cell>
                <Table.Cell className="server-memory">
                    <Meter label={t("metric.memory")} value={mem} kind="memory" />
                </Table.Cell>
                <Table.Cell className="server-network">
                    <span className="cell-label">{t("metric.network")}</span>
                    <span className="net-rates num">
                        <span>↑ {snap?.online ? formatSpeed(snap.netUp) : "—"}</span>
                        <span>↓ {snap?.online ? formatSpeed(snap.netDown) : "—"}</span>
                    </span>
                </Table.Cell>
                <Table.Cell className="wide-cell">
                    <Meter label={t("metric.disk")} value={disk} kind="disk" />
                </Table.Cell>
                <Table.Cell className="wide-cell">
                    <span className="num">
                        {formatBytes((snap?.totalUp ?? 0) + (snap?.totalDown ?? 0))}
                    </span>
                    <span className="muted block text-xs">{t("node.totals")}</span>
                </Table.Cell>
                <Table.Cell className="wide-cell">
                    <span className="num text-xs">
                        {snap?.online ? `${days.days}d ${days.hours}h` : "—"}
                    </span>
                </Table.Cell>
                {showBilling && (
                    <Table.Cell className="wide-cell billing-cell">
                        <span className="numeric-text" title={billing.price(node)}>
                            {billing.price(node) || "—"}
                        </span>
                        <span className="muted numeric-text text-xs" title={expiry?.text}>
                            {expiry?.text || "—"}
                        </span>
                    </Table.Cell>
                )}
                <Table.Cell className="row-expand">
                    <Button
                        size="sm"
                        variant="ghost"
                        shape="square"
                        aria-expanded={expanded}
                        aria-label={`${t("ui.details")} ${stripFlag(node.name)}`}
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
                    </Button>
                </Table.Cell>
            </Table.Row>
            {expanded && (
                <Table.Row className="expanded-row">
                    <Table.Cell colSpan={showBilling ? 10 : 9}>
                        <dl className="expanded-info">
                            <div>
                                <dt>{t("metric.disk")}</dt>
                                <dd>
                                    {formatPercent(disk)}% · {formatBytes(snap?.diskUsed ?? 0)} /{" "}
                                    {formatBytes(snap?.diskTotal || node.diskTotal)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t("metric.traffic")}</dt>
                                <dd>
                                    ↑ {formatBytes(snap?.totalUp ?? 0)} · ↓{" "}
                                    {formatBytes(snap?.totalDown ?? 0)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t("metric.uptime")}</dt>
                                <dd>
                                    {snap?.online
                                        ? `${days.days}d ${days.hours}h ${days.minutes}m`
                                        : "—"}
                                </dd>
                            </div>
                            {showBilling && (
                                <>
                                    <div>
                                        <dt>{t("metric.price")}</dt>
                                        <dd>{billing.price(node) || "—"}</dd>
                                    </div>
                                    <div>
                                        <dt>{t("metric.quota")}</dt>
                                        <dd>{billing.quota(node)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t("metric.expiry")}</dt>
                                        <dd>{expiry?.text || "—"}</dd>
                                    </div>
                                </>
                            )}
                            <div>
                                <dt>{t("node.region")}</dt>
                                <dd>{regionName(node.region, i18n.language) || "—"}</dd>
                            </div>
                        </dl>
                    </Table.Cell>
                </Table.Row>
            )}
        </Fragment>
    )
})

export function HomePage() {
    const { t } = useTranslation()
    const nodes = useVisibleNodes()
    const snapshots = useStore((s) => s.snapshots)
    const fed = useStore((s) => s.fed)
    const settings = useStore((s) => s.settings)
    const rates = useStore((s) => s.exchangeRates)
    const rateError = useStore((s) => s.exchangeRateError)
    const actual = useStore((s) => s.actualCosts)
    const version = useStore((s) => s.liveVersion)
    const [query, setQuery] = useState("")
    const [groups, setGroups] = useState<string[]>(
        () =>
            parseFilterQuery(location.search).groups ??
            (() => {
                const saved = readPreference<unknown>("nkt:groups", [])
                return Array.isArray(saved)
                    ? saved.filter((v): v is string => typeof v === "string")
                    : []
            })(),
    )
    const [sort, setSort] = useState<SortKey>(() => {
        const v = readPreference<string>("nkt:sort", "default")
        return SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : "default"
    })
    const [desc, setDesc] = useState(() => readPreference<boolean>("nkt:desc", false) === true)
    const money = useMoney()
    const daily = useDailyCounters(settings.showOverview ? nodes : [])
    useEffect(() => {
        if (settings.showOverview) void seedLive(nodes)
    }, [nodes, settings.showOverview])
    useEffect(() => {
        try {
            writeStorage("nkt:groups", JSON.stringify(groups))
            writeStorage("nkt:sort", JSON.stringify(sort))
            writeStorage("nkt:desc", JSON.stringify(desc))
        } catch {
            /* private mode */
        }
        history.replaceState(
            null,
            "",
            location.pathname + serializeFilterQuery(location.search, { groups, region: null }),
        )
    }, [groups, sort, desc])
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
                (!settings.showGroups || matchGroups(n, groups)) &&
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
    return (
        <Page
            title={t("ui.overview")}
            actions={
                settings.showCost && (
                    <div className="money-controls">
                        <Select
                            size="sm"
                            aria-label={t("money.currency")}
                            value={money.currency}
                            onValueChange={(v) => v && setMoneyCurrency(v)}
                            items={{
                                original: t("money.original"),
                                CNY: "CNY",
                                USD: "USD",
                                EUR: "EUR",
                                GBP: "GBP",
                                JPY: "JPY",
                                TWD: "TWD",
                                HKD: "HKD",
                            }}
                        />
                        <Select
                            size="sm"
                            aria-label={t("money.period")}
                            value={money.period}
                            onValueChange={(v) => v && setMoneyPeriod(v as MoneyPeriod)}
                            items={{
                                original: t("money.original"),
                                month: t("money.month"),
                                year: t("money.year"),
                            }}
                        />
                    </div>
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
                    {settings.showCost && (
                        <Tile
                            label={t(
                                money.period === "year" ? "overview.costYear" : "overview.cost",
                            )}
                            value={costValue}
                            sub={
                                cost?.amount === null || !currency
                                    ? t(
                                          rateError
                                              ? "overview.costUnavailable"
                                              : "overview.costLoading",
                                      )
                                    : t("overview.costNodes", { count: cost?.paid ?? 0 })
                            }
                        />
                    )}
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
                    {settings.showGroups && (
                        <Select
                            multiple
                            aria-label={t("toolbar.groups")}
                            placeholder={t("toolbar.all")}
                            value={groups}
                            onValueChange={setGroups}
                            items={Object.fromEntries(
                                groupCounts(nodes).map(([g, count]) => [
                                    g,
                                    `${g || t("toolbar.ungrouped")} (${count})`,
                                ]),
                            )}
                        />
                    )}
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
                    {query || groups.length ? (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setQuery("")
                                setGroups([])
                            }}
                        >
                            {t("toolbar.clear")}
                        </Button>
                    ) : null}
                </div>
                {visible.length ? (
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
                                    <Table.Head className="server-network">
                                        {t("metric.network")}
                                    </Table.Head>
                                    <Table.Head className="wide-cell">
                                        {t("metric.disk")}
                                    </Table.Head>
                                    <Table.Head className="wide-cell">
                                        {t("metric.traffic")}
                                    </Table.Head>
                                    <Table.Head className="wide-cell">
                                        {t("metric.uptime")}
                                    </Table.Head>
                                    {settings.showBilling && (
                                        <Table.Head className="wide-cell">
                                            {t("metric.price")}
                                        </Table.Head>
                                    )}
                                    <Table.Head className="row-expand">
                                        <span className="sr-only">{t("ui.details")}</span>
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
                ) : (
                    <NoData title={t("toolbar.empty")} />
                )}
            </section>
            <p className="page-footnote">{settings.footerNote || "Nezha · Kumo theme"}</p>
        </Page>
    )
}
