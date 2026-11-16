// Adapted from zool-theme/src/app/money.ts (MIT, luoleiorg).
import { displayCurrency } from "@/core/cost"
import { readStorage, writeStorage } from "@/core/storage"
import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

/**
 * How bills are shown: always in the interface language's currency, restated per month or
 * year. The period is chosen on the home page and kept per browser.
 */
export type MoneyPeriod = "month" | "year"

const KEY = "nkt:period"
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
}
const getPeriod = (): MoneyPeriod => (readStorage(KEY) === "year" ? "year" : "month")

export const setMoneyPeriod = (period: MoneyPeriod) => {
    writeStorage(KEY, period)
    listeners.forEach((l) => l())
}

export function useMoney(): { currency: string; period: MoneyPeriod } {
    const { i18n } = useTranslation()
    const period = useSyncExternalStore(subscribe, getPeriod, getPeriod)
    return { currency: displayCurrency(i18n.resolvedLanguage), period }
}
