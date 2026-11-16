// Adapted from zool-theme/src/app/store.ts (MIT, luoleiorg).
import { nezha as adapter } from "@/adapters/nezha"
import { cleanSnapshot } from "@/core/condition"
import type { ExchangeRates } from "@/core/cost"
import type {
    ActualCost,
    ConnectionStatus,
    HistoryPoint,
    NodeInfo,
    Session,
    SiteInfo,
    Snapshot,
} from "@/core/model"
import { DEFAULT_SETTINGS, type ThemeSettings, normalizeSettings } from "@/core/settings"
import { useMemo, useSyncExternalStore } from "react"

export { adapter }

interface State {
    phase: "loading" | "ready" | "error"
    site: SiteInfo | null
    settings: ThemeSettings
    groupOrder: string[]
    groupIcons: Record<string, string>
    nodes: NodeInfo[]
    snapshots: Record<string, Snapshot>
    session: Session
    /** Null while private billing is unavailable; an empty map means all prices are inherited. */
    actualCosts: Record<string, ActualCost> | null
    exchangeRates: ExchangeRates | null
    exchangeRateError: boolean
    connection: ConnectionStatus
    /**
     * At least one live frame has arrived. Until then a node with no snapshot is waiting, not
     * offline: showing every machine as down for the second it takes the socket to answer is
     * a false alarm.
     */
    fed: boolean
    /** A forced refresh is running; cleared by its first frame. */
    refreshing: boolean
    /** Bumps whenever the live buffers change, so charts can re-read them. */
    liveVersion: number
}

let state: State = {
    phase: "loading",
    site: null,
    settings: DEFAULT_SETTINGS,
    groupOrder: [],
    groupIcons: {},
    nodes: [],
    snapshots: {},
    session: { loggedIn: false },
    actualCosts: null,
    exchangeRates: null,
    exchangeRateError: false,
    connection: "connecting",
    fed: false,
    refreshing: false,
    liveVersion: 0,
}

const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
}

export const getState = () => state

export function setExchangeRates(exchangeRates: ExchangeRates | null, exchangeRateError = false) {
    set({ exchangeRates, exchangeRateError })
}

export function useStore<T>(selector: (s: State) => T): T {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l)
            return () => listeners.delete(l)
        },
        () => selector(state),
        () => selector(state),
    )
}

/* ---------- live buffer: what the node page charts in "Live" mode ---------- */

const LIVE_CAPACITY = 450 // 15 minutes at a 2 s cadence
const live = new Map<string, HistoryPoint[]>()

export const getLive = (id: string) => live.get(id) ?? []

/** Network-only backfill for the ledger sparks; kept out of `live`, whose points are complete. */
const sparkSeeds = new Map<string, HistoryPoint[]>()

/** The live buffer led by whatever backfill predates it: what a 15-minute network spark draws. */
export function getSpark(id: string) {
    const buf = getLive(id)
    const first = buf[0]?.at ?? Infinity
    const seed = (sparkSeeds.get(id) ?? []).filter((p) => p.at < first)
    return seed.length ? [...seed, ...buf] : buf
}

function pushLive(snapshots: Record<string, Snapshot>) {
    let changed = false
    const receivedAt = Date.now()
    for (const [id, s] of Object.entries(snapshots)) {
        if (!s.online) continue
        const buf = live.get(id) ?? []
        // Stamp with our own clock: the instruments plot against Date.now(), and a server whose
        // clock is a minute off would otherwise leave a permanent hole at one end of the window.
        const at = receivedAt
        // Same report arriving twice (a retry, a reconnect) must not become two points.
        if (buf.length && (buf[buf.length - 1].at >= at || buf[buf.length - 1].reportedAt === s.at))
            continue
        buf.push({
            at,
            reportedAt: s.at,
            cpu: s.cpu,
            memUsed: s.memUsed,
            swapUsed: s.swapUsed,
            diskUsed: s.diskUsed,
            netUp: s.netUp,
            netDown: s.netDown,
            totalUp: s.totalUp,
            totalDown: s.totalDown,
            load1: s.load1,
            tcp: s.tcp,
            udp: s.udp,
            process: s.process,
        })
        if (buf.length > LIVE_CAPACITY) buf.splice(0, buf.length - LIVE_CAPACITY)
        live.set(id, buf)
        changed = true
    }
    return changed
}

/* ---------- lifecycle ---------- */

const sameNodes = (a: NodeInfo[], b: NodeInfo[]) =>
    a.length === b.length &&
    a.every((n, i) => {
        const next = b[i]
        return (
            Object.keys(n).length === Object.keys(next).length &&
            (Object.keys(n) as (keyof NodeInfo)[]).every((key) => {
                const value = n[key],
                    other = next[key]
                return Array.isArray(value) && Array.isArray(other)
                    ? value.length === other.length && value.every((v, j) => v === other[j])
                    : value === other
            })
        )
    })

let unsubscribe: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined

const load = async () => {
    const session = await adapter.loadSession()
    const [site, nodes, groupOrder] = await Promise.all([
        adapter.loadSite(session.loggedIn),
        adapter.loadNodes(),
        adapter.loadGroupOrder(),
    ])
    const actualCosts = session.loggedIn ? await adapter.loadActualCosts().catch(() => null) : null
    set({
        site,
        nodes,
        groupOrder,
        session,
        actualCosts,
        groupIcons: site.groupIcons ?? {},
        settings: normalizeSettings(site.settings),
        phase: "ready",
    })
}

function connect() {
    unsubscribe?.()
    unsubscribe = adapter.subscribe(
        (event) => {
            // Frames carry the whole fleet. A node that was reporting and is now missing from one has
            // gone offline: keep its last readings and report time, and say so.
            const snapshots: Record<string, Snapshot> = {}
            for (const [id, prev] of Object.entries(state.snapshots))
                if (!event.snapshots[id])
                    snapshots[id] = prev.online ? { ...prev, online: false } : prev
            for (const [id, incoming] of Object.entries(event.snapshots)) {
                const next = cleanSnapshot(incoming),
                    prev = state.snapshots[id]
                snapshots[id] =
                    prev &&
                    (Object.keys(next) as (keyof Snapshot)[]).every((k) => next[k] === prev[k])
                        ? prev
                        : next
            }
            const stable =
                Object.keys(snapshots).length === Object.keys(state.snapshots).length &&
                Object.keys(snapshots).every((id) => snapshots[id] === state.snapshots[id])
            const patch: Partial<State> = {
                snapshots: stable ? state.snapshots : snapshots,
                fed: true,
                refreshing: false,
            }
            if (event.nodes && !sameNodes(event.nodes, state.nodes)) patch.nodes = event.nodes
            if (pushLive(snapshots)) patch.liveVersion = state.liveVersion + 1
            clearTimeout(refreshTimer)
            set(patch)
        },
        (connection) => set({ connection }),
    )
}

/**
 * Backfill the ledger sparks from server history so they are full on arrival instead of
 * drawing a sliver at the right edge for the first minutes.
 */
export async function seedLive(nodes: readonly NodeInfo[]) {
    if (!state.site?.recordHours) return
    const queue = nodes.map((n) => n.id)
    const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
            const seed = await adapter.loadHistory(id, 0.25, "spark").catch(() => [])
            if (!seed.length) continue
            sparkSeeds.set(id, seed)
            set({ liveVersion: state.liveVersion + 1 })
        }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
}

/** Fill the 15 minutes before the page opened with complete history points, for the node page. */
export async function backfillLive(id: string) {
    if (!state.site?.recordHours) return
    const points = await adapter.loadHistory(id, 1).catch(() => [])
    const buf = getLive(id)
    const first = buf[0]?.at ?? Infinity
    const older = points.filter((p) => p.at < first && p.at >= Date.now() - 15 * 60_000)
    if (!older.length) return
    live.set(id, [...older, ...buf].slice(-LIVE_CAPACITY))
    set({ liveVersion: state.liveVersion + 1 })
}

export async function start() {
    set({ phase: "loading" })
    try {
        await load()
    } catch (err) {
        console.error("[nezha-kumo] failed to load", err)
        set({ phase: "error" })
        return
    }
    connect()
}

/**
 * Reload the node list and reopen the live connection without leaving the page, so scroll
 * position, filters and the snapshots already on screen stay put. Ends with the first new frame,
 * or after ten seconds, whichever comes first; a failed load keeps what is shown.
 */
export async function refresh() {
    if (state.refreshing || state.phase !== "ready") return
    set({ refreshing: true, actualCosts: null })
    refreshTimer = setTimeout(() => set({ refreshing: false }), 10_000)
    unsubscribe?.()
    unsubscribe = null
    adapter.reset()
    await load().catch((err) => console.error("[nezha-kumo] refresh failed", err))
    connect()
}

/** Nodes after the "hidden nodes" setting; memoised so selectors stay stable. */
export function useVisibleNodes() {
    const nodes = useStore((s) => s.nodes)
    const hiddenNodes = useStore((s) => s.settings.hiddenNodes)
    return useMemo(() => {
        const hidden = new Set(hiddenNodes)
        return hidden.size ? nodes.filter((n) => !hidden.has(n.id)) : nodes
    }, [nodes, hiddenNodes])
}
