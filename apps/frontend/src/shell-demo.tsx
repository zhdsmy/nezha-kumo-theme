import { Button } from "@cloudflare/kumo/components/button"
import { Tabs } from "@cloudflare/kumo/components/tabs"
import { AppShell, BREAKPOINTS, type NavSection, Page, type ShellLinkProps } from "@nezha-kumo/ui"
import {
    ChartLineIcon,
    ClockIcon,
    GlobeIcon,
    HardDrivesIcon,
    MagnifyingGlassIcon,
    MoonIcon,
    SignInIcon,
    TranslateIcon,
} from "@phosphor-icons/react"
import { useState } from "react"

const sectionTabs = [
    { value: "overview", label: "Overview" },
    { value: "latency", label: "Latency" },
    { value: "traffic", label: "Traffic & billing" },
    { value: "history", label: "Uptime & report history" },
]
const servers = ["Singapore Gateway", "Tokyo Compute", "Taipei Edge", "Frankfurt Relay"]

// Exercise the contract's router adapter without adding a router to this temporary demo.
function DemoLink(props: ShellLinkProps) {
    return <a {...props} />
}

export function ShellDemo() {
    const contextual = location.pathname.startsWith("/demo/server")
    const [tab, setTab] = useState("overview")
    const [dark, setDark] = useState(document.documentElement.dataset.mode === "dark")
    const [notice, setNotice] = useState("")
    const nav: NavSection[] = [
        {
            id: "monitoring",
            title: contextual ? undefined : "Monitoring",
            items: contextual
                ? [
                      {
                          id: "overview",
                          label: "Overview",
                          href: "/demo/server",
                          icon: <HardDrivesIcon />,
                      },
                      {
                          id: "latency",
                          label: "Latency",
                          href: "/demo/server#latency",
                          icon: <ChartLineIcon />,
                      },
                      {
                          id: "traffic",
                          label: "Traffic & billing",
                          href: "/demo/server#traffic",
                          icon: <GlobeIcon />,
                      },
                      {
                          id: "history",
                          label: "Uptime & report history",
                          href: "/demo/server#history",
                          icon: <ClockIcon />,
                      },
                  ]
                : [
                      {
                          id: "fleet",
                          label: "All servers",
                          href: "/demo",
                          icon: <HardDrivesIcon />,
                          badge: "20",
                      },
                      {
                          id: "regions",
                          label: "Regions",
                          href: "/demo",
                          icon: <GlobeIcon />,
                          children: [
                              { id: "asia", label: "Asia Pacific", href: "/demo/server" },
                              { id: "europe", label: "Europe", href: "/demo/server" },
                          ],
                      },
                      {
                          id: "reports",
                          label: "Reports",
                          href: "/demo/server#history",
                          icon: <ClockIcon />,
                      },
                  ],
        },
    ]

    return (
        <AppShell
            brand={
                <div className="demo-brand">
                    <HardDrivesIcon />
                    <span>Nezha</span>
                </div>
            }
            nav={nav}
            activeId={contextual ? "overview" : "fleet"}
            linkComponent={DemoLink}
            context={
                contextual
                    ? {
                          backLabel: "All servers",
                          backHref: "/demo",
                          title: <span title="Singapore Gateway">Singapore Gateway</span>,
                      }
                    : undefined
            }
            topbar={
                <span title={contextual ? "Singapore Gateway" : "Infrastructure"}>
                    {contextual ? "Singapore Gateway" : "Infrastructure"}
                </span>
            }
            actions={
                <>
                    <Button
                        variant="ghost"
                        aria-label="Search"
                        onClick={() => setNotice("Search preview")}
                    >
                        <MagnifyingGlassIcon size={16} />
                        <span className="nk-action-label">Search</span>
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Change theme"
                        onClick={() => {
                            document.documentElement.dataset.mode = dark ? "light" : "dark"
                            try {
                                localStorage.setItem(
                                    "nezha-kumo:appearance",
                                    dark ? "light" : "dark",
                                )
                            } catch {
                                /* Optional preference. */
                            }
                            setDark(!dark)
                        }}
                    >
                        <MoonIcon size={16} />
                        <span className="nk-action-label">Theme</span>
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Language"
                        onClick={() => setNotice("Language preview")}
                    >
                        <TranslateIcon size={16} />
                        <span className="nk-action-label">Language</span>
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Log in"
                        onClick={() => setNotice("Login preview")}
                    >
                        <SignInIcon size={16} />
                        <span className="nk-action-label">Log in</span>
                    </Button>
                </>
            }
            footer={<span className="demo-muted">Public status</span>}
        >
            <style>{`
      @media (min-width: ${BREAKPOINTS.gutter}px) { .demo-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (min-width: ${BREAKPOINTS.wide}px) { .demo-tiles:not(.demo-tiles-detail) { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
    `}</style>
            <Page
                title={contextual ? "Singapore Gateway" : "All servers"}
                description={
                    contextual
                        ? "Performance, traffic and availability for this server."
                        : "An overview of your infrastructure and its availability."
                }
                eyebrow={contextual ? <a href="/demo">Servers / Singapore</a> : undefined}
                actions={
                    <Button
                        variant="secondary"
                        onClick={() => {
                            location.href = contextual ? "/demo" : "/demo/server"
                        }}
                    >
                        {contextual ? "All servers" : "View server"}
                    </Button>
                }
                maxWidth={contextual ? 1100 : 1200}
                tabs={<Tabs tabs={sectionTabs} value={tab} onValueChange={setTab} />}
                aside={
                    contextual ? (
                        <div className="demo-aside">
                            <h2>System information</h2>
                            <dl>
                                <dt>Operating system</dt>
                                <dd>Debian GNU/Linux 13</dd>
                                <dt>CPU</dt>
                                <dd>AMD EPYC · 2 cores</dd>
                                <dt>Memory</dt>
                                <dd>4 GiB</dd>
                                <dt>Virtualization</dt>
                                <dd>KVM</dd>
                                <dt>Location</dt>
                                <dd>Singapore</dd>
                                <dt>Agent version</dt>
                                <dd>2.6.1</dd>
                            </dl>
                            <p className="demo-muted demo-banner">Demo data · Shell review</p>
                        </div>
                    ) : undefined
                }
            >
                <div className={`demo-tiles${contextual ? " demo-tiles-detail" : ""}`}>
                    {[
                        ["Servers online", "20 / 20"],
                        ["Bandwidth", "128 Mbps"],
                        ["Today’s traffic", "64.2 GB"],
                        ["Monthly cost", "$39.40"],
                        ["Availability", "99.99%"],
                    ].map(([label, value], index) => (
                        <div className="demo-tile" key={label}>
                            <div className="demo-tile-header">
                                <div className="demo-tile-label" title={label}>
                                    {label}
                                </div>
                                <div className="demo-tile-value">{value}</div>
                            </div>
                            <svg
                                className="demo-spark"
                                viewBox="0 0 240 56"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <path
                                    d={`M0 48 L20 43 L40 ${36 + index} L60 42 L80 20 L100 30 L120 16 L140 28 L160 15 L180 24 L200 8 L220 19 L240 11 L240 56 L0 56 Z`}
                                    fill="currentColor"
                                    opacity=".12"
                                />
                                <path
                                    d={`M0 48 L20 43 L40 ${36 + index} L60 42 L80 20 L100 30 L120 16 L140 28 L160 15 L180 24 L200 8 L220 19 L240 11`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                        </div>
                    ))}
                </div>
                <section className="demo-panel" aria-label={tab}>
                    <h2>{sectionTabs.find((item) => item.value === tab)?.label}</h2>
                    {servers.map((server, index) => (
                        <div className="demo-report" key={server}>
                            <a href="/demo/server" title={server}>
                                {server}
                            </a>
                            <span className="demo-muted">{[12, 28, 8, 16][index]} ms</span>
                            <span className="demo-status">Online</span>
                        </div>
                    ))}
                </section>
                <p className="demo-muted demo-banner" role="status">
                    {notice || "Demo data · Layout preview"}
                </p>
            </Page>
        </AppShell>
    )
}
