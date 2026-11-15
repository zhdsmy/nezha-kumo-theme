// Placeholder implementation of the contract. The frontend package replaces the inside of this file.
import type { PageProps } from './contract'

export function Page({ title, description, eyebrow, actions, tabs, aside, children }: PageProps) {
  return (
    <div data-nk-page="placeholder">
      {eyebrow}
      <h1>{title}</h1>
      {description}
      {actions}
      {tabs}
      <div>{children}</div>
      {aside}
    </div>
  )
}
