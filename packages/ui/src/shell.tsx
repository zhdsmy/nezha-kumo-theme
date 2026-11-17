import { Sidebar, useSidebar } from "@cloudflare/kumo/components/sidebar"
import { type LinkComponentProps, LinkProvider } from "@cloudflare/kumo/utils"
import {
    type CSSProperties,
    type ComponentType,
    type Ref,
    createContext,
    forwardRef,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

import {
    type AppShellProps,
    BREAKPOINTS,
    type NavItem,
    type NavSection,
    SHELL,
    type ShellContext,
    type ShellLinkProps,
} from "./contract"
import { getShellScroller } from "./scroller"

export const AsideLabelContext = createContext("Additional information")

const STORAGE_KEY = "nkt:sidebar-collapsed"
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]'

// CSS media queries cannot read custom properties; derive them from the contract here.
// The first rule: Kumo switches to the drawer from JS; until that render lands, the desktop sidebar
// must not squeeze the content area on a narrow viewport (seen after folding a foldable phone).
const responsiveStyles = `@media (max-width:${BREAKPOINTS.sidebar - 1}px){.nk-sidebar:not([data-mobile]){display:none}}@media (min-width:${BREAKPOINTS.gutter}px){.nk-shell{--nk-gutter:32px}.nk-action-label{display:inline}}@media (min-width:${BREAKPOINTS.aside}px){.nk-page-with-aside{grid-template-columns:minmax(0,1fr) var(--nk-aside-width)}.nk-page-with-aside>.nk-page-main{border-right:1px solid var(--color-kumo-line)}.nk-page-with-aside>.nk-page-aside{border-top:0;padding:32px}}`

function Anchor(props: ShellLinkProps) {
    return <a {...props} />
}

function DrawerMenuIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM144,184H40a8,8,0,0,0,0,16H144a8,8,0,0,0,0-16Z" />
        </svg>
    )
}

function BackArrowIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
        </svg>
    )
}

function NavEntry({
    item,
    activeId,
    close,
}: {
    item: NavItem
    activeId?: string
    close: () => void
}) {
    const childActive = item.children?.some((child) => child.id === activeId) ?? false
    const [expanded, setExpanded] = useState(childActive)
    const { isMobile, state, setOpen } = useSidebar()
    useEffect(() => {
        if (childActive) setExpanded(true)
    }, [childActive])

    const isActive = item.id === activeId
    const icon = (
        <span className="nk-nav-icon" aria-hidden="true">
            {item.icon ?? "·"}
        </span>
    )
    const badge =
        item.badge != null && item.badge !== false ? (
            <Sidebar.MenuBadge className="nk-nav-badge">{item.badge}</Sidebar.MenuBadge>
        ) : null

    return (
        <Sidebar.MenuItem title={item.label}>
            {item.children?.length ? (
                <Sidebar.Collapsible open={expanded} onOpenChange={setExpanded}>
                    <Sidebar.CollapsibleTrigger
                        render={
                            <Sidebar.MenuButton
                                className="nk-nav-link"
                                icon={icon}
                                active={isActive}
                                tooltip={isMobile ? undefined : item.label}
                                onClick={() => {
                                    if (!isMobile && state === "collapsed") setOpen(true)
                                }}
                            >
                                <span className="nk-nav-label" title={item.label}>
                                    {item.label}
                                </span>
                                {badge}
                                <Sidebar.MenuChevron />
                            </Sidebar.MenuButton>
                        }
                    />
                    <Sidebar.CollapsibleContent>
                        <Sidebar.MenuSub>
                            {item.children.map((child) => {
                                const childIsActive = child.id === activeId
                                return (
                                    <Sidebar.MenuSubItem key={child.id}>
                                        <Sidebar.MenuSubButton
                                            href={child.href}
                                            className="nk-nav-link nk-nav-child"
                                            active={childIsActive}
                                            aria-current={childIsActive ? "page" : undefined}
                                            onClick={close}
                                        >
                                            <span className="nk-nav-label" title={child.label}>
                                                {child.label}
                                            </span>
                                            {child.badge != null && child.badge !== false && (
                                                <Sidebar.MenuBadge className="nk-nav-badge">
                                                    {child.badge}
                                                </Sidebar.MenuBadge>
                                            )}
                                        </Sidebar.MenuSubButton>
                                    </Sidebar.MenuSubItem>
                                )
                            })}
                        </Sidebar.MenuSub>
                    </Sidebar.CollapsibleContent>
                </Sidebar.Collapsible>
            ) : (
                <Sidebar.MenuButton
                    href={item.href}
                    className="nk-nav-link"
                    icon={icon}
                    active={isActive}
                    aria-current={isActive ? "page" : undefined}
                    tooltip={isMobile ? undefined : item.label}
                    onClick={close}
                >
                    <span className="nk-nav-label" title={item.label}>
                        {item.label}
                    </span>
                    {badge}
                </Sidebar.MenuButton>
            )}
        </Sidebar.MenuItem>
    )
}

function NavSections({
    sections,
    activeId,
    label,
    close,
}: {
    sections: NavSection[]
    activeId?: string
    label: string
    close: () => void
}) {
    return (
        <nav aria-label={label}>
            {sections.map((section) => (
                <Sidebar.Group key={section.id}>
                    {section.title && (
                        <Sidebar.GroupLabel title={section.title}>
                            {section.title}
                        </Sidebar.GroupLabel>
                    )}
                    <Sidebar.Menu>
                        {section.items.map((item) => (
                            <NavEntry key={item.id} item={item} activeId={activeId} close={close} />
                        ))}
                    </Sidebar.Menu>
                </Sidebar.Group>
            ))}
        </nav>
    )
}

function ShellLayout({
    brand,
    sidebarTop,
    nav,
    activeId,
    context,
    topbar,
    actions,
    footer,
    labels,
    children,
    linkComponent: Link = Anchor,
}: AppShellProps) {
    const navLabel = labels?.mainNav ?? "Main navigation"
    const { isMobile, open, openMobile, setOpenMobile } = useSidebar()
    const sidebarRef = useRef<HTMLElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const lastRootRef = useRef<NavSection[] | null>(context ? null : nav)
    const lastContextRef = useRef<{ context: ShellContext; nav: NavSection[] } | null>(
        context ? { context, nav } : null,
    )
    const closeDrawer = () => setOpenMobile(false)

    const kumoLink = useMemo(
        () =>
            forwardRef<HTMLAnchorElement, LinkComponentProps>(function ShellLinkBridge(
                { href, to, ...rest },
                ref,
            ) {
                const Comp = Link as unknown as ComponentType<
                    LinkComponentProps & { ref?: Ref<HTMLAnchorElement> }
                >
                return <Comp ref={ref} href={href ?? to ?? ""} {...rest} />
            }),
        [Link],
    )

    useEffect(() => {
        if (context) lastContextRef.current = { context, nav }
        else lastRootRef.current = nav
    }, [context, nav])

    const rootNav = context ? lastRootRef.current : nav
    const contextView = context ? { context, nav } : lastContextRef.current

    useEffect(() => {
        if (!isMobile || !openMobile) return
        // Kumo handles Escape and initial focus; keep Tab within the open drawer too.
        const trapFocus = (event: KeyboardEvent) => {
            if (event.key !== "Tab") return
            const items = Array.from(
                sidebarRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
            ).filter((node) => !node.closest("[inert]") && node.getClientRects().length > 0)
            const first = items[0]
            const last = items.at(-1)
            if (
                event.shiftKey &&
                (document.activeElement === first ||
                    !sidebarRef.current?.contains(document.activeElement))
            ) {
                event.preventDefault()
                last?.focus()
            } else if (
                !event.shiftKey &&
                (document.activeElement === last ||
                    !sidebarRef.current?.contains(document.activeElement))
            ) {
                event.preventDefault()
                first?.focus()
            }
        }
        document.addEventListener("keydown", trapFocus)
        return () => {
            document.removeEventListener("keydown", trapFocus)
            requestAnimationFrame(() => {
                if (
                    window.innerWidth < BREAKPOINTS.sidebar &&
                    !document.querySelector('[role="dialog"]')
                ) {
                    triggerRef.current?.focus()
                }
            })
        }
    }, [isMobile, openMobile])

    return (
        <LinkProvider component={kumoLink}>
            <Sidebar
                ref={sidebarRef}
                className="nk-sidebar"
                aria-label={isMobile ? navLabel : undefined}
            >
                <Sidebar.Header className="nk-brand-row">
                    <div className="nk-brand">{brand}</div>
                    {isMobile && (
                        <Sidebar.Close aria-label={labels?.closeNav ?? "Close navigation"} />
                    )}
                </Sidebar.Header>
                {sidebarTop && <div className="nk-sidebar-top">{sidebarTop}</div>}
                <Sidebar.SlidingViews activeKey={context ? "context" : "root"}>
                    <Sidebar.SlidingView value="root">
                        {rootNav && (
                            <Sidebar.Content>
                                <NavSections
                                    sections={rootNav}
                                    activeId={context ? undefined : activeId}
                                    label={navLabel}
                                    close={closeDrawer}
                                />
                            </Sidebar.Content>
                        )}
                    </Sidebar.SlidingView>
                    <Sidebar.SlidingView value="context">
                        {contextView && (
                            <Sidebar.Content>
                                <div className="nk-context">
                                    <ul className="m-0 list-none p-0">
                                        <Sidebar.MenuItem title={contextView.context.backLabel}>
                                            <Sidebar.MenuButton
                                                href={contextView.context.backHref}
                                                className="nk-nav-link"
                                                icon={
                                                    <span
                                                        className="nk-nav-icon"
                                                        aria-hidden="true"
                                                    >
                                                        <BackArrowIcon />
                                                    </span>
                                                }
                                                tooltip={
                                                    isMobile
                                                        ? undefined
                                                        : contextView.context.backLabel
                                                }
                                                onClick={() => {
                                                    if (
                                                        document.activeElement instanceof
                                                            HTMLElement &&
                                                        sidebarRef.current?.contains(
                                                            document.activeElement,
                                                        )
                                                    ) {
                                                        document.activeElement.blur()
                                                    }
                                                    closeDrawer()
                                                }}
                                            >
                                                <span
                                                    className="nk-nav-label"
                                                    title={contextView.context.backLabel}
                                                >
                                                    {contextView.context.backLabel}
                                                </span>
                                            </Sidebar.MenuButton>
                                        </Sidebar.MenuItem>
                                    </ul>
                                    {contextView.context.title != null &&
                                        contextView.context.title !== "" && (
                                            <div className="nk-context-title-wrap">
                                                <div
                                                    className="nk-context-title"
                                                    title={
                                                        typeof contextView.context.title ===
                                                        "string"
                                                            ? contextView.context.title
                                                            : undefined
                                                    }
                                                >
                                                    {contextView.context.title}
                                                </div>
                                            </div>
                                        )}
                                </div>
                                <NavSections
                                    sections={contextView.nav}
                                    activeId={context ? activeId : undefined}
                                    label={navLabel}
                                    close={closeDrawer}
                                />
                            </Sidebar.Content>
                        )}
                    </Sidebar.SlidingView>
                </Sidebar.SlidingViews>
                {(!isMobile || footer) && (
                    <Sidebar.Footer className="nk-sidebar-footer">
                        {!isMobile && (
                            <Sidebar.Trigger
                                aria-label={
                                    open
                                        ? (labels?.collapseNav ?? "Collapse navigation")
                                        : (labels?.expandNav ?? "Expand navigation")
                                }
                            />
                        )}
                        {footer && <div className="nk-footer-content">{footer}</div>}
                    </Sidebar.Footer>
                )}
            </Sidebar>
            <div className="nk-shell-body" inert={isMobile && openMobile}>
                <header className="nk-topbar">
                    {isMobile && (
                        <Sidebar.Trigger
                            ref={triggerRef}
                            className="nk-drawer-trigger"
                            aria-label={labels?.openNav ?? "Open navigation"}
                            aria-expanded={openMobile}
                        >
                            <DrawerMenuIcon />
                        </Sidebar.Trigger>
                    )}
                    <div
                        className="nk-topbar-content"
                        title={typeof topbar === "string" ? topbar : undefined}
                    >
                        {topbar}
                    </div>
                    <div className="nk-topbar-actions">{actions}</div>
                </header>
                <main id="main-content" className="nk-main" tabIndex={-1}>
                    {children}
                </main>
            </div>
        </LinkProvider>
    )
}

export function AppShell(props: AppShellProps) {
    const [defaultOpen] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) !== "true"
        } catch {
            return true
        }
    })
    return (
        <AsideLabelContext value={props.labels?.aside ?? "Additional information"}>
            <Sidebar.Provider
                className="nk-shell"
                defaultOpen={defaultOpen}
                mobileBreakpoint={BREAKPOINTS.sidebar}
                collapsible="icon"
                onOpenChange={(open) => {
                    try {
                        localStorage.setItem(STORAGE_KEY, String(!open))
                    } catch {
                        /* Storage may be disabled. */
                    }
                }}
                style={
                    {
                        "--sidebar-width": `${SHELL.sidebarWidth}px`,
                        "--sidebar-width-icon": `${SHELL.sidebarRailWidth}px`,
                        "--sidebar-bg": "var(--color-kumo-canvas)",
                        "--nk-topbar-height": `${SHELL.topbarHeight}px`,
                        "--nk-aside-width": `${SHELL.asideWidth}px`,
                    } as CSSProperties
                }
            >
                <style>{responsiveStyles}</style>
                <a
                    className="nk-skip-link"
                    href="#main-content"
                    onClick={(event) => {
                        const main = getShellScroller()
                        if (main) {
                            event.preventDefault()
                            main.focus({ preventScroll: true })
                        }
                    }}
                >
                    {props.labels?.skipToContent ?? "Skip to content"}
                </a>
                <ShellLayout {...props} />
            </Sidebar.Provider>
        </AsideLabelContext>
    )
}
