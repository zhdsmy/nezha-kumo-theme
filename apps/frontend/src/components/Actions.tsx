import { setAppearance, useAppearance } from "@/app/prefs"
import { Link } from "@/app/router"
import { adapter, refresh, useStore, useVisibleNodes } from "@/app/store"
import { stripFlag } from "@/core/region"
import { LOCALES, type Locale, setLocale } from "@/i18n"
import { Button, Dialog, DropdownMenu, Input, Loader } from "@cloudflare/kumo"
import {
    GlobeIcon,
    MagnifyingGlassIcon,
    MoonIcon,
    SunIcon,
    UserIcon,
    XIcon,
} from "@phosphor-icons/react"
import { type FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Status } from "./ui"

// Login behavior adapted from zool-theme/src/components/LoginDialog.tsx (MIT, luoleiorg).
function LoginForm({ close }: { close: () => void }) {
    const { t } = useTranslation()
    const site = useStore((s) => s.site)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState("")
    const submit = async (e: FormEvent) => {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        setMessage("")
        const result = await adapter.login(username.trim(), password)
        if (result.ok) {
            await refresh()
            close()
        } else setMessage(t(`auth.${result.reason}`))
        setBusy(false)
    }
    const oauth = async (provider: string) => {
        if (busy || !site) return
        setBusy(true)
        setMessage("")
        try {
            const url = await adapter.oauthUrl(site, provider)
            if (!url) throw new Error("Unavailable")
            window.location.assign(url)
        } catch {
            setMessage(t("auth.network"))
        } finally {
            setBusy(false)
        }
    }
    return (
        <>
            <Dialog.Title className="dialog-title">{t("auth.title")}</Dialog.Title>
            <Dialog.Description className="muted mb-6">
                {t("auth.subtitle", { site: site?.name })}
            </Dialog.Description>
            <form onSubmit={submit} className="login-form">
                <Input
                    label={t("auth.username")}
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                    label={t("auth.password")}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? (
                        <Loader size="sm" aria-label={t("auth.submitting")} />
                    ) : (
                        t("auth.submit")
                    )}
                </Button>
            </form>
            {site?.oauth && (
                <div className="oauth-actions">
                    {site.oauthProviders?.map((p) => (
                        <Button key={p} disabled={busy} onClick={() => void oauth(p)}>
                            {t("auth.oauth", { provider: p })}
                        </Button>
                    ))}
                </div>
            )}
            {message && (
                <p role="alert" className="text-kumo-danger mt-4">
                    {message}
                </p>
            )}
            <p className="muted mt-5 text-xs">{t("auth.wafHint")}</p>
        </>
    )
}

export function Actions() {
    const { t, i18n } = useTranslation()
    const appearance = useAppearance()
    const [search, setSearch] = useState(false)
    const [login, setLogin] = useState(false)
    const [query, setQuery] = useState("")
    const nodes = useVisibleNodes()
    const snapshots = useStore((s) => s.snapshots)
    const session = useStore((s) => s.session)
    const hidden = useStore((s) => s.settings.hideAdminEntry)
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()
                setSearch((v) => !v)
            }
        }
        window.addEventListener("keydown", key)
        return () => window.removeEventListener("keydown", key)
    }, [])
    const matches = nodes.filter((n) =>
        `${n.name} ${n.region} ${n.groups.join(" ")}`.toLowerCase().includes(query.toLowerCase()),
    )
    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                aria-label={t("toolbar.search")}
                title={`${t("toolbar.search")} (⌘K / Ctrl+K)`}
                onClick={() => setSearch(true)}
            >
                <MagnifyingGlassIcon size={16} />
                <span className="action-label">{t("toolbar.search")}</span>
            </Button>
            <DropdownMenu>
                <DropdownMenu.Trigger>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("prefs.appearance")}
                        title={t("prefs.appearance")}
                    >
                        {appearance === "dark" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
                        <span className="action-label">{t(`prefs.${appearance}`)}</span>
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                    {(["light", "dark", "system"] as const).map((a) => (
                        <DropdownMenu.Item
                            key={a}
                            onClick={() => setAppearance(a)}
                            aria-current={a === appearance ? "true" : undefined}
                        >
                            {t(`prefs.${a}`)}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenu.Trigger>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("prefs.language")}
                        title={t("prefs.language")}
                    >
                        <GlobeIcon size={16} />
                        <span className="action-label">
                            {LOCALES.find((l) => l.code === i18n.language)?.label}
                        </span>
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                    {LOCALES.map((l) => (
                        <DropdownMenu.Item
                            key={l.code}
                            onClick={() => void setLocale(l.code as Locale)}
                            lang={l.code}
                        >
                            {l.label}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu>
            {!hidden &&
                (session.loggedIn ? (
                    <a href={adapter.adminUrl} className="account-link" title={t("auth.dashboard")}>
                        <UserIcon size={16} />
                        <span className="action-label">{t("auth.dashboard")}</span>
                    </a>
                ) : (
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label={t("auth.signIn")}
                        onClick={() => setLogin(true)}
                    >
                        <UserIcon size={16} />
                        <span className="action-label">{t("auth.signIn")}</span>
                    </Button>
                ))}
            <Dialog.Root open={login} onOpenChange={setLogin}>
                <Dialog className="p-6">
                    <Button
                        className="dialog-close"
                        size="sm"
                        variant="ghost"
                        shape="square"
                        aria-label={t("auth.close")}
                        onClick={() => setLogin(false)}
                    >
                        <XIcon size={16} />
                    </Button>
                    {login && <LoginForm close={() => setLogin(false)} />}
                </Dialog>
            </Dialog.Root>
            <Dialog.Root open={search} onOpenChange={setSearch}>
                <Dialog size="lg" className="p-5">
                    <Dialog.Title className="dialog-title">{t("toolbar.search")}</Dialog.Title>
                    <Dialog.Description className="muted mb-4">
                        {t("toolbar.searchHint")}
                    </Dialog.Description>
                    <Input
                        className="w-full"
                        aria-label={t("toolbar.search")}
                        placeholder={t("toolbar.searchPlaceholder")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                document.querySelector<HTMLAnchorElement>(".search-result")?.click()
                            }
                        }}
                    />
                    <div className="search-results">
                        {matches.length ? (
                            matches.map((n) => (
                                <Link
                                    className="search-result"
                                    key={n.id}
                                    href={adapter.nodePath(n.id)}
                                    onClick={() => setSearch(false)}
                                >
                                    <span className="truncate" title={n.name}>
                                        {stripFlag(n.name)}
                                    </span>
                                    <Status snapshot={snapshots[n.id]} />
                                </Link>
                            ))
                        ) : (
                            <p className="muted p-4">{t("toolbar.noResults")}</p>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSearch(false)}>
                        {t("auth.close")}
                    </Button>
                </Dialog>
            </Dialog.Root>
        </>
    )
}
