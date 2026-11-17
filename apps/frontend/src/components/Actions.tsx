import { setAppearance, useAppearance } from "@/app/prefs"
import { adapter, useStore } from "@/app/store"
import type { Appearance } from "@/core/settings"
import { LOCALES, type Locale, setLocale } from "@/i18n"
import { Button, DropdownMenu, LinkButton, Loader, Tooltip } from "@cloudflare/kumo"
import { useSidebar } from "@cloudflare/kumo/components/sidebar"
import { LinkProvider } from "@cloudflare/kumo/utils"
import {
    GlobeIcon,
    MagnifyingGlassIcon,
    MonitorIcon,
    MoonIcon,
    SunIcon,
    UserIcon,
} from "@phosphor-icons/react"
import {
    type ComponentType,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

import type { LoginDialogProps } from "./LoginDialog"
import type { SearchPaletteProps } from "./SearchPalette"

let cachedPalette: ComponentType<SearchPaletteProps> | null = null
let palettePromise: Promise<ComponentType<SearchPaletteProps>> | null = null

function loadSearchPalette() {
    palettePromise ??= import("./SearchPalette")
        .then((m) => {
            cachedPalette = m.SearchPalette
            return m.SearchPalette
        })
        .catch((err) => {
            palettePromise = null
            throw err
        })
    return palettePromise
}

let cachedLogin: ComponentType<LoginDialogProps> | null = null
let loginPromise: Promise<ComponentType<LoginDialogProps>> | null = null

function loadLoginDialog() {
    loginPromise ??= import("./LoginDialog")
        .then((m) => {
            cachedLogin = m.LoginDialog
            return m.LoginDialog
        })
        .catch((err) => {
            loginPromise = null
            throw err
        })
    return loginPromise
}

let searchOpenState = false
const searchListeners = new Set<() => void>()

function setSearchDialogOpen(next?: boolean) {
    const value = next ?? !searchOpenState
    if (value === searchOpenState) return
    searchOpenState = value
    for (const fn of searchListeners) fn()
}

function subscribeSearch(fn: () => void) {
    searchListeners.add(fn)
    return () => {
        searchListeners.delete(fn)
    }
}

export function SidebarSearch() {
    const { t } = useTranslation()
    const { isMobile, state, setOpenMobile } = useSidebar()
    const label = t("toolbar.search")
    const button = (
        <button
            type="button"
            className="sidebar-search"
            aria-label={label}
            onClick={() => {
                if (isMobile) setOpenMobile(false)
                setSearchDialogOpen(true)
            }}
        >
            <MagnifyingGlassIcon size={16} aria-hidden="true" />
            <span className="sidebar-search-body">
                <span className="sidebar-search-text">{label}…</span>
                <kbd className="sidebar-search-kbd">⌘K</kbd>
            </span>
        </button>
    )
    if (isMobile) return button
    return (
        <Tooltip
            content={`${label} (⌘K)`}
            side="right"
            disabled={state !== "collapsed"}
            render={button}
        />
    )
}

export function Actions() {
    const { t, i18n } = useTranslation()
    const appearance = useAppearance()
    const search = useSyncExternalStore(subscribeSearch, () => searchOpenState)
    const loadingRef = useRef<HTMLDivElement>(null)
    const [login, setLogin] = useState(false)
    const [Palette, setPalette] = useState<ComponentType<SearchPaletteProps> | null>(
        () => cachedPalette,
    )
    const [LoginModal, setLoginModal] = useState<ComponentType<LoginDialogProps> | null>(
        () => cachedLogin,
    )
    const session = useStore((s) => s.session)
    const hidden = useStore((s) => s.settings.hideAdminEntry)
    const toggleSearch = useCallback((open?: boolean) => {
        setSearchDialogOpen(open)
    }, [])
    useEffect(() => () => setSearchDialogOpen(false), [])
    useEffect(() => {
        if (!search || Palette) return
        const previous = document.activeElement as HTMLElement | null
        const root = document.getElementById("root")
        const wasInert = root?.inert ?? false
        if (root) root.inert = true
        loadingRef.current?.focus()
        let cancelled = false
        void loadSearchPalette()
            .then((Comp) => {
                if (!cancelled) setPalette(() => Comp)
            })
            .catch(() => {
                if (!cancelled) setSearchDialogOpen(false)
            })
        return () => {
            cancelled = true
            if (root) root.inert = wasInert
            // Module completion hands focus to the palette without closing search.
            if (!searchOpenState) previous?.focus()
        }
    }, [search, Palette])
    useEffect(() => {
        if (!login || LoginModal) return
        let cancelled = false
        void loadLoginDialog()
            .then((Comp) => {
                if (!cancelled) setLoginModal(() => Comp)
            })
            .catch(() => {
                if (!cancelled) setLogin(false)
            })
        return () => {
            cancelled = true
        }
    }, [login, LoginModal])
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (search && !Palette && (e.key === "Escape" || e.key === "Tab")) {
                e.preventDefault()
                if (e.key === "Escape") toggleSearch(false)
                return
            }
            if (login) return
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()
                toggleSearch()
            }
        }
        window.addEventListener("keydown", key)
        return () => window.removeEventListener("keydown", key)
    }, [login, search, Palette, toggleSearch])
    return (
        <>
            <DropdownMenu>
                <DropdownMenu.Trigger>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("prefs.appearance")}
                        title={t("prefs.appearance")}
                    >
                        {appearance === "system" ? (
                            <MonitorIcon size={16} />
                        ) : appearance === "dark" ? (
                            <MoonIcon size={16} />
                        ) : (
                            <SunIcon size={16} />
                        )}
                        <span className="action-label">{t(`prefs.${appearance}`)}</span>
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" className="min-w-36">
                    <DropdownMenu.RadioGroup
                        value={appearance}
                        onValueChange={(v: string) => setAppearance(v as Appearance)}
                    >
                        {(["light", "dark", "system"] as const).map((a) => (
                            <DropdownMenu.RadioItem key={a} value={a} closeOnClick>
                                {t(`prefs.${a}`)}
                                <DropdownMenu.RadioItemIndicator />
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
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
                <DropdownMenu.Content align="end" className="min-w-40">
                    <DropdownMenu.RadioGroup
                        value={
                            LOCALES.find((l) => l.code === i18n.language)?.code ??
                            LOCALES.find((l) => i18n.language.startsWith(l.code))?.code ??
                            "en"
                        }
                        onValueChange={(v: string) => void setLocale(v as Locale).catch(() => {})}
                    >
                        {LOCALES.map((l) => (
                            <DropdownMenu.RadioItem
                                key={l.code}
                                value={l.code}
                                lang={l.code}
                                closeOnClick
                            >
                                {l.label}
                                <DropdownMenu.RadioItemIndicator />
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
            </DropdownMenu>
            {!hidden &&
                (session.loggedIn ? (
                    <LinkProvider>
                        <LinkButton
                            href={adapter.adminUrl}
                            variant="secondary"
                            size="sm"
                            aria-label={t("auth.dashboard")}
                            title={t("auth.dashboard")}
                        >
                            <UserIcon size={16} />
                            <span className="action-label">{t("auth.dashboard")}</span>
                        </LinkButton>
                    </LinkProvider>
                ) : (
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label={t("auth.signIn")}
                        onPointerEnter={() => void loadLoginDialog().catch(() => {})}
                        onFocus={() => void loadLoginDialog().catch(() => {})}
                        onClick={() => setLogin(true)}
                    >
                        <UserIcon size={16} />
                        <span className="action-label">{t("auth.signIn")}</span>
                    </Button>
                ))}
            {LoginModal && <LoginModal open={login} onOpenChange={setLogin} />}
            {Palette ? (
                <Palette open={search} onOpenChange={toggleSearch} />
            ) : search ? (
                createPortal(
                    <div
                        className="fixed inset-0 z-50 flex items-start justify-center bg-kumo-overlay/80 px-4 pt-[15vh]"
                        onMouseDown={() => toggleSearch(false)}
                    >
                        <div
                            ref={loadingRef}
                            tabIndex={-1}
                            role="dialog"
                            aria-modal="true"
                            aria-label={t("toolbar.search")}
                            className="w-full max-w-xl rounded-xl bg-kumo-base p-6 ring ring-kumo-line"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-center py-8" role="status">
                                <Loader size="base" aria-label={t("toolbar.search")} />
                            </div>
                        </div>
                    </div>,
                    document.body,
                )
            ) : null}
        </>
    )
}
