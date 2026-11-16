import { Actions } from "@/components/Actions"
import { Loading, NoData } from "@/components/ui"
import { loadExchangeRates } from "@/core/cost"
import { groupCounts, parseFilterQuery } from "@/core/filter"
import { pollVisible } from "@/core/http"
import { stripFlag } from "@/core/region"
import { resolveLocale, setLocale } from "@/i18n"
import { HomePage } from "@/pages/HomePage"
import { Button } from "@cloudflare/kumo"
import { AppShell, Page } from "@nezha-kumo/ui"
import {
    ChartLineIcon,
    ClockIcon,
    FolderSimpleIcon,
    GaugeIcon,
    HardDrivesIcon,
    PulseIcon,
} from "@phosphor-icons/react"
import { Component, type ReactNode, Suspense, lazy, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { responsive } from "./layout"
import { setDefaultAppearance } from "./prefs"
import { Link, usePathname } from "./router"
import { SECTIONS } from "./sections"
import { adapter, setExchangeRates, start, useStore, useVisibleNodes } from "./store"

const NodePage = lazy(() => import("@/pages/NodePage"))
const icons = [
    <GaugeIcon size={16} />,
    <PulseIcon size={16} />,
    <ChartLineIcon size={16} />,
    <ClockIcon size={16} />,
]

class ErrorBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { error: boolean }
> {
    state = { error: false }
    static getDerivedStateFromError() {
        return { error: true }
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
    const connection = useStore((s) => s.connection)
    const location = usePathname()
    const url = new URL(location, window.location.origin)
    const nodeId = adapter.matchNodePath(url.pathname)
    const nodes = useVisibleNodes()
    const node = nodes.find((n) => n.id === nodeId)
    const section = SECTIONS.find((s) => url.hash === `#${s}`) ?? "overview"
    const picked = parseFilterQuery(url.search).groups ?? []
    const groups = settings.showGroups ? groupCounts(nodes) : []
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
    return (
        <>
            <style>{responsive}</style>
            <AppShell
                brand={
                    <span className="brand">
                        <HardDrivesIcon size={24} />
                        <span className="truncate" title={siteTitle}>
                            {siteTitle}
                        </span>
                    </span>
                }
                linkComponent={Link}
                activeId={nodeId ? section : picked.length === 1 ? `group:${picked[0]}` : "fleet"}
                context={
                    nodeId
                        ? {
                              backLabel: t("node.back"),
                              backHref: "/",
                              title: (
                                  <span title={node?.name}>
                                      {node ? stripFlag(node.name) : nodeId}
                                  </span>
                              ),
                          }
                        : undefined
                }
                nav={[
                    {
                        id: "main",
                        items: nodeId
                            ? SECTIONS.map((s, i) => ({
                                  id: s,
                                  label: t(`ui.${s}`),
                                  href: `${adapter.nodePath(nodeId)}#${s}`,
                                  icon: icons[i],
                              }))
                            : [
                                  {
                                      id: "fleet",
                                      label: t("ui.overview"),
                                      href: "/",
                                      icon: <GaugeIcon size={16} />,
                                      badge: nodes.length || undefined,
                                  },
                              ],
                    },
                    ...(!nodeId && groups.length > 1
                        ? [
                              {
                                  id: "groups",
                                  title: t("toolbar.groups"),
                                  items: groups.map(([g, count]) => ({
                                      id: `group:${g}`,
                                      label: g || t("toolbar.ungrouped"),
                                      href: `/?${new URLSearchParams({ group: g })}`,
                                      icon: <FolderSimpleIcon size={16} />,
                                      badge: count,
                                  })),
                              },
                          ]
                        : []),
                ]}
                topbar={
                    <span className="topbar-title" title={siteTitle}>
                        {siteTitle}
                    </span>
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
                    key={url.pathname}
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
                            <NodePage key={nodeId} id={nodeId} section={section} />
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
