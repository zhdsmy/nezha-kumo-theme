import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import UserMenu from "@/components/user-menu"
import { useAuth } from "@/hooks/useAuth"
import { nezhaLang } from "@/types/settings"
import { AppShell, NavSection, ShellLinkProps } from "@nezha-kumo/ui"
import {
    Activity,
    Bell,
    Clock,
    Cloud,
    ExternalLink,
    FileKey,
    Folder,
    Globe,
    Languages,
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
import { ReactNode } from "react"
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
    const { pathname } = useLocation()
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
                    label: t("Group"),
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
                    label: t("Group"),
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
    const active = nav.flatMap((section) => section.items).find((item) => item.id === activeId)
    return (
        <AppShell
            brand={
                <div className="flex min-w-0 items-center gap-2">
                    <img className="size-7 shrink-0" src="/dashboard/logo.svg" alt="" />
                    <span className="truncate" title={siteName}>
                        {siteName}
                    </span>
                </div>
            }
            nav={nav}
            activeId={activeId}
            linkComponent={RouterLink}
            topbar={
                <span className="truncate" title={active?.label}>
                    {active?.label}
                </span>
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
                        title={t("Language")}
                        aria-label={t("Language")}
                    >
                        <Languages />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[70dvh] overflow-y-auto">
                    {Object.entries(nezhaLang).map(([value, label]) => (
                        <DropdownMenuItem
                            key={value}
                            onSelect={() => void i18n.changeLanguage(value)}
                        >
                            {label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <UserMenu />
        </>
    )
}
