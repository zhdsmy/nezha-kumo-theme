import { Actions, SidebarSearch } from "@/components/Actions"
import { RegionFlag } from "@/components/RegionFlag"
import { ErrorBanner, Loading, Status } from "@/components/ui"
import { loadExchangeRates } from "@/core/cost"
import { groupCounts, parseFilterQuery, resolvePeerGroup } from "@/core/filter"
import { peerNodes } from "@/core/fleet"
import { isCanceledError, pollVisible } from "@/core/http"
import { stripFlag } from "@/core/region"
import { resolveLocale, setLocale, uiLabels } from "@/i18n"
import { HomePage } from "@/pages/HomePage"
import { Banner, SkeletonLine, Tabs } from "@cloudflare/kumo"
import { useSidebar } from "@cloudflare/kumo/components/sidebar"
import { KumoLocaleProvider } from "@cloudflare/kumo/utils"
import { AppShell, Page, type ShellLinkProps } from "@nezha-kumo/ui"
import { FolderSimpleIcon, GaugeIcon, GlobeIcon, HardDrivesIcon } from "@phosphor-icons/react"
import { Component, type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { classifyGroupIcon } from "../../../../packages/shared/group-icons"
import { responsive } from "./layout"
import { setDefaultAppearance } from "./prefs"
import { Link, navigate, useLastListHref, usePathname } from "./router"
import { SECTIONS, type Section } from "./sections"
import {
    adapter,
    nodeHref,
    setExchangeRates,
    start,
    useConnectionState,
    useSiteTitle,
    useStore,
    useVisibleNodes,
} from "./store"

const NodePage = lazy(() => import("@/pages/NodePage"))

function ShellLink(props: ShellLinkProps) {
    return (
        <Link
            {...props}
            reset={props.href === "/" && !adapter.matchNodePath(window.location.pathname)}
        />
    )
}

function BrandLink({ title }: { title: string }) {
    const { setOpenMobile } = useSidebar()
    return (
        <Link className="brand" href="/" reset onClick={() => setOpenMobile(false)}>
            <HardDrivesIcon size={24} />
            <span className="truncate" title={title || undefined}>
                {title}
            </span>
        </Link>
    )
}

function GroupNavIcon({ icon }: { icon?: string }) {
    const [status, setStatus] = useState<"pending" | "loaded" | "failed">("pending")
    const parsed = icon ? classifyGroupIcon(icon) : null
    if (!parsed || status === "failed") {
        return <FolderSimpleIcon size={16} />
    }
    if (parsed.kind === "text") {
        return <span className="group-icon-text">{parsed.value}</span>
    }
    return (
        <>
            {status === "pending" && <FolderSimpleIcon size={16} />}
            <img
                className={
                    status === "loaded"
                        ? "group-icon-img"
                        : "group-icon-img pointer-events-none absolute opacity-0"
                }
                src={parsed.value}
                alt=""
                width={16}
                height={16}
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={() => setStatus("loaded")}
                onError={() => setStatus("failed")}
            />
        </>
    )
}

class ErrorBoundary extends Component<
    { resetKey: string; children: ReactNode; fallback: ReactNode },
    { error: boolean }
> {
    state = { error: false }
    static getDerivedStateFromError() {
        return { error: true }
    }
    componentDidUpdate(prev: { resetKey: string }) {
        if (this.state.error && prev.resetKey !== this.props.resetKey) {
            this.setState({ error: false })
        }
    }
    render() {
        return this.state.error ? this.props.fallback : this.props.children
    }
}

function NodeLoadingShell({
    nodeId,
    section,
    title,
    actions,
}: {
    nodeId: string
    section: Section
    title: ReactNode
    actions: ReactNode
}) {
    const { t } = useTranslation()
    return (
        <Page
            title={title}
            actions={actions}
            tabs={
                <Tabs
                    variant="underline"
                    labels={uiLabels("tabs")}
                    value={section}
                    onValueChange={(s) =>
                        navigate(`${adapter.nodePath(nodeId)}#${s}`, { replace: true })
                    }
                    tabs={SECTIONS.map((s) => ({ value: s, label: t(`ui.${s}`) }))}
                />
            }
        >
            {section === "overview" ? (
                <Loading variant="node" />
            ) : (
                <>
                    <div className="chart-toolbar" aria-hidden="true">
                        {section === "history" ? (
                            <div className="flex items-center" style={{ height: 20 }}>
                                <SkeletonLine
                                    minWidth={100}
                                    maxWidth={100}
                                    className="h-3.5 w-20"
                                />
                            </div>
                        ) : (
                            <div className="flex h-6.5 w-64 max-w-full items-center rounded-lg bg-kumo-recessed px-2">
                                <SkeletonLine minWidth={100} maxWidth={100} />
                            </div>
                        )}
                        <div className="h-6.5 w-6.5 rounded-md border border-kumo-line bg-kumo-control" />
                    </div>
                    <Loading
                        variant={
                            section === "load"
                                ? "charts"
                                : section === "latency"
                                  ? "ping"
                                  : "history"
                        }
                    />
                    <div className="mt-8 h-[18px]" aria-hidden="true" />
                </>
            )}
        </Page>
    )
}

export function App() {
    const { t } = useTranslation()
    const phase = useStore((s) => s.phase)
    const site = useStore((s) => s.site)
    const settings = useStore((s) => s.settings)
    const groupOrder = useStore((s) => s.groupOrder)
    const groupIcons = useStore((s) => s.groupIcons)
    const connectionState = useConnectionState()
    const location = usePathname()
    const lastListHref = useLastListHref()
    const url = new URL(location, window.location.origin)
    const nodeId = adapter.matchNodePath(url.pathname)
    const nodes = useVisibleNodes()
    const node = nodes.find((n) => n.id === nodeId)
    const nodeSnap = useStore((s) => (nodeId ? s.snapshots[nodeId] : undefined))
    const offlineKey = useStore((s) => {
        if (!nodeId) return ""
        if (!s.fed) return "?"
        let out = ""
        for (const n of s.nodes) if (!s.snapshots[n.id]?.online) out += `${n.id},`
        return out
    })
    const fedForPeers = offlineKey !== "?"
    const offlineIds = useMemo(
        () => new Set(fedForPeers && offlineKey ? offlineKey.split(",").filter(Boolean) : []),
        [fedForPeers, offlineKey],
    )
    const section = SECTIONS.find((s) => url.hash === `#${s}`) ?? "overview"
    const picked = parseFilterQuery(url.search).groups ?? []
    const activeGroups = settings.showGroups ? picked : []
    const groups = settings.showGroups ? groupCounts(nodes, groupOrder) : []
    const peerGroup = nodeId
        ? resolvePeerGroup(node, lastListHref, groupOrder, settings.showGroups)
        : null
    const peers = useMemo(
        () =>
            nodeId
                ? peerNodes(nodes, peerGroup, offlineIds, fedForPeers, settings.showOffline)
                : [],
        [nodeId, nodes, peerGroup, offlineIds, fedForPeers, settings.showOffline],
    )
    useEffect(() => {
        void start()
    }, [])
    useEffect(() => {
        setDefaultAppearance(settings.defaultAppearance)
    }, [settings.defaultAppearance])
    useEffect(() => {
        if (site)
            void setLocale(
                resolveLocale(
                    settings.defaultLanguage === "auto" ? site.language : settings.defaultLanguage,
                ),
                false,
            ).catch(() => {})
    }, [site, settings.defaultLanguage])
    useEffect(() => {
        if (phase !== "ready" || !settings.showCost) return
        let active = true
        const load = () =>
            loadExchangeRates()
                .then((r) => {
                    if (active) setExchangeRates(r)
                })
                .catch((err) => {
                    if (active && !isCanceledError(err)) setExchangeRates(null, true)
                })
        const stop = pollVisible(load, 86_400_000)
        return () => {
            active = false
            stop()
        }
    }, [phase, settings.showCost])
    const siteTitle = useSiteTitle()
    useEffect(() => {
        if (!nodeId && siteTitle) document.title = siteTitle
    }, [nodeId, siteTitle])
    const reconnecting = phase === "ready" && connectionState === "reconnecting"
    const kumoTranslations = useMemo(
        () => ({
            label: {
                optional: t("ui.optional"),
                tooltip: t("ui.moreInfo"),
            },
            layerDialog: {
                close: t("auth.close"),
                cancel: t("ui.cancel"),
            },
        }),
        [t],
    )
    return (
        <KumoLocaleProvider translations={kumoTranslations}>
            <style>{responsive}</style>
            <AppShell
                brand={<BrandLink title={siteTitle} />}
                sidebarTop={<SidebarSearch />}
                linkComponent={ShellLink}
                labels={uiLabels("shell")}
                activeId={
                    nodeId ? `peer:${nodeId}` : picked.length === 1 ? `group:${picked[0]}` : "fleet"
                }
                context={
                    nodeId
                        ? {
                              backLabel: t("node.back"),
                              backHref: lastListHref,
                              title: null,
                          }
                        : undefined
                }
                nav={
                    nodeId
                        ? phase === "loading"
                            ? []
                            : [
                                  {
                                      id: "peers",
                                      title: `${peerGroup ?? t("node.allNodes")} (${peers.length})`,
                                      items: peers.map((p) => {
                                          const kind = !fedForPeers
                                              ? "connecting"
                                              : offlineIds.has(p.id)
                                                ? "offline"
                                                : "online"
                                          const statusText = t(`status.${kind}`)
                                          return {
                                              id: `peer:${p.id}`,
                                              label: stripFlag(p.name),
                                              href: nodeHref(p.id, url),
                                              icon: settings.showRegions ? (
                                                  p.region ? (
                                                      <RegionFlag code={p.region} />
                                                  ) : (
                                                      <GlobeIcon
                                                          width={16}
                                                          height={12}
                                                          className="region-flag"
                                                      />
                                                  )
                                              ) : (
                                                  <i className="peer-dot" data-status={kind} />
                                              ),
                                              badge: (
                                                  <span
                                                      className="peer-badge"
                                                      data-status={kind}
                                                      title={statusText}
                                                  >
                                                      {settings.showRegions && (
                                                          <i
                                                              className="peer-dot"
                                                              data-status={kind}
                                                              aria-hidden="true"
                                                          />
                                                      )}
                                                      <span className="sr-only">
                                                          {" "}
                                                          ({statusText})
                                                      </span>
                                                  </span>
                                              ),
                                          }
                                      }),
                                  },
                              ]
                        : [
                              {
                                  id: "main",
                                  items: [
                                      {
                                          id: "fleet",
                                          label: t("ui.overview"),
                                          href: "/",
                                          icon: <GaugeIcon size={16} />,
                                          badge: nodes.length || undefined,
                                      },
                                  ],
                              },
                              ...(groups.length > 1
                                  ? [
                                        {
                                            id: "groups",
                                            title: t("toolbar.groups"),
                                            items: groups.map(([g, count]) => ({
                                                id: `group:${g}`,
                                                label: g || t("toolbar.ungrouped"),
                                                href: `/?${new URLSearchParams({ group: g })}`,
                                                icon: (
                                                    <GroupNavIcon
                                                        key={groupIcons[g]}
                                                        icon={g ? groupIcons[g] : undefined}
                                                    />
                                                ),
                                                badge: count,
                                            })),
                                        },
                                    ]
                                  : []),
                          ]
                }
                topbar={
                    <div className="topbar-head">
                        <Link
                            className="topbar-title"
                            href="/"
                            reset
                            title={siteTitle || undefined}
                        >
                            {siteTitle}
                        </Link>
                        {reconnecting && (
                            <span
                                className="topbar-reconnect"
                                role="status"
                                aria-label={t("status.reconnecting")}
                                title={t("status.reconnecting")}
                            >
                                <i />
                                <span className="topbar-reconnect-text">
                                    {t("status.reconnecting")}
                                </span>
                            </span>
                        )}
                    </div>
                }
                actions={<Actions />}
                footer={
                    <span
                        className="connection"
                        data-open={connectionState === "live"}
                        data-status={connectionState}
                    >
                        <i />
                        {t(`status.${connectionState}`)}
                    </span>
                }
            >
                {reconnecting && (
                    <div className="disconnect-banner-wrap" data-node={nodeId ? "" : undefined}>
                        <Banner
                            variant="alert"
                            size="sm"
                            role="status"
                            className="disconnect-banner"
                        >
                            {t("status.disconnectedBanner")}
                        </Banner>
                    </div>
                )}
                <ErrorBoundary
                    resetKey={url.pathname}
                    fallback={
                        <Page title={t("ui.overview")}>
                            <ErrorBanner
                                description={t("app.loadErrorHint")}
                                onRetry={() => window.location.reload()}
                            />
                        </Page>
                    }
                >
                    {nodeId && phase !== "error" && (
                        <style>{".nk-shell-body { --nk-page-max: 1100px; }"}</style>
                    )}
                    {phase === "loading" ? (
                        nodeId ? (
                            <NodeLoadingShell
                                nodeId={nodeId}
                                section={section}
                                title={
                                    <span
                                        className="flex items-center"
                                        style={{ height: 25 }}
                                        aria-hidden="true"
                                    >
                                        <SkeletonLine
                                            minWidth={100}
                                            maxWidth={100}
                                            className="h-5 w-44"
                                        />
                                    </span>
                                }
                                actions={
                                    <span className="status" aria-hidden="true">
                                        <SkeletonLine
                                            minWidth={100}
                                            maxWidth={100}
                                            className="h-5 w-16 rounded-full"
                                        />
                                    </span>
                                }
                            />
                        ) : (
                            <Page
                                eyebrow={activeGroups.length ? t("toolbar.groups") : undefined}
                                title={
                                    activeGroups.length
                                        ? activeGroups.length === 1
                                            ? activeGroups[0] || t("toolbar.ungrouped")
                                            : activeGroups.join(" · ")
                                        : t("ui.overview")
                                }
                                actions={
                                    settings.showCost && (
                                        <div
                                            className="cost-button flex h-9 w-32 items-center rounded-lg border border-kumo-line bg-kumo-control px-3"
                                            aria-hidden="true"
                                        >
                                            <SkeletonLine minWidth={100} maxWidth={100} />
                                        </div>
                                    )
                                }
                            >
                                <Loading variant="home" />
                            </Page>
                        )
                    ) : phase === "error" ? (
                        <Page title={t("ui.overview")}>
                            <ErrorBanner
                                description={t("app.loadErrorHint")}
                                onRetry={() => void start()}
                            />
                        </Page>
                    ) : nodeId ? (
                        <Suspense
                            fallback={
                                <NodeLoadingShell
                                    nodeId={nodeId}
                                    section={section}
                                    title={
                                        node ? (
                                            settings.showRegions && node.region ? (
                                                <>
                                                    <RegionFlag
                                                        code={node.region}
                                                        className="mr-2"
                                                    />
                                                    {stripFlag(node.name)}
                                                </>
                                            ) : (
                                                stripFlag(node.name)
                                            )
                                        ) : null
                                    }
                                    actions={<Status snapshot={nodeSnap} />}
                                />
                            }
                        >
                            <NodePage id={nodeId} section={section} />
                        </Suspense>
                    ) : url.pathname === "/" ? (
                        <HomePage />
                    ) : (
                        <Page title={t("ui.notFound")}>
                            <Link className="text-kumo-link" href="/">
                                {t("node.back")}
                            </Link>
                        </Page>
                    )}
                </ErrorBoundary>
            </AppShell>
        </KumoLocaleProvider>
    )
}
