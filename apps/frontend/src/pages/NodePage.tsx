import { HISTORY_CACHE_MS } from "@/adapters/nezha"
import { useLocalMidnight } from "@/app/history"
import { setShave, useShave } from "@/app/prefs"
import { Link, navigate, useLastListHref, usePathname } from "@/app/router"
import { SECTIONS, type Section } from "@/app/sections"
import {
    adapter,
    backfillLive,
    getLive,
    getTraffic,
    useSiteTitle,
    useStore,
    useVisibleNodes,
} from "@/app/store"
import { HourGrid } from "@/components/HourGrid"
import { LoadCharts, PingChart } from "@/components/NodeCharts"
import { RegionFlag } from "@/components/RegionFlag"
import { useBilling } from "@/components/billing"
import { ErrorBanner, Info, Loading, Meter, NoData, PageFootnote, Status } from "@/components/ui"
import { formatBytes, formatSpeed, formatUsage, quotaUsage, ratio } from "@/core/format"
import { isCanceledError, pollVisible } from "@/core/http"
import type { HistoryPoint, PingData } from "@/core/model"
import { regionName, stripFlag } from "@/core/region"
import { hasDailyCounters, mergeHistoryTail, summariseDay } from "@/core/summary"
import { uiLabels } from "@/i18n"
import { Badge, Banner, RefreshButton, Tabs } from "@cloudflare/kumo"
import { Page } from "@nezha-kumo/ui"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { splitTags } from "../../../../packages/shared/public-note"

function NoteTags({ value }: { value: string }) {
    if (!/[,，]/.test(value)) return <span className="whitespace-pre-line">{value}</span>
    return (
        <div className="flex flex-wrap gap-1">
            {splitTags(value).map((tag, index) => (
                <Badge
                    variant="secondary"
                    key={index}
                    className="max-w-full whitespace-normal break-words"
                >
                    {tag}
                </Badge>
            ))}
        </div>
    )
}

type SubTab = "system" | "network" | "billing"

export default function NodePage({ id, section }: { id: string; section: Section }) {
    const { t, i18n } = useTranslation()
    const nodes = useVisibleNodes()
    const node = nodes.find((n) => n.id === id)
    const snap = useStore((s) => s.snapshots[id])
    const fed = useStore((s) => s.fed)
    const recordHours = useStore((s) => s.site?.recordHours ?? 0)
    const showBilling = useStore((s) => s.settings.showBilling)
    const showRegions = useStore((s) => s.settings.showRegions)
    const title = useSiteTitle()
    const lastListHref = useLastListHref()
    const hash = new URL(usePathname(), window.location.origin).hash
    const [subTab, setSubTab] = useState<"system" | "network">("system")
    const [range, setRange] = useState(0)
    const ranges = adapter.historyRanges.filter((h) => h === 0 || h <= recordHours)
    const activeRange = ranges.includes(range) ? range : 0
    const liveVersion = useStore((s) =>
        section === "overview" || (section === "load" && !activeRange) ? s.liveVersion : -1,
    )
    const [nonce, setNonce] = useState(0)
    const [liveBackfilledKey, setLiveBackfilledKey] = useState("")
    const [history, setHistory] = useState<{
        id: string
        key: string
        hours: number
        points: HistoryPoint[]
    } | null>(null)
    const [ping, setPing] = useState<{
        id: string
        key: string
        hours: number
        data: PingData
    } | null>(null)
    const [dayResult, setDayResult] = useState<{ key: string; points: HistoryPoint[] } | null>(null)
    const [reportResult, setReports] = useState<{
        id: string
        key: string
        points: HistoryPoint[]
    } | null>(null)
    const [historyError, setHistoryError] = useState("")
    const [pingError, setPingError] = useState("")
    const [reportError, setReportError] = useState("")
    const shave = useShave()
    const billing = useBilling()
    const dataKey = `${id}:${activeRange}:${nonce}`
    const midnight = useLocalMidnight()
    const dayKey = `${id}:${nonce}:${midnight}`
    const reportHours = recordHours >= 168 ? 168 : 24
    const reportKey = `${id}:${reportHours}:${nonce}`
    const dayPoints = dayResult?.key === dayKey ? dayResult.points : null
    const reports = reportResult?.key === reportKey ? reportResult.points : null
    const live = useMemo(
        () => (section === "load" && !activeRange ? [...getLive(id)] : []),
        [id, section, activeRange, liveVersion],
    )
    useEffect(() => {
        if (section !== "load" || !recordHours) return
        const ctrl = new AbortController()
        void backfillLive(id, ctrl.signal)
            .catch(() => {})
            .finally(() => {
                if (!ctrl.signal.aborted) setLiveBackfilledKey(dayKey)
            })
        return () => ctrl.abort()
    }, [id, section, recordHours, dayKey])
    useEffect(() => {
        if (!title) return
        document.title = node ? `${stripFlag(node.name)} · ${title}` : title
    }, [node, title])
    useEffect(() => {
        if (section !== "load" || !activeRange) return
        const ctrl = new AbortController()
        adapter
            .loadHistory(id, activeRange, "overview", ctrl.signal)
            .then((points) => {
                if (!ctrl.signal.aborted) {
                    setHistoryError("")
                    setHistory({ id, key: dataKey, hours: activeRange, points })
                }
            })
            .catch((err) => {
                if (!isCanceledError(err, ctrl.signal)) setHistoryError(dataKey)
            })
        return () => ctrl.abort()
    }, [id, activeRange, section, dataKey])
    useEffect(() => {
        if (section !== "latency" || !recordHours) return
        const ctrl = new AbortController()
        const hours = activeRange || 0.25
        const load = () =>
            adapter
                .loadPing(id, hours, ctrl.signal)
                .then((data) => {
                    if (!ctrl.signal.aborted) {
                        setPingError("")
                        setPing({ id, key: dataKey, hours, data })
                    }
                })
                .catch((err) => {
                    if (!isCanceledError(err, ctrl.signal)) setPingError(dataKey)
                })
        const stop = activeRange === 0 ? pollVisible(load, 30_000) : (void load(), () => {})
        return () => {
            ctrl.abort()
            stop()
        }
    }, [id, activeRange, section, recordHours, dataKey])
    useEffect(() => {
        if (section !== "overview" || !recordHours) return
        const ctrl = new AbortController()
        const stop = pollVisible(async () => {
            const points = await adapter.loadHistory(id, 24, "billing", ctrl.signal)
            if (!ctrl.signal.aborted) setDayResult({ key: dayKey, points })
        }, HISTORY_CACHE_MS)
        return () => {
            ctrl.abort()
            stop()
        }
    }, [id, recordHours, section, dayKey])
    useEffect(() => {
        if (section !== "history" || !recordHours) return
        const ctrl = new AbortController()
        adapter
            .loadHistory(id, reportHours, "reports", ctrl.signal)
            .then((p) => {
                if (!ctrl.signal.aborted) {
                    setReportError("")
                    setReports({ id, key: reportKey, points: p })
                }
            })
            .catch((err) => {
                if (!isCanceledError(err, ctrl.signal)) setReportError(reportKey)
            })
        return () => ctrl.abort()
    }, [id, recordHours, reportHours, section, reportKey])
    if (!node)
        return (
            <Page maxWidth={1100} title={t("node.notFound")}>
                <Link className="text-kumo-link" href={lastListHref}>
                    {t("node.back")}
                </Link>
                <PageFootnote />
            </Page>
        )
    const points = activeRange === 0 ? live : history?.key === dataKey ? history.points : null
    const pingData = ping?.key === dataKey ? ping.data : null
    const loadPending = activeRange
        ? history?.key !== dataKey && historyError !== dataKey
        : recordHours > 0 && liveBackfilledKey !== dayKey
    const pingPending = recordHours > 0 && ping?.key !== dataKey && pingError !== dataKey
    const reportPending =
        recordHours > 0 && reportResult?.key !== reportKey && reportError !== reportKey
    const staleLoad = loadPending
        ? history?.id === id && history.points.length >= 2
            ? { points: history.points, hours: history.hours }
            : (() => {
                  const buf = getLive(id)
                  return buf.length >= 2 ? { points: [...buf], hours: 0.25 } : null
              })()
        : null
    const stalePing = pingPending && ping?.id === id && ping.data.tasks.length ? ping : null
    const staleReports =
        reportPending && reportResult?.id === id && reportResult.points.length
            ? reportResult.points
            : null
    const triggerRefresh = () => {
        adapter.clearHistory(id)
        setNonce((v) => v + 1)
    }
    const labelRange = (h: number) =>
        h === 0
            ? t("node.rangeLive")
            : h < 24
              ? t("node.rangeHours", { count: h })
              : t("node.rangeDays", { count: h / 24 })
    const day =
        dayPoints?.length && snap
            ? summariseDay(
                  mergeHistoryTail(dayPoints, getTraffic(id), Date.now() - 86_400_000),
                  snap,
                  midnight,
              )
            : null
    const mem = snap?.memTotal || node.memTotal,
        disk = snap?.diskTotal || node.diskTotal
    const used = quotaUsage(node, snap),
        expiry = billing.expiry(node)
    const activeSub: SubTab = hash === "#billing" && showBilling ? "billing" : subTab
    const subTabs: SubTab[] = showBilling ? ["system", "network", "billing"] : ["system", "network"]
    const tabLabels = uiLabels("tabs")
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
                    labels={tabLabels}
                    value={section}
                    onValueChange={(s) =>
                        navigate(`${adapter.nodePath(id)}#${s}`, { replace: true })
                    }
                    tabs={SECTIONS.map((s) => ({ value: s, label: t(`ui.${s}`) }))}
                />
            }
        >
            <section aria-label={t(`ui.${section}`)}>
                {section !== "overview" && (
                    <div className="chart-toolbar">
                        {section === "history" ? (
                            <span className="muted num text-sm">
                                {reportHours > 24
                                    ? t("node.recentDays", { count: reportHours / 24 })
                                    : t("node.recentHours", { count: reportHours })}
                            </span>
                        ) : (
                            <div className="min-w-0" aria-label={t("money.period")}>
                                <Tabs
                                    variant="segmented"
                                    size="sm"
                                    activateOnFocus
                                    className="w-fit max-w-full"
                                    labels={tabLabels}
                                    value={String(activeRange)}
                                    onValueChange={(v) => setRange(Number(v))}
                                    tabs={ranges.map((h) => ({
                                        value: String(h),
                                        label: labelRange(h),
                                    }))}
                                />
                            </div>
                        )}
                        <RefreshButton
                            size="sm"
                            aria-label={t("node.refresh")}
                            title={t("node.refresh")}
                            loading={
                                section === "load"
                                    ? loadPending
                                    : section === "latency"
                                      ? pingPending
                                      : reportPending
                            }
                            onClick={triggerRefresh}
                        />
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
                                detail={formatUsage(snap?.memUsed ?? 0, mem)}
                            />
                            <Meter
                                label={t("metric.disk")}
                                value={ratio(snap?.diskUsed ?? 0, disk)}
                                kind="disk"
                                detail={formatUsage(snap?.diskUsed ?? 0, disk)}
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
                                labels={tabLabels}
                                value={activeSub}
                                onValueChange={(v) => {
                                    if (v === "billing") {
                                        navigate(`${adapter.nodePath(id)}#billing`, {
                                            replace: true,
                                        })
                                    } else {
                                        setSubTab(v as "system" | "network")
                                        if (hash === "#billing") {
                                            navigate(adapter.nodePath(id), { replace: true })
                                        }
                                    }
                                }}
                                tabs={subTabs.map((k) => ({
                                    value: k,
                                    label: t(`node.${k}`),
                                    className: "flex-1 justify-center",
                                    render: (
                                        <button
                                            id={`node-subtab-${k}`}
                                            aria-controls={`node-panel-${k}`}
                                            type="button"
                                        />
                                    ),
                                }))}
                            />
                        </div>
                        <div className="node-info-grid" data-has-billing={showBilling || undefined}>
                            <div
                                id="node-panel-system"
                                className="node-info-panel"
                                data-panel="system"
                                data-active={activeSub === "system" || undefined}
                            >
                                <Info
                                    title={t("node.system")}
                                    labelId="node-subtab-system"
                                    rows={[
                                        [t("node.os"), node.os],
                                        [t("node.arch"), node.arch],
                                        [
                                            t("node.cpu"),
                                            `${node.cpuName}${node.cpuCores ? ` ×\u00A0${node.cpuCores}` : ""}`,
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
                                id="node-panel-network"
                                className="node-info-panel"
                                data-panel="network"
                                data-active={activeSub === "network" || undefined}
                            >
                                <Info
                                    title={t("node.network")}
                                    labelId="node-subtab-network"
                                    rows={[
                                        [t("node.bandwidth"), node.bandwidth],
                                        [
                                            t("node.ipSupport"),
                                            [
                                                node.ipv4 === undefined
                                                    ? ""
                                                    : `IPv4\u00A0${node.ipv4 ? "✓" : "×"}`,
                                                node.ipv6 === undefined
                                                    ? ""
                                                    : `IPv6\u00A0${node.ipv6 ? "✓" : "×"}`,
                                            ]
                                                .filter(Boolean)
                                                .join(" · "),
                                        ],
                                        [
                                            t("node.networkRoute"),
                                            node.networkRoute ? (
                                                <NoteTags value={node.networkRoute} />
                                            ) : (
                                                ""
                                            ),
                                        ],
                                        [t("metric.upload"), formatBytes(snap?.totalUp ?? 0)],
                                        [t("metric.download"), formatBytes(snap?.totalDown ?? 0)],
                                        [
                                            t("ui.todayTraffic"),
                                            day && hasDailyCounters(dayPoints ?? [], midnight)
                                                ? `${formatBytes(day.todayUp + day.todayDown)}`
                                                : "—",
                                        ],
                                        [
                                            t("node.peak"),
                                            day
                                                ? `↑\u00A0${formatSpeed(day.peakUp).replace(" ", "\u00A0")} · ↓\u00A0${formatSpeed(day.peakDown).replace(" ", "\u00A0")}`
                                                : "—",
                                        ],
                                        [t("metric.quota"), billing.quota(node)],
                                        [
                                            t("node.trafficBilling"),
                                            node.trafficLimitTypeExplicit
                                                ? t(`node.traffic.${node.trafficLimitType}`)
                                                : "",
                                        ],
                                        [t("ui.quotaUsed"), used !== null ? formatBytes(used) : ""],
                                    ]}
                                />
                                {node.trafficLimitPeriod ? (
                                    <Banner variant="secondary" size="sm" className="mt-3">
                                        {t("node.noCycleUsage")}
                                    </Banner>
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
                                            Math.round(ratio(used, node.trafficLimit)),
                                        )}
                                        aria-valuetext={formatUsage(used, node.trafficLimit)}
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
                                    id="node-panel-billing"
                                    className="node-info-panel"
                                    data-panel="billing"
                                    data-active={activeSub === "billing" || undefined}
                                >
                                    <Info
                                        title={t("node.billing")}
                                        labelId="node-subtab-billing"
                                        rows={[
                                            [t("metric.price"), billing.price(node) || "—"],
                                            [t("metric.actualCost"), billing.actualPrice(node)],
                                            [
                                                t("metric.expiry"),
                                                expiry
                                                    ? `${expiry.at ? new Date(expiry.at).toLocaleDateString(i18n.language) + " · " : ""}${expiry.text}`
                                                    : "—",
                                            ],
                                            [t("metric.autoRenew"), node.autoRenewal ? "✓" : ""],
                                        ]}
                                    />
                                    {node.note &&
                                        (/[,，]/.test(node.note) ? (
                                            <div className="mt-3">
                                                <NoteTags value={node.note} />
                                            </div>
                                        ) : (
                                            <Banner
                                                variant="secondary"
                                                size="sm"
                                                className="mt-3 whitespace-pre-line"
                                            >
                                                {node.note}
                                            </Banner>
                                        ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {section === "load" && (
                    <>
                        {!recordHours && (
                            <Banner variant="secondary" size="sm" className="mb-4">
                                {t("node.liveOnly")}
                            </Banner>
                        )}
                        {historyError === dataKey ? (
                            <ErrorBanner
                                description={t("app.loadErrorHint")}
                                onRetry={triggerRefresh}
                            />
                        ) : points !== null && points.length >= 2 ? (
                            <div
                                className={
                                    loadPending
                                        ? "opacity-50 transition-opacity"
                                        : "transition-opacity"
                                }
                                aria-busy={loadPending || undefined}
                            >
                                <LoadCharts
                                    node={node}
                                    points={points}
                                    hours={activeRange || 0.25}
                                    height={150}
                                    memTotal={mem}
                                    diskTotal={disk}
                                />
                            </div>
                        ) : staleLoad ? (
                            <div className="opacity-50 transition-opacity" aria-busy="true">
                                <LoadCharts
                                    node={node}
                                    points={staleLoad.points}
                                    hours={staleLoad.hours}
                                    height={150}
                                    memTotal={mem}
                                    diskTotal={disk}
                                />
                            </div>
                        ) : points === null ||
                          (activeRange === 0 &&
                              ((recordHours > 0 && liveBackfilledKey !== dayKey) ||
                                  (!recordHours && (!fed || snap?.online)))) ? (
                            <Loading variant="charts" />
                        ) : (
                            <NoData title={t("node.noHistory")} />
                        )}
                    </>
                )}
                {section === "latency" && (
                    <>
                        {!recordHours ? (
                            <NoData title={t("node.liveOnly")} />
                        ) : pingError === dataKey ? (
                            <ErrorBanner
                                description={t("app.loadErrorHint")}
                                onRetry={triggerRefresh}
                            />
                        ) : pingData !== null && pingData.tasks.length > 0 ? (
                            <div
                                className={
                                    pingPending
                                        ? "opacity-50 transition-opacity"
                                        : "transition-opacity"
                                }
                                aria-busy={pingPending || undefined}
                            >
                                <PingChart
                                    key={id}
                                    data={pingData}
                                    hours={activeRange || 0.25}
                                    height={280}
                                    shave={shave}
                                    onShaveChange={setShave}
                                />
                            </div>
                        ) : stalePing ? (
                            <div className="opacity-50 transition-opacity" aria-busy="true">
                                <PingChart
                                    key={id}
                                    data={stalePing.data}
                                    hours={stalePing.hours}
                                    height={280}
                                    shave={shave}
                                    onShaveChange={setShave}
                                />
                            </div>
                        ) : pingData === null ? (
                            <Loading variant="ping" />
                        ) : (
                            <NoData title={t("node.noPing")} />
                        )}
                    </>
                )}
                {section === "history" && (
                    <>
                        {!recordHours ? (
                            <NoData title={t("node.liveOnly")} />
                        ) : reportError === reportKey ? (
                            <ErrorBanner
                                description={t("app.loadErrorHint")}
                                onRetry={triggerRefresh}
                            />
                        ) : reports !== null && reports.length > 0 ? (
                            <div
                                className={
                                    reportPending
                                        ? "opacity-50 transition-opacity"
                                        : "transition-opacity"
                                }
                                aria-busy={reportPending || undefined}
                            >
                                <HourGrid points={reports} days={reportHours / 24} />
                            </div>
                        ) : staleReports ? (
                            <div className="opacity-50 transition-opacity" aria-busy="true">
                                <HourGrid points={staleReports} days={reportHours / 24} />
                            </div>
                        ) : reports === null ? (
                            <Loading variant="history" />
                        ) : (
                            <NoData title={t("node.noHistory")} />
                        )}
                    </>
                )}
            </section>
            <PageFootnote />
        </Page>
    )
}
