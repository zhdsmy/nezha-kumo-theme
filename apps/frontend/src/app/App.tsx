import { Actions } from "@/components/Actions"
import { RegionFlag } from "@/components/RegionFlag"
import { Loading, NoData } from "@/components/ui"
import { loadExchangeRates } from "@/core/cost"
import { groupCounts, parseFilterQuery, resolvePeerGroup } from "@/core/filter"
import { peerNodes } from "@/core/fleet"
import { pollVisible } from "@/core/http"
import { stripFlag } from "@/core/region"
import { resolveLocale, setLocale } from "@/i18n"
import { HomePage } from "@/pages/HomePage"
import { Button } from "@cloudflare/kumo"
import { useSidebar } from "@cloudflare/kumo/components/sidebar"
import { AppShell, Page } from "@nezha-kumo/ui"
import { FolderSimpleIcon, GaugeIcon, GlobeIcon, HardDrivesIcon } from "@phosphor-icons/react"
import { Component, type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { classifyGroupIcon } from "../../../../packages/shared/group-icons"
import { responsive } from "./layout"
import { setDefaultAppearance } from "./prefs"
import { Link, useLastListHref, usePathname } from "./router"
import { SECTIONS } from "./sections"
import { adapter, setExchangeRates, start, useStore, useVisibleNodes } from "./store"

const NodePage = lazy(() => import("@/pages/NodePage"))

function BrandLink({ title }: { title: string }) {
    const { setOpenMobile } = useSidebar()
    return (
        <Link className="brand" href="/" reset onClick={() => setOpenMobile(false)}>
            <HardDrivesIcon size={24} />
            <span className="truncate" title={title}>
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

export function App() {
    const { t } = useTranslation()
    const phase = useStore((s) => s.phase)
    const site = useStore((s) => s.site)
    const settings = useStore((s) => s.settings)
    const groupOrder = useStore((s) => s.groupOrder)
    const groupIcons = useStore((s) => s.groupIcons)
    const connection = useStore((s) => s.connection)
    const location = usePathname()
    const lastListHref = useLastListHref()
    const url = new URL(location, window.location.origin)
    const nodeId = adapter.matchNodePath(url.pathname)
    const nodes = useVisibleNodes()
    const node = nodes.find((n) => n.id === nodeId)
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
    const siteTitle = settings.siteTitle || site?.name || "Nezha"
    useEffect(() => {
        if (!nodeId) document.title = siteTitle
    }, [nodeId, siteTitle])
    useEffect(() => {
        if (!nodeId) return
        const frame = requestAnimationFrame(() => {
            const active = document.querySelector<HTMLElement>(
                '.nk-sidebar nav a[aria-current="page"]',
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
                linkComponent={Link}
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
                        ? [
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
                                          href: `${adapter.nodePath(p.id)}${url.hash}`,
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
                                                  <span className="sr-only"> ({statusText})</span>
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
                    <Link className="topbar-title" href="/" reset title={siteTitle}>
                        {siteTitle}
                    </Link>
                }
                actions={<Actions />}
                footer={
                    <span className="connection" data-open={connection === "open"}>
                        <i />
                        {t(connection === "open" ? "status.live" : "status.reconnecting")}
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
                        <Page title={t("ui.overview")}>
                            <Loading />
                        </Page>
                    ) : phase === "error" ? (
                        <Page title={t("app.loadError")} description={t("app.loadErrorHint")}>
                            <Button variant="primary" onClick={() => void start()}>
                                {t("app.retry")}
                            </Button>
                        </Page>
                    ) : nodeId ? (
                        <Suspense
                            fallback={
                                <Page title={t("ui.overview")}>
                                    <Loading />
                                </Page>
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
