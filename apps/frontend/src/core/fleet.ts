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
export type IssueReason =
    | { kind: "offline" }
    | { kind: "stale" }
    | { kind: "expired" }
    | { kind: "quota" }
    | { kind: "cpu" | "memory" | "disk"; percent: string }

export function nodeIssues(
    n: NodeInfo,
    s: Snapshot | undefined,
    fed: boolean,
    now = Date.now(),
): IssueReason[] {
    const c = nodeCondition(n, s, now, fed)
    const reasons: IssueReason[] = []
    if (fed && !s?.online) reasons.push({ kind: "offline" })
    if (s?.online) {
        if (c.kind === "stale") reasons.push({ kind: "stale" })
        const mem = ratio(s.memUsed, s.memTotal || n.memTotal)
        const disk = ratio(s.diskUsed, s.diskTotal || n.diskTotal)
        if (levelFor("cpu", s.cpu) !== "good")
            reasons.push({ kind: "cpu", percent: formatPercent(s.cpu) })
        if (levelFor("memory", mem) !== "good")
            reasons.push({ kind: "memory", percent: formatPercent(mem) })
        if (levelFor("disk", disk) !== "good")
            reasons.push({ kind: "disk", percent: formatPercent(disk) })
    }
    if (c.expired) reasons.push({ kind: "expired" })
    if (c.quotaUsed) reasons.push({ kind: "quota" })
    return reasons
}

export function needsAttention(n: NodeInfo, s: Snapshot | undefined, fed: boolean) {
    return nodeIssues(n, s, fed).some((r) => r.kind !== "offline")
}
