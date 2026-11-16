// Adapted from zool-theme/src/app/money.ts (MIT, luoleiorg).
import { displayCurrency } from "@/core/cost"
import { readStorage, writeStorage } from "@/core/storage"
import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

/**
 * How bills are shown, chosen on the home page and kept per browser. `original` leaves each
 * node's own currency or billing cycle alone; the default is the locale currency and each
 * node's own cycle, which is how bills read before the choice existed.
 */
type MoneyCurrency = "original" | string
export type MoneyPeriod = "original" | "month" | "year"

const KEYS = { currency: "nkt:currency", period: "nkt:period" } as const
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
}
const write = (key: string, value: string) => {
    writeStorage(key, value)
    listeners.forEach((l) => l())
}

const getCurrency = () => {
    const v = readStorage(KEYS.currency)
    return v === "original" || (v && /^[A-Z]{3}$/.test(v)) ? v : null
}
const getPeriod = (): MoneyPeriod => {
    const v = readStorage(KEYS.period)
    return v === "month" || v === "year" ? v : "original"
}

export const setMoneyCurrency = (currency: MoneyCurrency) => write(KEYS.currency, currency)
export const setMoneyPeriod = (period: MoneyPeriod) => write(KEYS.period, period)

export function useMoney(): { currency: MoneyCurrency; period: MoneyPeriod } {
    const { i18n } = useTranslation()
    const currency = useSyncExternalStore(subscribe, getCurrency, getCurrency)
    const period = useSyncExternalStore(subscribe, getPeriod, getPeriod)
    return { currency: currency ?? displayCurrency(i18n.resolvedLanguage), period }
}
