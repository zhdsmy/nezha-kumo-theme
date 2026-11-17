/** Public-note dialects used by Nezha, nezhainfojson and Nazhua. */
export const CYCLE_UNITS = ["Day", "Week", "Month", "Year"] as const
export type CycleUnit = (typeof CYCLE_UNITS)[number]
export interface Cycle {
    count: number
    unit: CycleUnit
}
const CYCLE_ALIASES: [RegExp, CycleUnit, number][] = [
    [/^(d|days?|daily|天|日|日間|每天|每日|毎日)$/, "Day", 1],
    [/^(w|wk|weeks?|weekly|周|週|週間|每周|每週|毎週)$/, "Week", 1],
    [/^(m|mo|months?|monthly|月|个月|個月|か月|ヶ月|箇月|每月|毎月)$/, "Month", 1],
    [/^(q|qr|quarter|quarterly|季|季度)$/, "Month", 3],
    [/^(h|half|halfyear|semi|semiannual|semiannually|半|半年)$/, "Month", 6],
    [/^(y|yr|years?|yearly|annual|annually|年|年間|每年|毎年)$/, "Year", 1],
    [/^(biennial|两年|兩年|二年)$/, "Year", 2],
    [/^(triennial|三年)$/, "Year", 3],
]
export function parseCycle(value: unknown): Cycle | undefined {
    if (typeof value !== "string") return
    const match = /^(\d+)?(.+)$/.exec(
        value.toLowerCase().replace(/\s/g, "").replace("semi-", "semi").replace("half-", "half"),
    )
    if (!match) return
    const alias = CYCLE_ALIASES.find(([pattern]) => pattern.test(match[2]))
    const count = Number(match[1] || 1) * (alias?.[2] ?? 1)
    if (alias && Number.isSafeInteger(count) && count > 0) return { count, unit: alias[1] }
}
export function cycleDays(cycle: Cycle | undefined): number {
    if (!cycle) return 0
    const { count, unit } = cycle
    // Preserve the existing half-year estimate and calendar-year costs.
    return unit === "Month"
        ? count % 12 === 0
            ? (count / 12) * 365
            : count === 6
              ? 182
              : count * 30
        : count * { Day: 1, Week: 7, Year: 365 }[unit]
}
export function writeCycle({ count, unit }: Cycle): string {
    if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid cycle")
    if (unit === "Month" && count % 12 === 0) return writeCycle({ count: count / 12, unit: "Year" })
    if (unit === "Day" && count % 7 === 0) return writeCycle({ count: count / 7, unit: "Week" })
    return count === 1
        ? unit
        : unit === "Month" && count === 3
          ? "Quarter"
          : unit === "Month" && count === 6
            ? "Half"
            : `${count}${unit}`
}

const COMMON_CURRENCIES = ["CNY", "USD", "EUR", "HKD", "JPY", "GBP", "AUD"]
export function currencies(): string[] {
    return [...new Set([...COMMON_CURRENCIES, ...Intl.supportedValuesOf("currency")])]
}
const CURRENCY_SYMBOLS: Record<string, string> = {
    "¥": "CNY",
    "￥": "CNY",
    元: "CNY",
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    "₽": "RUB",
    US$: "USD",
    RMB: "CNY",
    AUD$: "AUD",
    NT$: "TWD",
    S$: "SGD",
    "₩": "KRW",
    C$: "CAD",
    C: "CAD",
    A$: "AUD",
    HK$: "HKD",
    "JP¥": "JPY",
}
export function currencyCode(value: string): string | null {
    const code = value.trim().toUpperCase()
    return CURRENCY_SYMBOLS[code] ?? (/^[A-Z]{3}$/.test(code) ? code : null)
}
interface Amount {
    amount: number
    currency: string
    symbol: string
    cycle?: Cycle
}
export function parseAmount(value: unknown): Amount | undefined {
    if (typeof value !== "string") return
    const [price, period, ...rest] = value.trim().split("/")
    const cycle = period === undefined ? undefined : parseCycle(period)
    if (rest.length || (period !== undefined && !cycle)) return
    if (price === "-1" || price === "0" || /free|免费|免費/i.test(price)) {
        return { amount: price === "-1" ? -1 : 0, currency: "", symbol: "", cycle }
    }
    const normalized = price.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1")
    const match = /-?\d+(?:\.\d+)?/.exec(normalized)
    if (!match) return
    const amount = Number(match[0])
    const symbol = normalized.replace(match[0], "").trim()
    const currency = currencyCode(symbol) || (symbol ? "" : "USD")
    if (Number.isFinite(amount) && amount >= 0) return { amount, currency, symbol, cycle }
}
export function writeAmount(amount: number, currency: string): string {
    if (!Number.isFinite(amount) || (amount < 0 && amount !== -1)) throw new Error("Invalid amount")
    return amount <= 0 ? String(amount) : `${currency} ${amount.toFixed(2)}`
}

export const BANDWIDTH_UNITS = ["Mbps", "Gbps"] as const
export const TRAFFIC_UNITS = ["GB", "TB"] as const
const isUnlimited = (value: string) =>
    /^(unlimited|unmetered|不限|无限(?:流量)?|無限(?:流量)?)$/i.test(value.trim())
interface Bandwidth {
    amount: number
    unit: (typeof BANDWIDTH_UNITS)[number]
}
export function parseBandwidth(value: unknown): Bandwidth | "unlimited" | undefined {
    if (typeof value !== "string") return
    if (isUnlimited(value)) return "unlimited"
    const match = /^(\d+(?:\.\d+)?)\s*([MG])bps$/i.exec(value.trim())
    if (match && Number.isFinite(Number(match[1])) && Number(match[1]) > 0)
        return {
            amount: Number(match[1]),
            unit: match[2].toUpperCase() === "G" ? "Gbps" : "Mbps",
        }
}
export const writeBandwidth = ({ amount, unit }: Bandwidth) => `${amount}${unit}`
interface Traffic {
    amount: number
    unit: string
    bytes: number
    cycle?: Cycle
}
export function parseTraffic(value: unknown): Traffic | "unlimited" | undefined {
    if (typeof value !== "string") return
    const [size, period, ...rest] = value.trim().split("/")
    const cycle = period === undefined ? undefined : parseCycle(period)
    if (rest.length || (period !== undefined && !cycle)) return
    if (isUnlimited(size)) return "unlimited"
    const match = /^(\d+(?:\.\d+)?)\s*([KMGTP]?)i?B?$/i.exec(size.trim())
    if (!match) return
    const amount = Number(match[1])
    const unit = match[2].toUpperCase()
    const bytes = amount * 1024 ** " KMGTP".indexOf(unit || " ")
    if (Number.isFinite(bytes) && bytes > 0) return { amount, unit: `${unit}B`, bytes, cycle }
}
export const writeTraffic = ({ amount, unit, cycle }: Pick<Traffic, "amount" | "unit" | "cycle">) =>
    `${amount}${unit}${cycle ? `/${writeCycle(cycle)}` : ""}`

export const NO_EXPIRY = "0000-00-00T23:59:59+08:00"
export function parseNoteDate(value: unknown): number | undefined {
    if (typeof value !== "string" || !value.trim()) return
    if (value.startsWith("0000-00-00")) return 0
    const time = Date.parse(value.trim().replace(/^(\d{4}-\d\d-\d\d) /, "$1T"))
    return Number.isFinite(time) ? time : undefined
}
const noteZone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.exec(value)?.[0]
export function writeNoteDate(date: Date, source = ""): string {
    const pad = (value: number) => String(value).padStart(2, "0")
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const clock = /[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/.exec(source)?.[1] || "00:00:00"
    const offset = -new Date(`${day}T${clock}`).getTimezoneOffset()
    const zone =
        noteZone(source) ||
        `${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
    return `${day}T${clock}${zone}`
}
export function addCycle(start: string, cycle: Cycle): string | undefined {
    const time = parseNoteDate(start)
    if (!time) return
    const zone = noteZone(start)
    const offset = /([+-])(\d{2}):?(\d{2})$/.exec(start)
    const shift = offset
        ? (Number(offset[2]) * 60 + Number(offset[3])) * 60_000 * (offset[1] === "+" ? 1 : -1)
        : 0
    const local = new Date(time)
    const date = zone
        ? new Date(time + shift)
        : new Date(
              Date.UTC(
                  local.getFullYear(),
                  local.getMonth(),
                  local.getDate(),
                  local.getHours(),
                  local.getMinutes(),
                  local.getSeconds(),
                  local.getMilliseconds(),
              ),
          )
    if (cycle.unit === "Day" || cycle.unit === "Week")
        date.setUTCDate(date.getUTCDate() + cycle.count * (cycle.unit === "Week" ? 7 : 1))
    else {
        const day = date.getUTCDate()
        date.setUTCDate(1)
        date.setUTCMonth(date.getUTCMonth() + cycle.count * (cycle.unit === "Year" ? 12 : 1))
        const last = new Date(date.getTime())
        last.setUTCMonth(last.getUTCMonth() + 1, 0)
        date.setUTCDate(Math.min(day, last.getUTCDate()))
    }
    if (!Number.isFinite(date.getTime())) return
    return zone
        ? date.toISOString().slice(0, -1) + zone
        : writeNoteDate(
              new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
              start,
          )
}
export function splitTags(value: string): string[] {
    return value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
}

export const TRAFFIC_TYPES = [
    { value: "2", mode: "sum" },
    { value: "1", mode: "out" },
    { value: "3", mode: "max" },
] as const
export type TrafficBilling = (typeof TRAFFIC_TYPES)[number]["mode"]
export const parseTrafficType = (value: unknown): TrafficBilling =>
    TRAFFIC_TYPES.find((item) => item.value === (typeof value === "string" ? value.trim() : value))
        ?.mode ?? "max"
