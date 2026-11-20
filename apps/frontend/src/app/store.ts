// Adapted from zool-theme/src/app/store.ts (MIT, luoleiorg).
import { nezha as adapter } from "@/adapters/nezha"
import { cleanSnapshot } from "@/core/condition"
import type { ExchangeRates } from "@/core/cost"
import { resolveExpiry } from "@/core/expiry"
import { isCanceledError } from "@/core/http"
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
import { readStorage, writeStorage } from "@/core/storage"
import { mergeHistoryTail } from "@/core/summary"
import { useMemo, useSyncExternalStore } from "react"

export { adapter }

const SITE_TITLE_KEY = "nkt:site-title"

export const nodeHref = (id: string, u: Pick<URL | Location, "pathname" | "hash">) =>
    `${adapter.nodePath(id)}${adapter.matchNodePath(u.pathname) ? u.hash : ""}`

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
    /** True once the live WebSocket has opened or delivered a frame at least once in this session. */
    everConnected: boolean
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
    everConnected: false,
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

export type LiveConnectionState = "live" | "reconnecting" | "connecting"

export const selectConnectionState = (
    s: Pick<State, "connection" | "everConnected">,
): LiveConnectionState =>
    s.connection === "open" ? "live" : s.everConnected ? "reconnecting" : "connecting"

export const useConnectionState = () => useStore(selectConnectionState)

/* ---------- live buffer: what the node page charts in "Live" mode ---------- */

const LIVE_WINDOW_MS = 15 * 60_000
const LIVE_CAPACITY = 450 // 15 minutes at a 2 s cadence
const live = new Map<string, HistoryPoint[]>()

export const getLive = (id: string) => live.get(id) ?? []

// Keep each reset's endpoints for the day after the chart buffer has expired.
const traffic = new Map<string, HistoryPoint[]>()
export const getTraffic = (id: string) => [...(traffic.get(id) ?? []), ...getLive(id)]

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
        const point: HistoryPoint = {
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
        }
        const previousCounters = traffic.get(id) ?? []
        const counters = mergeHistoryTail(
            previousCounters,
            [point],
            new Date(receivedAt).setHours(0, 0, 0, 0),
        )
        if (counters.length > previousCounters.length) changed = true
        traffic.set(
            id,
            counters.filter((p, i) => {
                const before = counters[i - 1],
                    after = counters[i + 1]
                return (
                    !before ||
                    !after ||
                    !(["totalUp", "totalDown"] as const).every(
                        (key) => before[key]! <= p[key]! && p[key]! <= after[key]!,
                    )
                )
            }),
        )
        // Same report arriving twice (a retry, a reconnect) must not become two chart points.
        if (buf.length && (buf[buf.length - 1].at >= at || buf[buf.length - 1].reportedAt === s.at))
            continue
        buf.push(point)
        if (buf.length > LIVE_CAPACITY) buf.splice(0, buf.length - LIVE_CAPACITY)
        // history fill is 30 s apart, so the count cap alone would let the window grow past 15 minutes
        const stale = buf.findIndex((p) => p.at >= at - LIVE_WINDOW_MS)
        if (stale > 0) buf.splice(0, stale)
        live.set(id, buf)
        changed = true
    }
    return changed
}

/* ---------- lifecycle ---------- */

let lastSig = ""
export function syncExpiryClock(now = Date.now(), incoming = state.nodes) {
    const sig = JSON.stringify(incoming.map((n) => [n, resolveExpiry(n, now)]))
    if (sig === lastSig) return
    lastSig = sig
    return incoming === state.nodes ? incoming.map((n) => ({ ...n })) : incoming
}

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
    const settings = normalizeSettings(site.settings)
    const resolvedTitle = settings.siteTitle || site.name
    if (resolvedTitle) writeStorage(SITE_TITLE_KEY, resolvedTitle)
    lastSig = ""
    syncExpiryClock(Date.now(), nodes)
    set({
        site,
        nodes,
        groupOrder,
        session,
        actualCosts,
        groupIcons: site.groupIcons ?? {},
        settings,
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
            let snapChanged = false
            for (const [id, prev] of Object.entries(state.snapshots))
                if (!event.snapshots[id]) {
                    snapshots[id] = prev.online
                        ? ((snapChanged = true), { ...prev, online: false })
                        : prev
                }
            for (const [id, incoming] of Object.entries(event.snapshots)) {
                const next = cleanSnapshot(incoming),
                    prev = state.snapshots[id]
                snapshots[id] =
                    JSON.stringify(next) === JSON.stringify(prev)
                        ? prev
                        : ((snapChanged = true), next)
            }
            const patch: Partial<State> = {
                snapshots: snapChanged ? snapshots : state.snapshots,
                nodes: syncExpiryClock(Date.now(), event.nodes) ?? state.nodes,
                everConnected: true,
                fed: true,
                refreshing: false,
            }
            if (pushLive(snapshots)) patch.liveVersion = state.liveVersion + 1
            clearTimeout(refreshTimer)
            set(patch)
        },
        (connection) =>
            set(connection === "open" ? { connection, everConnected: true } : { connection }),
    )
}

/**
 * Backfill the ledger sparks from server history so they are full on arrival instead of
 * drawing a sliver at the right edge for the first minutes.
 */
export async function seedLive(nodes: readonly NodeInfo[], signal?: AbortSignal) {
    if (!state.site?.recordHours) return
    const queue = nodes.map((n) => n.id)
    const worker = async () => {
        for (let id = queue.shift(); id && !signal?.aborted; id = queue.shift()) {
            const seed = await adapter.loadHistory(id, 0.25, "spark", signal).catch(() => [])
            if (!seed.length || signal?.aborted) continue
            sparkSeeds.set(id, seed)
            set({ liveVersion: state.liveVersion + 1 })
        }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
}

// A live hole wider than this (paused tab, sleep, dropped socket) is filled from history.
const LIVE_GAP_MS = 10_000
const LIVE_RETRY_MS = 10_000
// Per node: live points up to here have already been checked against history.
const filledThrough = new Map<string, number>()
const pendingFills = new Map<string, { ctrl: AbortController; done: Promise<void> }>()
const retries = new Map<string, ReturnType<typeof setTimeout>>()

/** Check the leading edge too: a long pause can evict every pre-pause frame. */
export function liveNeedsFill(id: string) {
    const buf = getLive(id)
    if (!buf.length || pendingFills.has(id) || retries.has(id)) return false
    const since = filledThrough.get(id) ?? 0
    const from = Math.max(since, buf[buf.length - 1].at - LIVE_WINDOW_MS)
    if (buf[0].at - from > LIVE_GAP_MS) return true
    for (let i = 1; i < buf.length; i++)
        if (
            buf[i].at > since &&
            buf[i].reportedAt !== undefined &&
            buf[i].at - buf[i - 1].at > LIVE_GAP_MS
        )
            return true
    return false
}

/**
 * Fill the live 15 minutes from history wherever no live point is near: before the page opened,
 * and holes left while the page was paused. Live points are kept as they are.
 */
export async function backfillLive(id: string, signal?: AbortSignal) {
    if (!state.site?.recordHours || signal?.aborted) return
    const pending = pendingFills.get(id)
    if (pending && !pending.ctrl.signal.aborted) return pending.done

    clearTimeout(retries.get(id))
    retries.delete(id)
    const through = getLive(id).at(-1)?.at ?? Date.now()
    const ctrl = new AbortController()
    const abort = () => ctrl.abort()
    signal?.addEventListener("abort", abort, { once: true })
    const done = adapter.loadHistory(id, LIVE_WINDOW_MS / 3_600_000, "live", ctrl.signal).then(
        (points) => {
            if (ctrl.signal.aborted) return
            filledThrough.set(id, through)
            const now = Date.now()
            const from = now - LIVE_WINDOW_MS
            const buf = getLive(id).filter((p) => p.at >= from)
            const fill = points.filter(
                (p) =>
                    p.at >= from &&
                    p.at <= now &&
                    !buf.some((b) => Math.abs(b.at - p.at) < LIVE_GAP_MS),
            )
            if (!fill.length) return
            live.set(id, [...fill, ...buf].sort((a, b) => a.at - b.at).slice(-LIVE_CAPACITY))
            set({ liveVersion: state.liveVersion + 1 })
        },
        () => {
            if (ctrl.signal.aborted) return
            const timer = setTimeout(() => {
                retries.delete(id)
                set({ liveVersion: state.liveVersion + 1 })
            }, LIVE_RETRY_MS)
            retries.set(id, timer)
            // the page that asked has left: drop the retry with it
            signal?.addEventListener(
                "abort",
                () => {
                    clearTimeout(timer)
                    if (retries.get(id) === timer) retries.delete(id)
                },
                { once: true },
            )
        },
    )
    pendingFills.set(id, { ctrl, done })
    try {
        await done
    } finally {
        signal?.removeEventListener("abort", abort)
        ctrl.abort() // cancel any sibling metric requests left after a failure
        if (pendingFills.get(id)?.ctrl === ctrl) pendingFills.delete(id)
    }
}

export async function start() {
    set({ phase: "loading" })
    try {
        await load()
    } catch (err) {
        if (isCanceledError(err)) return
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
    await load().catch((err) => {
        if (!isCanceledError(err)) console.error("[nezha-kumo] refresh failed", err)
    })
    connect()
}

/** Resolved site title from theme settings, backend site info, or cached localStorage (never a fake placeholder). */
export function useSiteTitle() {
    return useStore(
        (s) => s.settings.siteTitle || s.site?.name || readStorage(SITE_TITLE_KEY) || "",
    )
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
