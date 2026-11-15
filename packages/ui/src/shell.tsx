import { Sidebar, useSidebar } from "@cloudflare/kumo/components/sidebar"
import { type CSSProperties, type ComponentType, useEffect, useRef, useState } from "react"

import {
    type AppShellProps,
    BREAKPOINTS,
    type NavItem,
    SHELL,
    type ShellLinkProps,
} from "./contract"

const STORAGE_KEY = "nezha-kumo:sidebar-collapsed"
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]'

// CSS media queries cannot read custom properties; derive them from the contract here.
const responsiveStyles = `
  @media (min-width: ${BREAKPOINTS.gutter}px) {
    .nk-shell { --nk-gutter: 32px; }
    .nk-action-label { display: inline; }
  }
  @media (min-width: ${BREAKPOINTS.aside}px) {
    .nk-page-with-aside {
      grid-template-columns: minmax(0, 1fr) var(--nk-aside-width);
    }
    .nk-page-with-aside > .nk-page-main { border-right: 1px solid var(--color-kumo-line); }
    .nk-page-with-aside > .nk-page-aside {
      border-top: 0;
      padding: 32px;
    }
  }
`

function Anchor(props: ShellLinkProps) {
    return <a {...props} />
}

function NavEntry({
    item,
    activeId,
    Link,
    close,
}: {
    item: NavItem
    activeId?: string
    Link: ComponentType<ShellLinkProps>
    close: () => void
}) {
    const childActive = item.children?.some((child) => child.id === activeId) ?? false
    const [expanded, setExpanded] = useState(childActive)
    const { isMobile, state, setOpen } = useSidebar()
    useEffect(() => {
        if (childActive) setExpanded(true)
    }, [childActive])

    const content = (
        <>
            <span className="nk-nav-icon" aria-hidden="true">
                {item.icon ?? "·"}
            </span>
            <span className="nk-nav-label" title={item.label}>
                {item.label}
            </span>
            {item.badge && <span className="nk-nav-badge">{item.badge}</span>}
        </>
    )

    return (
        <Sidebar.MenuItem title={item.label}>
            {item.children?.length ? (
                <Sidebar.Collapsible open={expanded} onOpenChange={setExpanded}>
                    <Sidebar.CollapsibleTrigger
                        render={
                            <button
                                type="button"
                                className="nk-nav-link"
                                title={item.label}
                                aria-label={item.label}
                                data-active={item.id === activeId || undefined}
                                onClick={() => {
                                    if (!isMobile && state === "collapsed") setOpen(true)
                                }}
                            >
                                {content}
                                <Sidebar.MenuChevron />
                            </button>
                        }
                    />
                    <Sidebar.CollapsibleContent>
                        <Sidebar.MenuSub>
                            {item.children.map((child) => (
                                <Sidebar.MenuSubItem key={child.id}>
                                    <Link
                                        href={child.href}
                                        className="nk-nav-link nk-nav-child"
                                        onClick={close}
                                        aria-current={child.id === activeId ? "page" : undefined}
                                    >
                                        <span className="nk-nav-label" title={child.label}>
                                            {child.label}
                                        </span>
                                        {child.badge && (
                                            <span className="nk-nav-badge">{child.badge}</span>
                                        )}
                                    </Link>
                                </Sidebar.MenuSubItem>
                            ))}
                        </Sidebar.MenuSub>
                    </Sidebar.CollapsibleContent>
                </Sidebar.Collapsible>
            ) : (
                <Link
                    href={item.href}
                    className="nk-nav-link"
                    onClick={close}
                    aria-current={item.id === activeId ? "page" : undefined}
                >
                    {content}
                </Link>
            )}
        </Sidebar.MenuItem>
    )
}

function ShellLayout({
    brand,
    nav,
    activeId,
    context,
    topbar,
    actions,
    footer,
    children,
    linkComponent: Link = Anchor,
}: AppShellProps) {
    const { isMobile, open, openMobile, setOpenMobile } = useSidebar()
    const sidebarRef = useRef<HTMLElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const closeDrawer = () => setOpenMobile(false)

    useEffect(() => {
        if (!isMobile || !openMobile) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
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
            document.body.style.overflow = previousOverflow
            document.removeEventListener("keydown", trapFocus)
            requestAnimationFrame(() => {
                if (window.innerWidth < BREAKPOINTS.sidebar) triggerRef.current?.focus()
            })
        }
    }, [isMobile, openMobile])

    return (
        <>
            <Sidebar ref={sidebarRef} className="nk-sidebar" contentClassName="nk-sidebar-inner">
                <Sidebar.Header className="nk-brand-row">
                    <div className="nk-brand">{brand}</div>
                    {isMobile && <Sidebar.Close aria-label="Close navigation" />}
                </Sidebar.Header>
                <Sidebar.Content>
                    {context && (
                        <div className="nk-context">
                            <Link
                                href={context.backHref}
                                className="nk-nav-link"
                                onClick={closeDrawer}
                            >
                                <span className="nk-nav-icon" aria-hidden="true">
                                    ←
                                </span>
                                <span className="nk-nav-label" title={context.backLabel}>
                                    {context.backLabel}
                                </span>
                            </Link>
                            <div
                                className="nk-context-title"
                                title={
                                    typeof context.title === "string" ? context.title : undefined
                                }
                            >
                                {context.title}
                            </div>
                        </div>
                    )}
                    <nav aria-label="Main navigation">
                        {nav.map((section) => (
                            <Sidebar.Group key={section.id}>
                                {section.title && (
                                    <Sidebar.GroupLabel title={section.title}>
                                        {section.title}
                                    </Sidebar.GroupLabel>
                                )}
                                <Sidebar.Menu>
                                    {section.items.map((item) => (
                                        <NavEntry
                                            key={item.id}
                                            item={item}
                                            activeId={activeId}
                                            Link={Link}
                                            close={closeDrawer}
                                        />
                                    ))}
                                </Sidebar.Menu>
                            </Sidebar.Group>
                        ))}
                    </nav>
                </Sidebar.Content>
                <Sidebar.Footer className="nk-sidebar-footer">
                    {footer && <div className="nk-footer-content">{footer}</div>}
                    {!isMobile && (
                        <Sidebar.Trigger
                            aria-label={open ? "Collapse navigation" : "Expand navigation"}
                        />
                    )}
                </Sidebar.Footer>
            </Sidebar>
            <div className="nk-shell-body" inert={isMobile && openMobile}>
                <header className="nk-topbar">
                    {isMobile && (
                        <Sidebar.Trigger
                            ref={triggerRef}
                            className="nk-drawer-trigger"
                            aria-label="Open navigation"
                            aria-expanded={openMobile}
                        />
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
        </>
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
            <a className="nk-skip-link" href="#main-content">
                Skip to content
            </a>
            <ShellLayout {...props} />
        </Sidebar.Provider>
    )
}
