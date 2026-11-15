import { setShave, useShave } from "@/app/prefs"
import { navigate } from "@/app/router"
import { adapter, backfillLive, getLive, getSpark, useStore, useVisibleNodes } from "@/app/store"
import { HourGrid } from "@/components/HourGrid"
import { LoadCharts, PingChart } from "@/components/NodeCharts"
import { useBilling } from "@/components/billing"
import { CHART_PALETTE, Info, Loading, NoData, Spark, Status, Tile } from "@/components/ui"
import { formatBytes, formatPercent, formatSpeed, quotaUsage, ratio } from "@/core/format"
import { recentBuckets } from "@/core/live"
import type { HistoryPoint, PingData } from "@/core/model"
import { regionName, stripFlag } from "@/core/region"
import { summariseDay } from "@/core/summary"
import { Button, Tabs } from "@cloudflare/kumo"
import { Page } from "@nezha-kumo/ui"
import { ArrowClockwiseIcon } from "@phosphor-icons/react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

export const SECTIONS = ["overview", "latency", "billing", "history"] as const
export type Section = (typeof SECTIONS)[number]

export default function NodePage({ id, section }: { id: string; section: Section }) {
    const { t, i18n } = useTranslation()
    const nodes = useVisibleNodes()
    const node = nodes.find((n) => n.id === id)
    const snap = useStore((s) => s.snapshots[id])
    const recordHours = useStore((s) => s.site?.recordHours ?? 0)
    const showBilling = useStore((s) => s.settings.showBilling)
    const title = useStore((s) => s.settings.siteTitle || s.site?.name || "Nezha")
    const [range, setRange] = useState(0)
    const liveVersion = useStore((s) => (range === 0 ? s.liveVersion : -1))
    const [nonce, setNonce] = useState(0)
    const [history, setHistory] = useState<{ key: string; points: HistoryPoint[] } | null>(null)
    const [ping, setPing] = useState<{ key: string; data: PingData } | null>(null)
    const [reports, setReports] = useState<HistoryPoint[] | null>(null)
    const [historyError, setHistoryError] = useState("")
    const [pingError, setPingError] = useState("")
    const [reportError, setReportError] = useState(false)
    const shave = useShave()
    const billing = useBilling()
    const ranges = adapter.historyRanges.filter((h) => h === 0 || h <= recordHours)
    const activeRange = ranges.includes(range) ? range : 0
    const historyKey = `${id}:${activeRange}:${nonce}`
    const reportHours = recordHours >= 168 ? 168 : 24
    const pingKey = `${id}:${activeRange}:${nonce}`
    const live = useMemo(() => [...getLive(id)], [id, liveVersion])
    const spark = useMemo(
        () => recentBuckets(getSpark(id), (p) => p.netUp + p.netDown, 80, 15),
        [id, liveVersion],
    )
    useEffect(() => {
        void backfillLive(id)
    }, [id])
    useEffect(() => {
        if (node) document.title = `${stripFlag(node.name)} · ${title}`
    }, [node, title])
    useEffect(() => {
        if (section !== "overview" || !activeRange) return
        let active = true
        adapter
            .loadHistory(id, activeRange)
            .then((points) => {
                if (active) {
                    setHistoryError("")
                    setHistory({ key: historyKey, points })
                }
            })
            .catch(() => {
                if (active) setHistoryError(historyKey)
            })
        return () => {
            active = false
        }
    }, [id, activeRange, section, historyKey])
    useEffect(() => {
        if (section !== "latency" || !recordHours) return
        let active = true
        const load = () =>
            adapter
                .loadPing(id, activeRange || 0.25)
                .then((data) => {
                    if (active) {
                        setPingError("")
                        setPing({ key: pingKey, data })
                    }
                })
                .catch(() => {
                    if (active) setPingError(pingKey)
                })
        void load()
        const timer = activeRange === 0 ? window.setInterval(() => void load(), 30_000) : undefined
        return () => {
            active = false
            clearInterval(timer)
        }
    }, [id, activeRange, section, recordHours, pingKey])
    useEffect(() => {
        if (!recordHours || (section !== "history" && section !== "billing")) return
        let active = true
        setReportError(false)
        setReports(null)
        adapter
            .loadHistory(id, reportHours)
            .then((p) => {
                if (active) setReports(p)
            })
            .catch(() => {
                if (active) setReportError(true)
            })
        return () => {
            active = false
        }
    }, [id, recordHours, reportHours, section, nonce])
    if (!node)
        return (
            <Page title={t("node.notFound")}>
                <NoData title={t("node.notFound")} />
            </Page>
        )
    const points = activeRange === 0 ? live : history?.key === historyKey ? history.points : null
    const pingData = ping?.key === pingKey ? ping.data : null
    const labelRange = (h: number) =>
        h === 0
            ? t("node.rangeLive")
            : h < 24
              ? t("node.rangeHours", { count: h })
              : t("node.rangeDays", { count: h / 24 })
    const day =
        reports?.length && snap
            ? summariseDay(reports, snap, new Date().setHours(0, 0, 0, 0))
            : null
    const mem = snap?.memTotal || node.memTotal,
        disk = snap?.diskTotal || node.diskTotal
    const used = quotaUsage(node, snap),
        expiry = billing.expiry(node)
    const system = (
        <Info
            title={t("node.system")}
            rows={[
                [t("node.os"), node.os],
                [t("node.arch"), node.arch],
                [t("node.cpu"), `${node.cpuName}${node.cpuCores ? ` × ${node.cpuCores}` : ""}`],
                [t("metric.memory"), mem ? formatBytes(mem) : ""],
                [t("metric.disk"), disk ? formatBytes(disk) : ""],
                [t("metric.swap"), node.swapTotal ? formatBytes(node.swapTotal) : ""],
                [t("node.virtualization"), node.virtualization],
                [t("node.gpu"), node.gpuName],
                [t("node.kernel"), node.kernel],
                [
                    t("ui.bootTime"),
                    node.bootTime ? new Date(node.bootTime).toLocaleString(i18n.language) : "",
                ],
                [t("ui.agentVersion"), node.agentVersion],
                [
                    t("node.region"),
                    node.region ? `${regionName(node.region, i18n.language)} (${node.region})` : "",
                ],
                [t("node.group"), node.groups.join(" · ")],
            ]}
        />
    )
    return (
        <Page
            maxWidth={1100}
            title={stripFlag(node.name)}
            eyebrow={[node.region, node.os].filter(Boolean).join(" · ")}
            description={<Status snapshot={snap} />}
            aside={system}
            tabs={
                <Tabs
                    variant="underline"
                    value={section}
                    onValueChange={(s) => navigate(`${adapter.nodePath(id)}#${s}`)}
                    tabs={SECTIONS.map((s) => ({ value: s, label: t(`ui.${s}`) }))}
                />
            }
        >
            <section aria-label={t(`ui.${section}`)}>
                {(section === "overview" || section === "latency") && (
                    <div className="chart-toolbar">
                        <div className="ranges" aria-label={t("money.period")}>
                            {ranges.map((h) => (
                                <Button
                                    key={h}
                                    size="sm"
                                    variant={activeRange === h ? "secondary" : "ghost"}
                                    aria-pressed={activeRange === h}
                                    onClick={() => setRange(h)}
                                >
                                    {labelRange(h)}
                                </Button>
                            ))}
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            shape="square"
                            aria-label={t("node.refresh")}
                            onClick={() => {
                                setNonce((v) => v + 1)
                                if (!activeRange) void backfillLive(id)
                            }}
                        >
                            <ArrowClockwiseIcon size={16} />
                        </Button>
                    </div>
                )}
                {section === "overview" && (
                    <>
                        <div className="metric-grid node-metrics">
                            <Tile
                                label={t("metric.cpu")}
                                value={`${formatPercent(snap?.cpu ?? 0)}%`}
                                sub={t("metric.cores", { count: node.cpuCores })}
                            />
                            <Tile
                                label={t("metric.memory")}
                                value={`${formatPercent(ratio(snap?.memUsed ?? 0, mem))}%`}
                                sub={`${formatBytes(snap?.memUsed ?? 0)} / ${formatBytes(mem)}`}
                            />
                            <Tile
                                label={t("metric.disk")}
                                value={`${formatPercent(ratio(snap?.diskUsed ?? 0, disk))}%`}
                                sub={`${formatBytes(snap?.diskUsed ?? 0)} / ${formatBytes(disk)}`}
                            />
                            <Tile
                                label={t("metric.network")}
                                value={formatSpeed((snap?.netUp ?? 0) + (snap?.netDown ?? 0))}
                                sub={`↑ ${formatSpeed(snap?.netUp ?? 0)} · ↓ ${formatSpeed(snap?.netDown ?? 0)}`}
                            >
                                <Spark buckets={spark} color={CHART_PALETTE[0]} />
                            </Tile>
                        </div>
                        {!recordHours && <p className="notice">{t("node.liveOnly")}</p>}
                        {historyError === historyKey ? (
                            <NoData
                                title={t("app.loadError")}
                                retry={() => setNonce((v) => v + 1)}
                            />
                        ) : points === null ? (
                            <Loading />
                        ) : points.length < 2 ? (
                            <NoData title={t("node.noHistory")} />
                        ) : (
                            <LoadCharts
                                node={node}
                                points={points}
                                hours={activeRange || 0.25}
                                height={150}
                                snap={snap}
                            />
                        )}
                    </>
                )}
                {section === "latency" && (
                    <>
                        <div className="section-heading">
                            <h2>{t("node.tabPing")}</h2>
                            <Button
                                size="sm"
                                variant={shave ? "secondary" : "ghost"}
                                aria-pressed={shave}
                                title={t("node.shaveHint")}
                                onClick={() => setShave(!shave)}
                            >
                                {t("node.shave")}
                            </Button>
                        </div>
                        {!recordHours ? (
                            <NoData title={t("node.liveOnly")} />
                        ) : pingError === pingKey ? (
                            <NoData
                                title={t("app.loadError")}
                                retry={() => setNonce((v) => v + 1)}
                            />
                        ) : pingData === null ? (
                            <Loading />
                        ) : !pingData.tasks.length ? (
                            <NoData title={t("node.noPing")} />
                        ) : (
                            <PingChart
                                key={id}
                                data={pingData}
                                hours={activeRange || 0.25}
                                height={280}
                                shave={shave}
                            />
                        )}
                    </>
                )}
                {section === "billing" && (
                    <>
                        <Info
                            title={t("node.network")}
                            rows={[
                                [t("node.bandwidth"), node.bandwidth],
                                [
                                    t("node.ipSupport"),
                                    [
                                        node.ipv4 === undefined
                                            ? ""
                                            : `IPv4 ${node.ipv4 ? "✓" : "×"}`,
                                        node.ipv6 === undefined
                                            ? ""
                                            : `IPv6 ${node.ipv6 ? "✓" : "×"}`,
                                    ]
                                        .filter(Boolean)
                                        .join(" · "),
                                ],
                                [t("node.networkRoute"), node.networkRoute],
                                [t("metric.upload"), formatBytes(snap?.totalUp ?? 0)],
                                [t("metric.download"), formatBytes(snap?.totalDown ?? 0)],
                                [
                                    t("ui.todayTraffic"),
                                    day ? `${formatBytes(day.todayUp + day.todayDown)}` : "—",
                                ],
                                [
                                    t("node.peak"),
                                    day
                                        ? `↑ ${formatSpeed(day.peakUp)} · ↓ ${formatSpeed(day.peakDown)}`
                                        : "—",
                                ],
                                [t("metric.quota"), billing.quota(node)],
                                [t("ui.quotaUsed"), used !== null ? formatBytes(used) : ""],
                            ]}
                        />
                        {node.trafficLimitPeriod ? (
                            <p className="notice">{t("node.noCycleUsage")}</p>
                        ) : null}
                        {used !== null && node.trafficLimit > 0 && (
                            <div
                                className="quota-track"
                                role="meter"
                                aria-label={t("metric.quota")}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.min(100, ratio(used, node.trafficLimit))}
                            >
                                <span
                                    style={{
                                        width: `${Math.min(100, ratio(used, node.trafficLimit))}%`,
                                    }}
                                />
                            </div>
                        )}
                        {showBilling && (
                            <Info
                                title={t("node.billing")}
                                rows={[
                                    [t("metric.price"), billing.price(node)],
                                    [t("metric.actualCost"), billing.actualPrice(node)],
                                    [
                                        t("metric.expiry"),
                                        expiry
                                            ? `${node.expiredAt ? new Date(node.expiredAt).toLocaleDateString(i18n.language) + " · " : ""}${expiry.text}`
                                            : "",
                                    ],
                                    [t("metric.autoRenew"), node.autoRenewal ? "✓" : ""],
                                ]}
                            />
                        )}
                        {node.note && <p className="notice whitespace-pre-line">{node.note}</p>}
                        {reportError && (
                            <NoData
                                title={t("app.loadError")}
                                retry={() => setNonce((v) => v + 1)}
                            />
                        )}
                    </>
                )}
                {section === "history" && (
                    <>
                        <div className="section-heading">
                            <h2>{t("ui.history")}</h2>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setNonce((v) => v + 1)}
                            >
                                {t("node.refresh")}
                            </Button>
                        </div>
                        {!recordHours ? (
                            <NoData title={t("node.liveOnly")} />
                        ) : reportError ? (
                            <NoData
                                title={t("app.loadError")}
                                retry={() => setNonce((v) => v + 1)}
                            />
                        ) : reports === null ? (
                            <Loading />
                        ) : !reports.length ? (
                            <NoData title={t("node.noHistory")} />
                        ) : (
                            <div className="chart-card">
                                <HourGrid points={reports} days={reportHours / 24} />
                                <p className="muted mt-4 text-xs">{t("ui.historyHint")}</p>
                            </div>
                        )}
                    </>
                )}
            </section>
        </Page>
    )
}
