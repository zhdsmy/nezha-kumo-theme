import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import UserMenu from "@/components/user-menu"
import { useAuth } from "@/hooks/useAuth"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { interfaceLanguages, resolveInterfaceLanguage } from "@/lib/languages"
import { AppShell, BREAKPOINTS, NavSection, ShellLinkProps, getShellScroller } from "@nezha-kumo/ui"
import {
    Activity,
    Bell,
    Clock,
    Cloud,
    ExternalLink,
    FileKey,
    Folder,
    Globe,
    Lock,
    Monitor,
    Network,
    Server,
    Settings,
    Shield,
    User,
    Users,
    Workflow,
} from "lucide-react"
import { ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

function RouterLink({ href, ...props }: ShellLinkProps) {
    return <Link to={href} {...props} />
}

export default function AdminShell({
    siteName,
    version,
    children,
}: {
    siteName: string
    version?: string
    children: ReactNode
}) {
    const { t } = useTranslation()
    const { profile } = useAuth()
    const sidebarShown = useMediaQuery(`(min-width: ${BREAKPOINTS.sidebar}px)`)
    const { pathname } = useLocation()
    useEffect(() => {
        const scroller = getShellScroller()
        if (scroller) scroller.scrollTop = 0
    }, [pathname])
    const isAdmin = profile?.role === 0
    const nav: NavSection[] = [
        {
            id: "servers",
            title: t("Server"),
            items: [
                { id: "/dashboard", href: "/dashboard", label: t("Server"), icon: <Server /> },
                {
                    id: "/dashboard/server-group",
                    href: "/dashboard/server-group",
                    label: t("ServerGroups"),
                    icon: <Folder />,
                },
                {
                    id: "/dashboard/transfer",
                    href: "/dashboard/transfer",
                    label: t("Transfer.Title"),
                    icon: <Workflow />,
                },
            ],
        },
        {
            id: "monitoring",
            title: t("Navigation.Monitoring"),
            items: [
                {
                    id: "/dashboard/service",
                    href: "/dashboard/service",
                    label: t("Service"),
                    icon: <Activity />,
                },
                {
                    id: "/dashboard/alert-rule",
                    href: "/dashboard/alert-rule",
                    label: t("AlertRule"),
                    icon: <Bell />,
                },
            ],
        },
        {
            id: "automation",
            title: t("Navigation.Automation"),
            items: [
                {
                    id: "/dashboard/cron",
                    href: "/dashboard/cron",
                    label: t("Task"),
                    icon: <Clock />,
                },
                {
                    id: "/dashboard/ddns",
                    href: "/dashboard/ddns",
                    label: t("DDNS"),
                    icon: <Cloud />,
                },
                {
                    id: "/dashboard/nat",
                    href: "/dashboard/nat",
                    label: t("NATT"),
                    icon: <Network />,
                },
            ],
        },
        {
            id: "notifications",
            title: t("Notification"),
            items: [
                {
                    id: "/dashboard/notification",
                    href: "/dashboard/notification",
                    label: t("Notifier"),
                    icon: <Bell />,
                },
                {
                    id: "/dashboard/notification-group",
                    href: "/dashboard/notification-group",
                    label: t("NotificationGroups"),
                    icon: <Folder />,
                },
            ],
        },
        {
            id: "system",
            title: t("Navigation.System"),
            items: [
                ...(isAdmin
                    ? [
                          {
                              id: "/dashboard/settings",
                              href: "/dashboard/settings",
                              label: t("Settings"),
                              icon: <Settings />,
                          },
                          {
                              id: "/dashboard/settings/user",
                              href: "/dashboard/settings/user",
                              label: t("User"),
                              icon: <Users />,
                          },
                          {
                              id: "/dashboard/settings/online-user",
                              href: "/dashboard/settings/online-user",
                              label: t("OnlineUser"),
                              icon: <Monitor />,
                          },
                          {
                              id: "/dashboard/settings/waf",
                              href: "/dashboard/settings/waf",
                              label: t("WAF"),
                              icon: <Shield />,
                          },
                          {
                              id: "/dashboard/settings/frontends",
                              href: "/dashboard/settings/frontends",
                              label: t("FrontendManager.Tab"),
                              icon: <Globe />,
                          },
                      ]
                    : []),
                {
                    id: "/dashboard/settings/api-tokens",
                    href: "/dashboard/settings/api-tokens",
                    label: t("ApiTokens"),
                    icon: <FileKey />,
                },
                {
                    id: "/dashboard/settings/mcp-oauth",
                    href: "/dashboard/settings/mcp-oauth",
                    label: t("MCPOAuthManager.Title"),
                    icon: <Lock />,
                },
                {
                    id: "/dashboard/profile",
                    href: "/dashboard/profile",
                    label: t("Profile"),
                    icon: <User />,
                },
            ],
        },
    ]
    const activeId = pathname.startsWith("/dashboard/terminal/")
        ? "/dashboard"
        : pathname === "/dashboard/mcp/authorize"
          ? "/dashboard/settings/mcp-oauth"
          : pathname.replace(/\/$/, "")
    return (
        <AppShell
            brand={
                <Link
                    to="/dashboard"
                    title={siteName}
                    onClick={(e) => {
                        e.currentTarget
                            .closest(".nk-brand-row")
                            ?.querySelector<HTMLButtonElement>('button[data-sidebar="close"]')
                            ?.click()
                    }}
                    className="flex min-w-0 items-center gap-2 rounded-md py-1 text-inherit no-underline transition-colors hover:bg-muted dark:hover:bg-kumo-control focus-visible:bg-muted dark:focus-visible:bg-kumo-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                    <img className="size-7 shrink-0" src="/dashboard/logo.svg" alt="" />
                    <span className="truncate">{siteName}</span>
                </Link>
            }
            nav={nav}
            activeId={activeId}
            linkComponent={RouterLink}
            labels={{
                skipToContent: t("Skip to content"),
                mainNav: t("Main navigation"),
                openNav: t("Open navigation"),
                closeNav: t("Close navigation"),
                collapseNav: t("Collapse navigation"),
                expandNav: t("Expand navigation"),
                aside: t("Additional information"),
            }}
            // The sidebar brand shows the site name from BREAKPOINTS.sidebar up; the top bar
            // repeats it only while the sidebar is a drawer (same rule as the frontend).
            topbar={
                sidebarShown ? undefined : (
                    <Link
                        to="/dashboard"
                        title={siteName}
                        className="inline-flex max-w-full items-center rounded-md py-1 text-inherit no-underline transition-colors hover:bg-muted dark:hover:bg-kumo-control focus-visible:bg-muted dark:focus-visible:bg-kumo-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                        <span className="truncate">{siteName}</span>
                    </Link>
                )
            }
            actions={<AdminActions />}
            footer={
                <span className="text-xs text-muted-foreground">
                    {t("nezha")} {version}
                </span>
            }
        >
            {children}
        </AppShell>
    )
}

export function AdminActions() {
    const { t, i18n } = useTranslation()
    const language = resolveInterfaceLanguage(i18n.resolvedLanguage || i18n.language)
    return (
        <>
            <Button
                asChild
                variant="ghost"
                size="icon"
                title={t("BackToHome")}
                aria-label={t("BackToHome")}
            >
                <a href="/">
                    <ExternalLink />
                </a>
            </Button>
            <ModeToggle />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        title={`${t("Language")}: ${interfaceLanguages[language]}`}
                        aria-label={t("Language")}
                    >
                        <Globe />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[70dvh] overflow-y-auto">
                    <DropdownMenuRadioGroup
                        value={language}
                        onValueChange={(value) => void i18n.changeLanguage(value)}
                    >
                        {Object.entries(interfaceLanguages).map(([value, label]) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                                {label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <UserMenu />
        </>
    )
}
