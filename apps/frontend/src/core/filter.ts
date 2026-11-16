// Adapted from zool-theme/src/core/filter.ts (MIT, luoleiorg).
import type { NodeInfo } from "./model"

/**
 * The home page filter: which groups and which region the visitor has picked.
 *
 * It lives in the query string first, so a filtered page can be shared and survives a reload,
 * and in localStorage second, so coming back to the bare address keeps the last choice.
 * Groups are repeated parameters (`?group=a&group=b`) rather than one joined value: group
 * names are free text and may contain any separator we could pick.
 */
interface Filter {
    /** Picked group names. `''` stands for nodes without a group. */
    groups: string[]
    region: string | null
}

/** Reads the filter from a query string. A key that is absent comes back as `undefined`. */
export function parseFilterQuery(search: string): { groups?: string[]; region?: string | null } {
    const q = new URLSearchParams(search)
    const out: { groups?: string[]; region?: string | null } = {}
    if (q.has("group")) out.groups = unique(q.getAll("group"))
    if (q.has("region")) out.region = q.get("region") || null
    return out
}

/** Writes the filter into a query string, keeping every unrelated parameter as it was. */
export function serializeFilterQuery(search: string, filter: Filter): string {
    const q = new URLSearchParams(search)
    q.delete("group")
    q.delete("region")
    for (const g of filter.groups) q.append("group", g)
    if (filter.region) q.set("region", filter.region)
    const s = q.toString()
    return s ? `?${s}` : ""
}

const unique = (xs: string[]) => [...new Set(xs)]

/** The group a node is filed under when nothing more specific applies. */
const groupsOf = (n: NodeInfo) => (n.groups.length ? n.groups : [""])

/** True when the node belongs to any picked group; no picked groups means every node. */
export function matchGroups(node: NodeInfo, picked: readonly string[]) {
    if (!picked.length) return true
    return groupsOf(node).some((g) => picked.includes(g))
}

/** Every group on the page with how many nodes it holds, in page order. */
export function groupCounts(nodes: readonly NodeInfo[]): [string, number][] {
    const counts = new Map<string, { count: number; weight: number }>()
    for (const n of nodes) {
        for (const g of groupsOf(n)) {
            const c = counts.get(g) ?? { count: 0, weight: Infinity }
            counts.set(g, { count: c.count + 1, weight: Math.min(c.weight, n.weight) })
        }
    }
    return [...counts.entries()]
        .sort((a, b) => a[1].weight - b[1].weight || a[0].localeCompare(b[0]))
        .map(([g, c]) => [g, c.count])
}
