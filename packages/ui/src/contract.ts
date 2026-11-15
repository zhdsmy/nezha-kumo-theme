/**
 * INTERFACE CONTRACT — shared by apps/frontend and apps/admin.
 *
 * Owned by Claude. Executors must not change the names, the props or their
 * meaning. Adding a new optional prop needs a proposal (report BLOCKED).
 * The implementation behind these types lives in shell.tsx / page.tsx and
 * belongs to the frontend package.
 *
 * Layout source: ~/.claude/dispatch/20261116-003415-cf-dash-styles/spec.md
 * (sections 3 and 8). Widths are CSS viewport px with the sidebar expanded.
 */
import type { ComponentType, ReactNode } from 'react'

/** Measured on dash.cloudflare.com, 2026-11-16. */
export const BREAKPOINTS = {
  /** Page gutter 16 → 32 px; top-bar buttons show their text labels. */
  gutter: 768,
  /** Below: sidebar is a 260 px drawer opened from the top bar. At/above: sidebar is always shown. */
  sidebar: 880,
  /** Metric tiles 2 → 5 columns; large charts 1 → 2 columns. */
  wide: 1280,
  /** Pages with an aside get a 400 px right info panel. */
  aside: 1284,
} as const

export const SHELL = {
  topbarHeight: 58,
  sidebarWidth: 260,
  /** Manual collapse (user choice, kept in localStorage) at >= BREAKPOINTS.sidebar. */
  sidebarRailWidth: 57,
  asideWidth: 400,
} as const

export interface NavItem {
  id: string
  label: string
  href: string
  icon?: ReactNode
  /** Small marker after the label, for example a count or "New". */
  badge?: ReactNode
  /** One level of children only; shown as an expandable group. */
  children?: NavItem[]
}

export interface NavSection {
  id: string
  /** Optional group heading. */
  title?: string
  items: NavItem[]
}

/**
 * Context navigation, like a Cloudflare zone: when set, the sidebar shows a
 * "back" row and the context title above `nav`, and `nav` holds the
 * sections of that one object (a server).
 */
export interface ShellContext {
  backLabel: string
  backHref: string
  title: ReactNode
}

export interface ShellLinkProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
  'aria-current'?: 'page' | undefined
}

export interface AppShellProps {
  /** Brand row at the top of the sidebar (58 px high): mark + site name. */
  brand: ReactNode
  nav: NavSection[]
  /** id of the active NavItem (the shell highlights it and opens its group). */
  activeId?: string
  context?: ShellContext
  /** Left part of the top bar, after the drawer button (for example a title on small screens). */
  topbar?: ReactNode
  /** Right part of the top bar: search, theme, language, account. */
  actions?: ReactNode
  /** Router link. Defaults to a plain <a>. */
  linkComponent?: ComponentType<ShellLinkProps>
  /** Optional row under the nav at the bottom of the sidebar. */
  footer?: ReactNode
  children: ReactNode
}

export interface PageProps {
  title: ReactNode
  description?: ReactNode
  /** Above the title, for example breadcrumbs. */
  eyebrow?: ReactNode
  /** Buttons on the right of the title row; they wrap below the title on small screens. */
  actions?: ReactNode
  /** Secondary navigation under the title (tabs). One row; scrolls sideways when narrow. */
  tabs?: ReactNode
  /** Right info panel: 400 px column at >= BREAKPOINTS.aside, otherwise placed after the main content. */
  aside?: ReactNode
  /** Main content max width in px. Measured: 1200 lists, 1100 detail pages with aside, 1000 welcome. Default 1200. */
  maxWidth?: number
  children: ReactNode
}
