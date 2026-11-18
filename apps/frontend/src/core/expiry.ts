import { cycleDays } from "../../../../packages/shared/public-note"
import type { Cycle, NodeInfo } from "./model"

export const EXPIRY_DANGER_DAYS = 7
export const EXPIRY_WARN_DAYS = 30
export const LONG_TERM_DAYS = 3650

export type ExpiryState =
    | { kind: "longTerm"; at: number | null; level?: undefined }
    | { kind: "autoRenew"; at: null; level?: undefined }
    | { kind: "renews"; at: number; days: number; level?: undefined }
    | { kind: "expired"; at: number; level: "danger" }
    | { kind: "expiring"; at: number; days: number; level?: "warn" | "danger" }

const DAY_MS = 86_400_000
const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)

export const calendarDays = (at: number, now = Date.now()) =>
    Math.max(0, Math.round((startOfDay(at) - startOfDay(now)) / DAY_MS))

/** Advance `base` by `steps` cycles from the original date without cumulative month-end drift. */
export function addCycles(
    base: number,
    { count, unit }: Cycle,
    steps: number,
    offsetMin?: number,
): number {
    if (steps <= 0) return base
    const n = steps * count
    if (unit === "Day" || unit === "Week") return base + n * (unit === "Week" ? 7 : 1) * DAY_MS
    const shift = (offsetMin ?? -new Date(base).getTimezoneOffset()) * 60_000
    const d = new Date(base + shift)
    const day = d.getUTCDate()
    d.setUTCMonth(d.getUTCMonth() + n * (unit === "Year" ? 12 : 1) + 1, 0)
    d.setUTCDate(Math.min(day, d.getUTCDate()))
    return d.getTime() - shift
}

export function resolveExpiry(node: NodeInfo, now = Date.now()): ExpiryState | null {
    const base = node.expiredAt
    if (base === 0) return { kind: "longTerm", at: null }
    if (!base || base < 0) return node.autoRenewal ? { kind: "autoRenew", at: null } : null
    if (node.autoRenewal) {
        if (!node.cycle) return { kind: "autoRenew", at: null }
    } else if (base < now) return { kind: "expired", at: base, level: "danger" }
    let at = base
    if (node.autoRenewal && at <= now) {
        let k = Math.max(1, Math.floor((now - base) / (cycleDays(node.cycle!) * 90_720_000)))
        for (at = addCycles(base, node.cycle!, k, node.tz); at <= now;)
            at = addCycles(base, node.cycle!, ++k, node.tz)
    }
    const days = calendarDays(at, now)
    return days > LONG_TERM_DAYS
        ? { kind: "longTerm", at }
        : node.autoRenewal
          ? { kind: "renews", at, days }
          : {
                kind: "expiring",
                at,
                days,
                level:
                    days <= EXPIRY_DANGER_DAYS
                        ? "danger"
                        : days <= EXPIRY_WARN_DAYS
                          ? "warn"
                          : undefined,
            }
}
