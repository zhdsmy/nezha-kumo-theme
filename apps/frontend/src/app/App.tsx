import { Actions } from "@/components/Actions"
import { Loading, NoData } from "@/components/ui"
import { loadExchangeRates } from "@/core/cost"
import { stripFlag } from "@/core/region"
import { resolveLocale, setLocale } from "@/i18n"
import { HomePage } from "@/pages/HomePage"
import { Button } from "@cloudflare/kumo"
import { AppShell, BREAKPOINTS, Page } from "@nezha-kumo/ui"
import {
    ChartLineIcon,
    ClockIcon,
    CreditCardIcon,
    GaugeIcon,
    HardDrivesIcon,
} from "@phosphor-icons/react"
import { Component, type ReactNode, Suspense, lazy, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { setDefaultAppearance } from "./prefs"
import { Link, usePathname } from "./router"
import { adapter, setExchangeRates, start, useStore, useVisibleNodes } from "./store"

const NodePage = lazy(() => import("@/pages/NodePage"))
const sections = ["overview", "latency", "billing", "history"] as const
const icons = [
    <GaugeIcon size={16} />,
    <ChartLineIcon size={16} />,
    <CreditCardIcon size={16} />,
    <ClockIcon size={16} />,
]
const responsive = `
@media (min-width:${BREAKPOINTS.gutter}px) {
 .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .action-label { display:inline; }
 .fleet-table { display:table; }
 .fleet-table thead { display:table-header-group; }
 .fleet-table tbody { display:table-row-group; }
 .fleet-table .server-row { display:table-row; }
 .fleet-table .server-row > td { display:table-cell; padding:12px 10px; }
 .fleet-table .wide-cell { display:none !important; }
 .fleet-table .server-name { width:29%; }
 .fleet-table .server-status { width:17%; }
 .fleet-table .server-network { width:23%; }
 .fleet-table .row-expand { width:38px; }
 .fleet-table .server-name > a { font-size:14px; }
 .fleet-table .meter-label,.fleet-table .cell-label { display:none; }
 .fleet-table .server-row { border-bottom:1px solid var(--color-kumo-line); border-radius:0; }
 .fleet-table .expanded-row { display:table-row; }
}
@media (min-width:${BREAKPOINTS.wide}px) {
 .metric-grid { grid-template-columns:repeat(5,minmax(0,1fr)); }
 .node-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .chart-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .fleet-table .wide-cell { display:table-cell !important; }
 .fleet-table .server-name { width:22%; }
 .fleet-table .server-status { width:12%; }
 .fleet-table .server-network { width:19%; }
 .fleet-table .server-row > .row-expand,.fleet-table thead .row-expand,.fleet-table .expanded-row { display:none; }
}
`

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
    const section = sections.find((s) => url.hash === `#${s}`) ?? "overview"
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
        if (!settings.showCost && !settings.showBilling) return
        let active = true
        const load = () =>
            loadExchangeRates()
                .then((r) => {
                    if (active) setExchangeRates(r)
                })
                .catch(() => {
                    if (active) setExchangeRates(null, true)
                })
        void load()
        const timer = window.setInterval(() => void load(), 86_400_000)
        return () => {
            active = false
            clearInterval(timer)
        }
    }, [settings.showCost, settings.showBilling])
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
                activeId={nodeId ? section : "fleet"}
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
                            ? sections.map((s, i) => ({
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
                ]}
                topbar={
                    <span className="topbar-title" title={node ? stripFlag(node.name) : siteTitle}>
                        {node ? stripFlag(node.name) : siteTitle}
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
