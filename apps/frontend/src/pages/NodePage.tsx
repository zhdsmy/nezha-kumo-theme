import { setShave, useShave } from "@/app/prefs"
import { navigate, usePathname } from "@/app/router"
import { SECTIONS, type Section } from "@/app/sections"
import { adapter, backfillLive, getLive, useStore, useVisibleNodes } from "@/app/store"
import { HourGrid } from "@/components/HourGrid"
import { LoadCharts, PingChart } from "@/components/NodeCharts"
import { RegionFlag } from "@/components/RegionFlag"
import { useBilling } from "@/components/billing"
import { Info, Loading, Meter, NoData, Status } from "@/components/ui"
import { formatBytes, formatSpeed, quotaUsage, ratio } from "@/core/format"
import { pollVisible } from "@/core/http"
import type { HistoryPoint, PingData } from "@/core/model"
import { regionName, stripFlag } from "@/core/region"
import { summariseDay } from "@/core/summary"
import { Button, Tabs } from "@cloudflare/kumo"
import { Page } from "@nezha-kumo/ui"
import { ArrowClockwiseIcon } from "@phosphor-icons/react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type SubTab = "system" | "network" | "billing"

const usage = (used: number, total: number) =>
    total ? `${formatBytes(used)} / ${formatBytes(total)}` : "—"

export default function NodePage({ id, section }: { id: string; section: Section }) {
    const { t, i18n } = useTranslation()
    const nodes = useVisibleNodes()
    const node = nodes.find((n) => n.id === id)
    const snap = useStore((s) => s.snapshots[id])
    const recordHours = useStore((s) => s.site?.recordHours ?? 0)
    const showBilling = useStore((s) => s.settings.showBilling)
    const showRegions = useStore((s) => s.settings.showRegions)
    const title = useStore((s) => s.settings.siteTitle || s.site?.name || "Nezha")
    const hash = new URL(usePathname(), window.location.origin).hash
    const [subTab, setSubTab] = useState<SubTab>(() => (hash === "#billing" ? "billing" : "system"))
    const [prevHash, setPrevHash] = useState(hash)
    if (hash !== prevHash) {
        setPrevHash(hash)
        if (hash === "#billing") setSubTab("billing")
    }
    const [range, setRange] = useState(0)
    const ranges = adapter.historyRanges.filter((h) => h === 0 || h <= recordHours)
    const activeRange = ranges.includes(range) ? range : 0
    const liveVersion = useStore((s) => (section === "load" && !activeRange ? s.liveVersion : -1))
    const [nonce, setNonce] = useState(0)
    const [history, setHistory] = useState<{ key: string; points: HistoryPoint[] } | null>(null)
    const [ping, setPing] = useState<{ key: string; data: PingData } | null>(null)
    const [dayResult, setDayResult] = useState<{ key: string; points: HistoryPoint[] } | null>(null)
    const [reportResult, setReports] = useState<{ key: string; points: HistoryPoint[] } | null>(
        null,
    )
    const [historyError, setHistoryError] = useState("")
    const [pingError, setPingError] = useState("")
    const [reportError, setReportError] = useState("")
    const shave = useShave()
    const billing = useBilling()
    const dataKey = `${id}:${activeRange}:${nonce}`
    const dayKey = `${id}:${nonce}`
    const reportHours = recordHours >= 168 ? 168 : 24
    const reportKey = `${id}:${reportHours}:${nonce}`
    const dayPoints = dayResult?.key === dayKey ? dayResult.points : null
    const reports = reportResult?.key === reportKey ? reportResult.points : null
    const live = useMemo(
        () => (section === "load" && !activeRange ? [...getLive(id)] : []),
        [id, section, activeRange, liveVersion],
    )
    useEffect(() => {
        if (section === "load") void backfillLive(id)
    }, [id, section])
    useEffect(() => {
        if (node) document.title = `${stripFlag(node.name)} · ${title}`
    }, [node, title])
    useEffect(() => {
        if (section !== "load" || !activeRange) return
        let active = true
        adapter
            .loadHistory(id, activeRange)
            .then((points) => {
                if (active) {
                    setHistoryError("")
                    setHistory({ key: dataKey, points })
                }
            })
            .catch(() => {
                if (active) setHistoryError(dataKey)
            })
        return () => {
            active = false
        }
    }, [id, activeRange, section, dataKey])
    useEffect(() => {
        if (section !== "latency" || !recordHours) return
        let active = true
        const load = () =>
            adapter
                .loadPing(id, activeRange || 0.25)
                .then((data) => {
                    if (active) {
                        setPingError("")
                        setPing({ key: dataKey, data })
                    }
                })
                .catch(() => {
                    if (active) setPingError(dataKey)
                })
        const stop = activeRange === 0 ? pollVisible(load, 30_000) : (void load(), () => {})
        return () => {
            active = false
            stop()
        }
    }, [id, activeRange, section, recordHours, dataKey])
    useEffect(() => {
        if (section !== "overview" || !recordHours || dayPoints) return
        let active = true
        adapter
            .loadHistory(id, 24, "billing")
            .then((p) => {
                if (active) setDayResult({ key: dayKey, points: p })
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [id, recordHours, section, dayKey, dayPoints])
    useEffect(() => {
        if (section !== "history" || !recordHours) return
        let active = true
        adapter
            .loadHistory(id, reportHours, "reports")
            .then((p) => {
                if (active) {
                    setReportError("")
                    setReports({ key: reportKey, points: p })
                }
            })
            .catch(() => {
                if (active) setReportError(reportKey)
            })
        return () => {
            active = false
        }
    }, [id, recordHours, reportHours, section, reportKey])
    if (!node)
        return (
            <Page title={t("node.notFound")}>
                <NoData title={t("node.notFound")} />
            </Page>
        )
    const points = activeRange === 0 ? live : history?.key === dataKey ? history.points : null
    const pingData = ping?.key === dataKey ? ping.data : null
    const labelRange = (h: number) =>
        h === 0
            ? t("node.rangeLive")
            : h < 24
              ? t("node.rangeHours", { count: h })
              : t("node.rangeDays", { count: h / 24 })
    const day =
        dayPoints?.length && snap
            ? summariseDay(dayPoints, snap, new Date().setHours(0, 0, 0, 0))
            : null
    const mem = snap?.memTotal || node.memTotal,
        disk = snap?.diskTotal || node.diskTotal
    const used = quotaUsage(node, snap),
        expiry = billing.expiry(node)
    const activeSub: SubTab = subTab === "billing" && !showBilling ? "system" : subTab
    const subTabs: SubTab[] = showBilling ? ["system", "network", "billing"] : ["system", "network"]
    return (
        <Page
            maxWidth={1100}
            title={
                showRegions && node.region ? (
                    <>
                        <RegionFlag code={node.region} className="mr-2" />
                        {stripFlag(node.name)}
                    </>
                ) : (
                    stripFlag(node.name)
                )
            }
            actions={<Status snapshot={snap} />}
            tabs={
                <Tabs
                    variant="underline"
                    value={section}
                    onValueChange={(s) =>
                        navigate(`${adapter.nodePath(id)}#${s}`, { replace: true })
                    }
                    tabs={SECTIONS.map((s) => ({ value: s, label: t(`ui.${s}`) }))}
                />
            }
        >
            <section aria-label={t(`ui.${section}`)}>
                {(section === "load" || section === "latency") && (
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
                                adapter.clearHistory(id)
                                setNonce((v) => v + 1)
                                if (section === "load" && !activeRange) void backfillLive(id)
                            }}
                        >
                            <ArrowClockwiseIcon size={16} />
                        </Button>
                    </div>
                )}
                {section === "overview" && (
                    <>
                        <div className="node-live-strip">
                            <Meter
                                label={t("metric.cpu")}
                                value={snap?.cpu ?? 0}
                                kind="cpu"
                                detail={
                                    node.cpuCores
                                        ? t("metric.cores", { count: node.cpuCores })
                                        : undefined
                                }
                            />
                            <Meter
                                label={t("metric.memory")}
                                value={ratio(snap?.memUsed ?? 0, mem)}
                                kind="memory"
                                detail={usage(snap?.memUsed ?? 0, mem)}
                            />
                            <Meter
                                label={t("metric.disk")}
                                value={ratio(snap?.diskUsed ?? 0, disk)}
                                kind="disk"
                                detail={usage(snap?.diskUsed ?? 0, disk)}
                            />
                            <div className="node-net-reading">
                                <span className="meter-label">{t("metric.network")}</span>
                                <span className="net-rates num">
                                    <span>↑ {snap?.online ? formatSpeed(snap.netUp) : "—"}</span>
                                    <span>↓ {snap?.online ? formatSpeed(snap.netDown) : "—"}</span>
                                </span>
                            </div>
                        </div>
                        <div className="node-subtabs">
                            <Tabs
                                variant="segmented"
                                value={activeSub}
                                onValueChange={(v) => setSubTab(v as SubTab)}
                                tabs={subTabs.map((k) => ({
                                    value: k,
                                    label: t(`node.${k}`),
                                    className: "flex-1 justify-center",
                                }))}
                            />
                        </div>
                        <div className="node-info-grid" data-has-billing={showBilling || undefined}>
                            <div
                                className="node-info-panel"
                                data-panel="system"
                                data-active={activeSub === "system" || undefined}
                            >
                                <Info
                                    title={t("node.system")}
                                    rows={[
                                        [t("node.os"), node.os],
                                        [t("node.arch"), node.arch],
                                        [
                                            t("node.cpu"),
                                            `${node.cpuName}${node.cpuCores ? ` × ${node.cpuCores}` : ""}`,
                                        ],
                                        [t("metric.memory"), mem ? formatBytes(mem) : ""],
                                        [t("metric.disk"), disk ? formatBytes(disk) : ""],
                                        [
                                            t("metric.swap"),
                                            node.swapTotal ? formatBytes(node.swapTotal) : "",
                                        ],
                                        [t("node.virtualization"), node.virtualization],
                                        [t("node.gpu"), node.gpuName],
                                        [
                                            t("ui.bootTime"),
                                            node.bootTime
                                                ? new Date(node.bootTime).toLocaleString(
                                                      i18n.language,
                                                  )
                                                : "",
                                        ],
                                        [t("ui.agentVersion"), node.agentVersion],
                                        [
                                            t("node.region"),
                                            node.region
                                                ? `${regionName(node.region, i18n.language)} (${node.region})`
                                                : "",
                                        ],
                                        [t("node.group"), node.groups.join(" · ")],
                                    ]}
                                />
                            </div>
                            <div
                                className="node-info-panel"
                                data-panel="network"
                                data-active={activeSub === "network" || undefined}
                            >
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
                                            day
                                                ? `${formatBytes(day.todayUp + day.todayDown)}`
                                                : "—",
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
                                        aria-valuenow={Math.min(
                                            100,
                                            ratio(used, node.trafficLimit),
                                        )}
                                    >
                                        <span
                                            style={{
                                                width: `${Math.min(100, ratio(used, node.trafficLimit))}%`,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            {showBilling && (
                                <div
                                    className="node-info-panel"
                                    data-panel="billing"
                                    data-active={activeSub === "billing" || undefined}
                                >
                                    <Info
                                        title={t("node.billing")}
                                        rows={[
                                            [t("metric.price"), billing.price(node) || "—"],
                                            [t("metric.actualCost"), billing.actualPrice(node)],
                                            [
                                                t("metric.expiry"),
                                                expiry
                                                    ? `${node.expiredAt ? new Date(node.expiredAt).toLocaleDateString(i18n.language) + " · " : ""}${expiry.text}`
                                                    : "—",
                                            ],
                                            [t("metric.autoRenew"), node.autoRenewal ? "✓" : ""],
                                        ]}
                                    />
                                    {node.note && (
                                        <p className="notice whitespace-pre-line">{node.note}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {section === "load" && (
                    <>
                        {!recordHours && <p className="notice">{t("node.liveOnly")}</p>}
                        {historyError === dataKey ? (
                            <NoData
                                title={t("app.loadError")}
                                retry={() => setNonce((v) => v + 1)}
                            />
                        ) : points === null ? (
                            <Loading />
                        ) : points.length < 2 ? (
                            <>
                                {activeRange === 0 ? (
                                    <Loading />
                                ) : (
                                    <NoData title={t("node.noHistory")} />
                                )}
                            </>
                        ) : (
                            <LoadCharts
                                node={node}
                                points={points}
                                hours={activeRange || 0.25}
                                height={150}
                                memTotal={mem}
                                diskTotal={disk}
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
                        ) : pingError === dataKey ? (
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
                        ) : reportError === reportKey ? (
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
