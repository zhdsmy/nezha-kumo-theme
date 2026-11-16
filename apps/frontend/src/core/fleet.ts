import { nodeCondition } from "./condition"
import { formatPercent, ratio } from "./format"
import type { NodeInfo, Snapshot } from "./model"

// Thresholds adapted from zool-theme/src/components/instruments.tsx (MIT, luoleiorg).
export function levelFor(kind: "cpu" | "memory" | "disk", percent: number) {
    const [warn, danger] = kind === "cpu" ? [50, 85] : kind === "memory" ? [70, 90] : [80, 92]
    const shown = Number(formatPercent(percent))
    return shown >= danger ? "danger" : shown >= warn ? "warn" : "good"
}

export const SORT_KEYS = [
    "default",
    "name",
    "cpu",
    "memory",
    "network",
    "traffic",
    "uptime",
    "expiry",
] as const
export type SortKey = (typeof SORT_KEYS)[number]
export function sortNodes(
    nodes: readonly NodeInfo[],
    snapshots: Record<string, Snapshot>,
    key: SortKey,
    desc: boolean,
) {
    const value = (n: NodeInfo) => {
        const s = snapshots[n.id]
        switch (key) {
            case "name":
                return n.name
            case "cpu":
                return s?.cpu ?? -1
            case "memory":
                return s ? ratio(s.memUsed, s.memTotal || n.memTotal) : -1
            case "network":
                return s?.online ? s.netUp + s.netDown : -1
            case "traffic":
                return (s?.totalUp ?? 0) + (s?.totalDown ?? 0)
            case "uptime":
                return s?.uptime ?? -1
            case "expiry":
                return n.expiredAt || Infinity
            default:
                return n.weight
        }
    }
    return [...nodes].sort((a, b) => {
        const av = value(a),
            bv = value(b)
        const diff =
            typeof av === "string" && typeof bv === "string"
                ? av.localeCompare(bv)
                : Number(av) === Number(bv)
                  ? 0
                  : Number(av) < Number(bv)
                    ? -1
                    : 1
        return (desc ? -diff : diff) || a.id.localeCompare(b.id)
    })
}
export function needsAttention(n: NodeInfo, s: Snapshot | undefined, fed: boolean) {
    const c = nodeCondition(n, s, Date.now(), fed)
    return (
        c.expired ||
        c.quotaUsed ||
        c.kind === "stale" ||
        Boolean(
            s?.online &&
            (levelFor("cpu", s.cpu) !== "good" ||
                levelFor("memory", ratio(s.memUsed, s.memTotal || n.memTotal)) !== "good" ||
                levelFor("disk", ratio(s.diskUsed, s.diskTotal || n.diskTotal)) !== "good"),
        )
    )
}
