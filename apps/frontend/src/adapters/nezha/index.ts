// Adapted from zool-theme/src/adapters/nezha/index.ts (MIT, luoleiorg).
import { abortError, request, resilientSocket, wsUrl } from "@/core/http"
import type {
    ActualCost,
    ConnectionStatus,
    HistoryPoint,
    LiveEvent,
    LoginResult,
    NodeInfo,
    PingData,
    Session,
    SiteInfo,
    Snapshot,
} from "@/core/model"
import { flagToRegion } from "@/core/region"
import { readThemeConfig } from "@/core/settings"

import { parseGroupIcons } from "../../../../../packages/shared/group-icons"
import {
    cycleDays,
    parseAmount,
    parseCycle,
    parseNoteDate,
    parseTraffic,
    parseTrafficType,
} from "../../../../../packages/shared/public-note"

/* ---------- API shapes (Nezha dashboard v1, tested on v2.0.13) ---------- */

interface Common<T> {
    success: boolean
    data?: T
    error?: string
}

interface NezhaServer {
    id: number
    name: string
    public_note?: string
    display_index?: number
    country_code?: string
    last_active?: string
    host?: {
        platform?: string
        platform_version?: string
        cpu?: string[]
        gpu?: string[]
        mem_total?: number
        disk_total?: number
        swap_total?: number
        arch?: string
        virtualization?: string
        version?: string
        boot_time?: number
    }
    // Fields are `omitempty` on the wire: a zero value is simply missing.
    state?: {
        cpu?: number
        mem_used?: number
        swap_used?: number
        disk_used?: number
        net_in_transfer?: number
        net_out_transfer?: number
        net_in_speed?: number
        net_out_speed?: number
        uptime?: number
        load_1?: number
        load_5?: number
        load_15?: number
        tcp_conn_count?: number
        udp_conn_count?: number
        process_count?: number
    }
}

export interface NezhaFrame {
    now: number
    servers?: NezhaServer[]
}

export interface NezhaGroup {
    group: { id: number; name: string }
    servers: number[] | null
}

interface NezhaSetting {
    config?: {
        site_name?: string
        language?: string
        oauth2_providers?: string[] | null
        custom_code?: string
    }
    tsdb_enabled?: boolean
}

/** Older dashboards send `service_*`; current dashboards send `monitor_*`. */
interface NezhaServiceInfo {
    monitor_id?: number
    monitor_name?: string
    service_id?: number
    service_name?: string
    created_at: number[] | null
    avg_delay: number[] | null
}

/** Nezha reports the average delay per probe window. */
export function mapServices(services: NezhaServiceInfo[], since = 0): PingData {
    const tasks: PingData["tasks"] = []
    const points: PingData["points"] = []
    for (const s of services) {
        const id = s.monitor_id ?? s.service_id ?? 0
        const keep = (s.created_at ?? [])
            .map((t, i) => [t, s.avg_delay?.[i] ?? -1] as const)
            .filter(([t]) => t >= since)
        const at = keep.map(([t]) => t)
        const delay = keep.map(([, v]) => v)
        const values = delay.filter((v) => v > 0)
        tasks.push({
            id,
            name: s.monitor_name ?? s.service_name ?? "",
            avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
            min: values.length ? Math.min(...values) : 0,
            max: values.length ? Math.max(...values) : 0,
        })
        at.forEach((t, i) => points.push({ at: t, task: id, value: delay[i] ?? -1 }))
    }
    points.sort((a, b) => a.at - b.at)
    return { tasks, points }
}

/* ---------- public_note (nezha-dash / Nazhua convention) ---------- */

interface PublicNote {
    billingDataMod?: { endDate?: string; autoRenewal?: string; cycle?: string; amount?: string }
    planDataMod?: {
        trafficVol?: string
        trafficType?: string
        bandwidth?: string
        IPv4?: string
        IPv6?: string
        networkRoute?: string
        extra?: string
    }
}

export function parseActualCost(note: unknown): ActualCost | undefined {
    if (typeof note !== "string") return
    try {
        const price = parseAmount(JSON.parse(note)?.billingDataMod?.actualAmount)
        if (price && price.symbol && price.currency && price.amount >= 0) {
            return {
                currency: price.currency,
                amount: price.amount,
                ...(price.cycle ? { cycle: cycleDays(price.cycle) } : {}),
            }
        }
    } catch {
        /* Empty, plain-text or malformed private notes keep the displayed price. */
    }
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export function parsePublicNote(note: string | undefined) {
    const out = {
        price: 0,
        currency: "$",
        billingCycle: 0,
        autoRenewal: false,
        expiredAt: null as number | null,
        trafficLimit: -1,
        trafficLimitType: "max" as NodeInfo["trafficLimitType"],
        trafficLimitTypeExplicit: false,
        trafficLimitPeriod: 0,
        bandwidth: "",
        ipv4: undefined as boolean | undefined,
        ipv6: undefined as boolean | undefined,
        networkRoute: "",
        note: "",
    }
    if (!note || note.trim()[0] !== "{") return out
    let parsed: PublicNote
    try {
        parsed = JSON.parse(note) as PublicNote
    } catch {
        return out
    }
    const b = parsed.billingDataMod
    if (b) {
        const amount = parseAmount(b.amount)
        if (amount) {
            out.price =
                amount.amount === -1
                    ? -2
                    : amount.amount === 0 && !amount.currency && !amount.symbol
                      ? -1
                      : amount.amount
            if (amount.amount > 0) out.currency = amount.symbol.slice(0, 4) || "$"
        }
        out.billingCycle = cycleDays(
            parseCycle(b.cycle) ?? (!text(b.cycle) ? amount?.cycle : undefined),
        )
        out.autoRenewal = text(b.autoRenewal) === "1"
        const end = parseNoteDate(b.endDate)
        out.expiredAt =
            end === 0 ? 0 : end !== undefined && new Date(end).getUTCFullYear() > 2000 ? end : null
    }
    const p = parsed.planDataMod
    if (p) {
        const traffic = parseTraffic(p.trafficVol)
        if (traffic) {
            out.trafficLimit = traffic === "unlimited" ? 0 : traffic.bytes
            out.trafficLimitPeriod = traffic === "unlimited" ? 0 : cycleDays(traffic.cycle)
        }
        out.trafficLimitType = parseTrafficType(p.trafficType)
        out.trafficLimitTypeExplicit = !!text(p.trafficType)
        out.bandwidth = text(p.bandwidth)
        out.ipv4 = text(p.IPv4) === "1" ? true : text(p.IPv4) === "0" ? false : undefined
        out.ipv6 = text(p.IPv6) === "1" ? true : text(p.IPv6) === "0" ? false : undefined
        out.networkRoute = text(p.networkRoute)
        out.note = text(p.extra)
    }
    return out
}

/* ---------- mapping ---------- */

const PLATFORMS: Record<string, string> = {
    istoreos: "iStoreOS",
    openwrt: "OpenWrt",
    centos: "CentOS",
    opensuse: "openSUSE",
    macos: "macOS",
    darwin: "macOS",
    freebsd: "FreeBSD",
    rhel: "RHEL",
}

/** Nezha reports platform ids such as "debian"; show them as product names. */
const prettyPlatform = (p = "") =>
    PLATFORMS[p.toLowerCase()] ?? (p ? p[0].toUpperCase() + p.slice(1) : "")

/** "Intel Xeon 2 Virtual Core" → ["Intel Xeon", 2] */
function splitCpu(cpu = ""): [string, number] {
    const m = /^(.*?)\s+(\d+)\s+(Physical|Virtual)\s+Core$/i.exec(cpu.trim())
    return m ? [m[1], Number(m[2])] : [cpu, 0]
}

function mapServer(s: NezhaServer, groups: Map<number, string[]>, note?: string): NodeInfo {
    const h = s.host ?? {}
    const [cpuName, cores] = splitCpu(h.cpu?.[0])
    const billing = parsePublicNote(note ?? s.public_note)
    return {
        id: String(s.id),
        name: s.name,
        groups: groups.get(s.id) ?? [],
        region: (s.country_code ?? "").toUpperCase() || flagToRegion(s.name),
        os: [prettyPlatform(h.platform), h.platform_version].filter(Boolean).join(" "),
        arch: h.arch ?? "",
        cpuName,
        cpuCores: cores * Math.max(1, h.cpu?.length ?? 1),
        virtualization: h.virtualization ?? "",
        gpuName: (h.gpu ?? []).join(", "),
        bootTime: h.boot_time ? h.boot_time * 1000 : undefined,
        agentVersion: h.version,
        memTotal: h.mem_total ?? 0,
        swapTotal: h.swap_total ?? 0,
        diskTotal: h.disk_total ?? 0,
        // Nezha sorts by display_index descending.
        weight: -(s.display_index ?? 0),
        ...billing,
    }
}

/** Nezha has no explicit online flag; its own frontend treats 30s of silence as offline. */
const OFFLINE_AFTER_MS = 30_000

export function mapState(s: NezhaServer, now: number): Snapshot {
    const st = s.state ?? {}
    const h = s.host ?? {}
    // A server that never reported carries Go's zero time, "0001-01-01T00:00:00Z", which parses to
    // a large negative number and printed as "last seen 739,874 days ago". Treat it as never seen.
    const parsed = s.last_active ? Date.parse(s.last_active) : NaN
    const last = parsed > 0 ? parsed : 0
    return {
        online: last > 0 && now - last < OFFLINE_AFTER_MS,
        at: last || (s.last_active ? 0 : now),
        cpu: st.cpu ?? 0,
        memUsed: st.mem_used ?? 0,
        memTotal: h.mem_total ?? 0,
        swapUsed: st.swap_used ?? 0,
        swapTotal: h.swap_total ?? 0,
        diskUsed: st.disk_used ?? 0,
        diskTotal: h.disk_total ?? 0,
        netUp: st.net_out_speed ?? 0,
        netDown: st.net_in_speed ?? 0,
        totalUp: st.net_out_transfer ?? 0,
        totalDown: st.net_in_transfer ?? 0,
        load1: st.load_1 ?? 0,
        load5: st.load_5 ?? 0,
        load15: st.load_15 ?? 0,
        tcp: st.tcp_conn_count ?? 0,
        udp: st.udp_conn_count ?? 0,
        process: st.process_count ?? 0,
        uptime: st.uptime ?? 0,
    }
}

const sortGroups = (groups: readonly NezhaGroup[]) =>
    [...groups].sort((a, b) => a.group.id - b.group.id)

export function mapGroupOrder(groups: readonly NezhaGroup[]): string[] {
    const seen = new Set<string>()
    for (const { group } of sortGroups(groups)) {
        if (group.name) seen.add(group.name)
    }
    return [...seen]
}

export function groupIndex(groups: readonly NezhaGroup[]): Map<number, string[]> {
    const index = new Map<number, string[]>()
    for (const g of sortGroups(groups)) {
        if (!g.group.name) continue
        for (const id of g.servers ?? []) index.set(id, [...(index.get(id) ?? []), g.group.name])
    }
    return index
}

/**
 * Nezha sends `public_note` **only in the first frame** after a socket connects
 * (`StreamServer.PublicNote` is filled with `withPublicNote = count == 0`), so billing
 * and quota data has to be remembered across frames — otherwise it vanishes on frame two
 * and never comes back after a reconnect.
 */
const publicNotes = new Map<string, string>()

export function mapFrame(
    frame: NezhaFrame,
    groups: Map<number, string[]>,
    notes: Map<string, string> = publicNotes,
): Required<LiveEvent> {
    const servers = frame.servers ?? []
    const now = frame.now || Date.now()
    const snapshots: Record<string, Snapshot> = {}
    const nodes: NodeInfo[] = []
    for (const s of servers) {
        const id = String(s.id)
        if (s.public_note !== undefined) notes.set(id, s.public_note)
        snapshots[id] = mapState(s, now)
        nodes.push(mapServer(s, groups, notes.get(id)))
    }
    return { snapshots, nodes }
}

/* ---------- shared socket hub ---------- */

type Listener = (frame: NezhaFrame) => void

const hub = (() => {
    const listeners = new Set<Listener>()
    const statusListeners = new Set<(s: "connecting" | "open" | "closed") => void>()
    let socket: ReturnType<typeof resilientSocket> | null = null
    let last: NezhaFrame | null = null
    let status: "connecting" | "open" | "closed" = "connecting"

    const ensure = () => {
        if (socket) return
        socket = resilientSocket({
            url: () => wsUrl("/api/v1/ws/server"),
            onOpen: () => {
                last = null
                publicNotes.clear()
            },
            onStatus: (s) => {
                status = s
                statusListeners.forEach((l) => l(s))
            },
            onMessage: (text) => {
                try {
                    const frame = JSON.parse(text) as NezhaFrame
                    if (
                        !frame ||
                        !Number.isFinite(frame.now) ||
                        (frame.servers !== undefined && !Array.isArray(frame.servers))
                    )
                        return false
                    last = frame
                    listeners.forEach((l) => l(frame))
                    return true
                } catch {
                    return false
                }
            },
        })
    }

    return {
        first(timeoutMs: number): Promise<NezhaFrame> {
            if (last) return Promise.resolve(last)
            ensure()
            return new Promise((resolve, reject) => {
                const once: Listener = (f) => {
                    clearTimeout(timer)
                    listeners.delete(once)
                    resolve(f)
                }
                // Without a frame the page would sit on its skeleton forever; fail into the retry state.
                const timer = setTimeout(() => {
                    listeners.delete(once)
                    reject(new Error("No data from /api/v1/ws/server"))
                }, timeoutMs)
                listeners.add(once)
            })
        },
        /** A forced refresh: the next first() waits for a new frame instead of replaying the last. */
        reset() {
            socket?.close()
            socket = null
            last = null
            publicNotes.clear()
            status = "connecting"
        },
        listen(l: Listener, s?: (st: "connecting" | "open" | "closed") => void) {
            ensure()
            listeners.add(l)
            if (s) {
                statusListeners.add(s)
                // The socket may already be open (loadNodes starts it first).
                s(status)
            }
            if (last) l(last)
            return () => {
                listeners.delete(l)
                if (s) statusListeners.delete(s)
            }
        },
    }
})()

// Module-level so socket frames replayed synchronously on subscribe already see the groups.
let rawGroupsCache: NezhaGroup[] = []
let groupsCache = new Map<number, string[]>()
let groupOrderCache: string[] = []
let groupsPromise: Promise<Map<number, string[]>> | null = null
const loadGroups = () =>
    (groupsPromise ??= request<Common<NezhaGroup[]>>("/api/v1/server-group")
        .then((r) => {
            if (!r.success) throw new Error("Nezha groups unavailable")
            rawGroupsCache = r.data ?? []
            groupOrderCache = mapGroupOrder(rawGroupsCache)
            return (groupsCache = groupIndex(rawGroupsCache))
        })
        .catch((err) => {
            groupsPromise = null
            throw err
        }))

export function mapGroupIcons(groups: NezhaGroup[], customCode?: string): Record<string, string> {
    const byId = parseGroupIcons(customCode)
    if (!Object.keys(byId).length) return {}
    const byName: Record<string, string> = {}
    for (const { group } of groups) {
        const icon = byId[String(group.id)]
        if (group.name && icon) byName[group.name] = icon
    }
    return byName
}

const FIRST_FRAME_TIMEOUT_MS = 15_000

/* ---------- history (TSDB, v2.6+) ---------- */

interface NezhaMetricSeries {
    data_points?: { ts: number; value: number }[] | null
}

/** TSDB metric name → HistoryPoint field. Nezha's `in` is download, `out` is upload. */
const METRICS = {
    cpu: "cpu",
    memory: "memUsed",
    swap: "swapUsed",
    disk: "diskUsed",
    net_out_speed: "netUp",
    net_in_speed: "netDown",
    load1: "load1",
    tcp_conn: "tcp",
    udp_conn: "udp",
    process_count: "process",
    net_out_transfer: "totalUp",
    net_in_transfer: "totalDown",
} as const satisfies Record<string, keyof HistoryPoint>

/** The API only takes these periods; shorter ranges are cut from `1d` client-side. */
const period = (hours: number) => (hours <= 24 ? "1d" : hours <= 168 ? "7d" : "30d")

export function mergeMetrics(
    series: Partial<Record<keyof typeof METRICS, NezhaMetricSeries | null | undefined>>,
    since: number,
): HistoryPoint[] {
    const byTs = new Map<number, HistoryPoint>()
    for (const [metric, field] of Object.entries(METRICS) as [
        keyof typeof METRICS,
        keyof HistoryPoint,
    ][]) {
        for (const { ts, value } of series[metric]?.data_points ?? []) {
            if (ts < since || !Number.isFinite(value)) continue
            let point = byTs.get(ts)
            if (!point) {
                // NaN preserves per-metric gaps without changing the numeric history contract.
                point = {
                    at: ts,
                    cpu: NaN,
                    memUsed: NaN,
                    swapUsed: NaN,
                    diskUsed: NaN,
                    netUp: NaN,
                    netDown: NaN,
                    load1: NaN,
                    tcp: NaN,
                    udp: NaN,
                    process: NaN,
                }
                byTs.set(ts, point)
            }
            ;(point as unknown as Record<string, number>)[field] = value
        }
    }
    return [...byTs.values()].sort((a, b) => a.at - b.at)
}

// The API exposes one series per GET. Cache raw periods so ranges and tabs share requests.
export const HISTORY_CACHE_MS = 10 * 60_000
const METRIC_SETS = {
    spark: ["cpu", "net_out_speed", "net_in_speed"],
    counters: ["net_out_transfer", "net_in_transfer"],
    billing: ["net_out_speed", "net_in_speed", "net_out_transfer", "net_in_transfer"],
    reports: ["cpu"],
    overview: [
        "cpu",
        "memory",
        "swap",
        "disk",
        "net_out_speed",
        "net_in_speed",
        "load1",
        "tcp_conn",
        "udp_conn",
        "process_count",
    ],
} as const
interface CacheEntry {
    at: number
    promise: Promise<unknown>
    ctrl: AbortController
    waiters: number
    settled: boolean
}
const historyCache = new Map<string, CacheEntry>()
function cached<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    ttl = HISTORY_CACHE_MS,
    signal?: AbortSignal,
): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortError(signal))
    let entry = historyCache.get(key)
    if (
        !entry ||
        Date.now() - entry.at >= ttl ||
        new Date(entry.at).toDateString() !== new Date().toDateString()
    ) {
        const ctrl = new AbortController()
        const next: CacheEntry = {
            at: Date.now(),
            ctrl,
            waiters: 0,
            settled: false,
            promise: Promise.resolve(),
        }
        next.promise = load(ctrl.signal).then(
            (val) => ((next.settled = true), val),
            (error) => {
                next.settled = true
                if (historyCache.get(key) === next) historyCache.delete(key)
                throw error
            },
        )
        next.promise.catch(() => {})
        historyCache.set(key, next)
        entry = next
    }
    if (!signal || entry.settled) return entry.promise as Promise<T>
    const active = entry
    active.waiters++
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            if (--active.waiters <= 0 && !active.settled) {
                if (historyCache.get(key) === active) historyCache.delete(key)
                active.ctrl.abort()
            }
            reject(abortError(signal))
        }
        const done = () => {
            signal.removeEventListener("abort", onAbort)
            active.waiters = Math.max(0, active.waiters - 1)
        }
        signal.addEventListener("abort", onAbort, { once: true })
        active.promise.then(
            (val) => (done(), resolve(val as T)),
            (err) => (done(), reject(err)),
        )
    })
}

/* ---------- adapter ---------- */

export const nezha = {
    adminUrl: "/dashboard",
    historyRanges: [0, 1, 4, 24, 168, 720],

    async loadSite(loggedIn = false): Promise<SiteInfo> {
        const res = await request<Common<NezhaSetting>>("/api/v1/setting")
        if (!res.success || !res.data) throw new Error("Nezha settings unavailable")
        const cfg = res?.data?.config ?? {}
        const hasGroupIcons = Object.keys(parseGroupIcons(cfg.custom_code)).length > 0
        if (hasGroupIcons) await loadGroups()
        const groupIcons = hasGroupIcons ? mapGroupIcons(rawGroupsCache, cfg.custom_code) : {}
        const oauthProviders = (cfg.oauth2_providers ?? []).filter(
            (provider) => typeof provider === "string" && provider.trim(),
        )
        return {
            name: (cfg.site_name ?? "").trim() || "Nezha",
            language: cfg.language?.replace("_", "-"),
            settings: readThemeConfig(cfg.custom_code, window.NezhaKumoConfig),
            groupIcons,
            // Guests may only read one day of TSDB history; signed-in users get the full 30 days.
            recordHours: res?.data?.tsdb_enabled ? (loggedIn ? 720 : 24) : 0,
            oauth: oauthProviders.length > 0,
            oauthProviders,
        }
    },

    async loadNodes() {
        const [frame, groups] = await Promise.all([hub.first(FIRST_FRAME_TIMEOUT_MS), loadGroups()])
        return mapFrame(frame, groups).nodes
    },

    loadGroupOrder: () => loadGroups().then(() => groupOrderCache),

    async loadSession(): Promise<Session> {
        try {
            const res = await request<Common<{ username?: string }>>("/api/v1/profile")
            return res.success
                ? { loggedIn: true, username: res.data?.username }
                : { loggedIn: false }
        } catch {
            return { loggedIn: false }
        }
    },

    async loadActualCosts() {
        const res = await request<Common<{ id: number; note?: string }[]>>("/api/v1/server", {
            cache: "no-store",
        })
        if (!res.success || !Array.isArray(res.data)) throw new Error("Private billing unavailable")
        const costs: Record<string, ActualCost> = {}
        for (const server of res.data) {
            const cost = parseActualCost(server.note)
            if (cost) costs[String(server.id)] = cost
        }
        return costs
    },

    subscribe(listener: (event: LiveEvent) => void, onStatus?: (status: ConnectionStatus) => void) {
        // Startup reports group errors; a failed refresh keeps the last successful mapping.
        void loadGroups().catch(() => {})
        return hub.listen((frame) => listener(mapFrame(frame, groupsCache)), onStatus)
    },

    reset() {
        hub.reset()
        groupsPromise = null
        historyCache.clear()
    },

    async loadHistory(
        id: string,
        hours: number,
        kind: keyof typeof METRIC_SETS = "overview",
        signal?: AbortSignal,
    ) {
        const names = METRIC_SETS[kind]
        const series = await Promise.all(
            names.map(async (metric) => {
                const url = `/api/v1/server/${encodeURIComponent(id)}/metrics?period=${period(hours)}&metric=${metric}`
                const data = await cached(
                    url,
                    async (reqSignal) => {
                        const res = await request<Common<NezhaMetricSeries>>(
                            url,
                            { signal: reqSignal },
                            60_000,
                        )
                        if (!res.success) throw new Error("Nezha history unavailable")
                        return res.data ?? {}
                    },
                    HISTORY_CACHE_MS,
                    signal,
                )
                return [metric, data] as const
            }),
        )
        return mergeMetrics(Object.fromEntries(series), Date.now() - hours * 3_600_000)
    },

    clearHistory(id: string) {
        const prefix = `/api/v1/server/${encodeURIComponent(id)}/`
        for (const key of historyCache.keys()) if (key.startsWith(prefix)) historyCache.delete(key)
    },

    async loadPing(id: string, hours: number, signal?: AbortSignal): Promise<PingData> {
        const url = `/api/v1/server/${encodeURIComponent(id)}/service?period=${period(hours)}`
        const data = await cached(
            url,
            async (reqSignal) => {
                const res = await request<Common<NezhaServiceInfo[]>>(url, { signal: reqSignal })
                if (!res.success) throw new Error("Nezha latency unavailable")
                return res.data ?? []
            },
            hours < 1 ? 30_000 : HISTORY_CACHE_MS,
            signal,
        )
        return mapServices(data, Date.now() - hours * 3_600_000)
    },

    async login(username: string, password: string): Promise<LoginResult> {
        try {
            const res = await request<Common<unknown>>("/api/v1/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            })
            return res.success ? { ok: true } : { ok: false, reason: "invalid", message: res.error }
        } catch (e) {
            return e instanceof Error && e.name !== "AbortError" && "status" in e
                ? { ok: false, reason: "invalid" }
                : { ok: false, reason: "network" }
        }
    },

    async oauthUrl(site: SiteInfo, provider = site.oauthProviders?.[0]) {
        if (!site.oauth || !provider || !site.oauthProviders?.includes(provider)) return null
        const res = await request<Common<{ redirect: string }>>(
            `/api/v1/oauth2/${encodeURIComponent(provider)}?type=1`,
        )
        if (!res.success) throw new Error("OAuth login failed")
        const url = new URL(res.data?.redirect ?? "")
        if (url.protocol !== "https:" && url.protocol !== "http:")
            throw new Error("Invalid OAuth redirect")
        return url.href
    },
    nodePath: (id: string) => `/server/${encodeURIComponent(id)}`,
    // Nezha only serves the SPA for `/` and `/server/:id`.
    matchNodePath: (pathname: string) => /^\/server\/(\d+)/.exec(pathname)?.[1] ?? null,
}
