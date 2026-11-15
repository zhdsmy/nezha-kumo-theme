// Placeholder implementation of the contract. The frontend package replaces the inside of this file.
import type { AppShellProps } from './contract'

export function AppShell({ brand, nav, context, topbar, actions, footer, children }: AppShellProps) {
  return (
    <div data-nk-shell="placeholder">
      <aside>
        {brand}
        {context && <a href={context.backHref}>{context.backLabel}</a>}
        {context?.title}
        {nav.map((s) => (
          <nav key={s.id} aria-label={s.title}>
            {s.items.map((i) => (
              <a key={i.id} href={i.href}>
                {i.label}
              </a>
            ))}
          </nav>
        ))}
        {footer}
      </aside>
      <header>
        {topbar}
        {actions}
      </header>
      <main>{children}</main>
    </div>
  )
}
