import { Actions, SidebarSearch } from "@/components/Actions"
import { RegionFlag } from "@/components/RegionFlag"
import { Loading, NoData, PageFootnote, Status } from "@/components/ui"
import { loadExchangeRates } from "@/core/cost"
import { groupCounts, parseFilterQuery, resolvePeerGroup } from "@/core/filter"
import { peerNodes } from "@/core/fleet"
import { pollVisible } from "@/core/http"
import { stripFlag } from "@/core/region"
import { resolveLocale, setLocale, uiLabels } from "@/i18n"
import { HomePage } from "@/pages/HomePage"
import { Button, SkeletonLine, Tabs } from "@cloudflare/kumo"
import { useSidebar } from "@cloudflare/kumo/components/sidebar"
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
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const parsed = icon ? classifyGroupIcon(icon) : null
    if (!parsed || (parsed.kind === "image" && failedSrc === parsed.value)) {
        return <FolderSimpleIcon size={16} />
    }
    if (parsed.kind === "text") {
        return <span className="group-icon-text">{parsed.value}</span>
    }
    return (
        <img
            className="group-icon-img"
            src={parsed.value}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedSrc(parsed.value)}
        />
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
            maxWidth={1100}
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
                    {(section === "load" || section === "latency") && (
                        <div className="chart-toolbar" aria-hidden="true">
                            <div className="flex h-6.5 w-64 max-w-full items-center rounded-lg bg-kumo-recessed px-2">
                                <SkeletonLine minWidth={100} maxWidth={100} />
                            </div>
                            <div className="h-6.5 w-6.5 rounded-md border border-kumo-line bg-kumo-control" />
                        </div>
                    )}
                    {(section === "latency" || section === "history") && (
                        <div className="section-heading" aria-hidden="true">
                            <div className="flex items-center" style={{ height: 24 }}>
                                <SkeletonLine minWidth={100} maxWidth={100} className="h-4 w-20" />
                            </div>
                            <div className="h-6.5 w-6.5 rounded-md" />
                        </div>
                    )}
                    <Loading
                        variant={
                            section === "load"
                                ? "charts"
                                : section === "latency"
                                  ? "ping"
                                  : "history"
                        }
                    />
                    <PageFootnote />
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
    const connection = useStore((s) => s.connection)
    const everConnected = useStore((s) => s.everConnected)
    const connectionState =
        connection === "open" ? "live" : everConnected ? "reconnecting" : "connecting"
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
            )
    }, [site, settings.defaultLanguage])
    useEffect(() => {
        if (phase !== "ready" || (!settings.showCost && !settings.showBilling)) return
        let active = true
        const load = () =>
            loadExchangeRates()
                .then((r) => {
                    if (active) setExchangeRates(r)
                })
                .catch(() => {
                    if (active) setExchangeRates(null, true)
                })
        const stop = pollVisible(load, 86_400_000)
        return () => {
            active = false
            stop()
        }
    }, [phase, settings.showCost, settings.showBilling])
    const siteTitle = useSiteTitle()
    useEffect(() => {
        if (!nodeId && siteTitle) document.title = siteTitle
    }, [nodeId, siteTitle])
    useEffect(() => {
        if (!nodeId) return
        const frame = requestAnimationFrame(() => {
            const active = document.querySelector<HTMLElement>(
                '.nk-sidebar [data-sidebar="sliding-view"]:not([inert]) nav a[aria-current="page"]',
            )
            const viewport = active?.closest<HTMLElement>('[data-sidebar="viewport"]')
            if (!active || !viewport) return
            const stickyBottom =
                viewport.querySelector<HTMLElement>(".nk-context")?.getBoundingClientRect()
                    .bottom ?? viewport.getBoundingClientRect().top
            const vpRect = viewport.getBoundingClientRect()
            const itemRect = active.getBoundingClientRect()
            if (itemRect.top < stickyBottom) {
                viewport.scrollTop -= stickyBottom - itemRect.top + 8
            } else if (itemRect.bottom > vpRect.bottom) {
                viewport.scrollTop += itemRect.bottom - vpRect.bottom + 8
            }
        })
        return () => cancelAnimationFrame(frame)
    }, [nodeId, peers.length])
    return (
        <>
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
                    <Link className="topbar-title" href="/" reset title={siteTitle || undefined}>
                        {siteTitle}
                    </Link>
                }
                actions={<Actions />}
                footer={
                    <span
                        className="connection"
                        data-open={connection === "open"}
                        data-status={connectionState}
                    >
                        <i />
                        {t(`status.${connectionState}`)}
                    </span>
                }
            >
                <ErrorBoundary
                    resetKey={url.pathname}
                    fallback={
                        <Page title={t("app.loadError")}>
                            <NoData
                                title={t("app.loadError")}
                                retry={() => window.location.reload()}
                            />
                        </Page>
                    }
                >
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
                        <Page title={t("app.loadError")} description={t("app.loadErrorHint")}>
                            <Button variant="primary" onClick={() => void start()}>
                                {t("app.retry")}
                            </Button>
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
        </>
    )
}
