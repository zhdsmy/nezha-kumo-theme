import type { NodeInfo } from "./model"

export const EXPIRY_DANGER_DAYS = 7
export const EXPIRY_WARN_DAYS = 30
export const LONG_TERM_DAYS = 3650

export type ExpiryState =
    | { kind: "longTerm"; at: number | null }
    | { kind: "expired"; at: number }
    | { kind: "expiring"; at: number; days: number; level?: "warn" | "danger" }

const localDay = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

export const calendarDays = (at: number, now = Date.now()) =>
    Math.max(0, Math.round((localDay(at) - localDay(now)) / 86_400_000))

export function resolveExpiry(node: NodeInfo, now = Date.now()): ExpiryState | null {
    if (node.expiredAt === null) return null
    if (node.expiredAt === 0) return { kind: "longTerm", at: null }
    if (!(node.expiredAt > 0)) return null
    if (node.expiredAt < now) return { kind: "expired", at: node.expiredAt }
    const days = calendarDays(node.expiredAt, now)
    if (days > LONG_TERM_DAYS) return { kind: "longTerm", at: node.expiredAt }
    const level =
        days <= EXPIRY_DANGER_DAYS ? "danger" : days <= EXPIRY_WARN_DAYS ? "warn" : undefined
    return { kind: "expiring", at: node.expiredAt, days, level }
}
