import type {
    Cycle,
    TrafficBilling as TrafficLimitType,
} from "../../../../packages/shared/public-note"

// Adapted from zool-theme/src/core/model.ts (MIT, luoleiorg).
export type {
    Cycle,
    TrafficBilling as TrafficLimitType,
} from "../../../../packages/shared/public-note"

export interface SiteInfo {
    name: string
    /** Backend default language, e.g. `zh-CN`. */
    language?: string
    /** Raw theme settings as provided by the backend; see `normalizeSettings`. */
    settings: unknown
    /** Group name -> icon value (emoji/short text or https:// image URL). */
    groupIcons?: Record<string, string>
    /** Longest history range the backend keeps, in hours. */
    recordHours: number
    oauth: boolean
    oauthProviders?: string[]
}

export interface NodeInfo {
    id: string
    name: string
    groups: string[]
    /** ISO 3166-1 alpha-2, upper case. Empty when unknown. */
    region: string
    os: string
    arch: string
    cpuName: string
    cpuCores: number
    virtualization: string
    gpuName: string
    bootTime?: number
    agentVersion?: string
    memTotal: number
    swapTotal: number
    diskTotal: number
    /** Lower sorts first. */
    weight: number
    /** 0 = not set, -1 = free, -2 = pay-as-you-go. */
    price: number
    currency: string
    /** Billing cycle in days (30 ≈ monthly, 365 ≈ yearly). 0 = not set, -1 = one-time. */
    billingCycle: number
    /** Parsed calendar cycle from public note, when recognized. */
    cycle?: Cycle
    autoRenewal: boolean
    /** Expiry as epoch ms; 0 = explicitly permanent, null = not set. */
    expiredAt: number | null
    /** UTC offset in minutes of the original expiry string, when present. */
    tz?: number
    /** Bytes; 0 = unlimited, -1 = unknown. */
    trafficLimit: number
    trafficLimitType: TrafficLimitType
    trafficLimitTypeExplicit?: boolean
    /** Period in days, when the quota does not share the cumulative counters' window. */
    trafficLimitPeriod?: number
    bandwidth?: string
    ipv4?: boolean
    ipv6?: boolean
    networkRoute?: string
    note: string
}

export interface Snapshot {
    online: boolean
    /** Epoch ms of the report. */
    at: number
    cpu: number
    memUsed: number
    memTotal: number
    swapUsed: number
    swapTotal: number
    diskUsed: number
    diskTotal: number
    /** Bytes per second. */
    netUp: number
    netDown: number
    /** Cumulative bytes. */
    totalUp: number
    totalDown: number
    load1: number
    load5: number
    load15: number
    tcp: number
    udp: number
    process: number
    /** Seconds. */
    uptime: number
}

export interface HistoryPoint {
    at: number
    /** When the node said it measured this, if it told us. Live points stamp `at` with our own
     *  clock, so this is kept separately to deduplicate repeated reports. */
    reportedAt?: number
    cpu: number
    memUsed: number
    swapUsed: number
    diskUsed: number
    netUp: number
    netDown: number
    load1: number
    tcp: number
    udp: number
    process: number
    /** Cumulative counters at this point, when the backend records them. */
    totalUp?: number
    totalDown?: number
}

interface PingTask {
    id: number
    name: string
    avg: number
    min: number
    max: number
}

interface PingPoint {
    at: number
    task: number
    /** Milliseconds; negative means the probe was lost. */
    value: number
}

export interface PingData {
    tasks: PingTask[]
    points: PingPoint[]
}

export interface Session {
    loggedIn: boolean
    username?: string
}

/** Private expense for one displayed billing cycle. Zero is an explicit override. */
export interface ActualCost {
    amount: number
    currency: string
    /** Actual billing cycle in days; absent values inherit the public cycle. */
    cycle?: number
}

export type LoginResult =
    { ok: true } | { ok: false; reason: "invalid" | "network"; message?: string }

export type ConnectionStatus = "connecting" | "open" | "closed"

export interface LiveEvent {
    snapshots: Record<string, Snapshot>
    /** Some backends (Nezha) push node metadata over the same socket. */
    nodes?: NodeInfo[]
}
