// Adapted from zool-theme/src/core/filter.ts (MIT, luoleiorg).
import type { NodeInfo } from "./model"

/**
 * The home page filter: which groups and which region the visitor has picked.
 *
 * It lives in the query string, so a filtered page can be shared and survives a reload.
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

function groupOrderKey(groupOrder: readonly string[]) {
    const rank = new Map<string, number>()
    groupOrder.forEach((g, i) => {
        if (!rank.has(g)) rank.set(g, i)
    })
    return (g: string) => (g === "" ? groupOrder.length + 1 : (rank.get(g) ?? groupOrder.length))
}

/** Every group on the page with how many nodes it holds, ordered by `groupOrder` then name. */
export function groupCounts(
    nodes: readonly NodeInfo[],
    groupOrder: readonly string[] = [],
): [string, number][] {
    const counts = new Map<string, number>()
    for (const n of nodes) {
        for (const g of groupsOf(n)) counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    const orderOf = groupOrderKey(groupOrder)
    return [...counts.entries()].sort(
        (a, b) => orderOf(a[0]) - orderOf(b[0]) || a[0].localeCompare(b[0]),
    )
}

/**
 * Picks which group's peer nodes to list in the node page sidebar, or `null` for all visible nodes:
 * 1. If `lastListHref` carries a group filter and `node` belongs to it, use that group.
 * 2. Otherwise use `node`'s first group ordered by `groupOrder` (server-group ID order).
 * 3. If `node` has no groups or `showGroups` is false, return `null` (all visible nodes).
 */
export function resolvePeerGroup(
    node: NodeInfo | undefined,
    lastListHref: string,
    groupOrder: readonly string[] = [],
    showGroups = true,
): string | null {
    if (!showGroups || !node || !node.groups.length) return null
    const qIdx = lastListHref.indexOf("?")
    if (qIdx >= 0) {
        const picked = parseFilterQuery(lastListHref.slice(qIdx)).groups ?? []
        const matched = picked.find((g) => g !== "" && node.groups.includes(g))
        if (matched) return matched
    }
    const orderOf = groupOrderKey(groupOrder)
    return [...node.groups].sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b))[0]
}

/** Every non-empty region code in `nodes` with its count, ordered by count desc then code asc. */
export function regionCounts(nodes: readonly NodeInfo[]): [string, number][] {
    const counts = new Map<string, number>()
    for (const n of nodes) {
        if (n.region) counts.set(n.region, (counts.get(n.region) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** Keeps a picked region only when regions are enabled, offer a choice (>= 2), and include it. */
export function resolveRegion(
    region: string | null | undefined,
    regions: readonly (readonly [string, number])[],
    showRegions = true,
): string | null {
    if (!showRegions || regions.length < 2 || !region) return null
    return regions.some(([code]) => code === region) ? region : null
}
