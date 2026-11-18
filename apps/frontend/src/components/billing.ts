// Adapted from zool-theme/src/components/bits.tsx (MIT, luoleiorg).
import { useMoney } from "@/app/money"
import { useStore } from "@/app/store"
import { convertAmount } from "@/core/cost"
import { resolveExpiry } from "@/core/expiry"
import { formatBytes, formatMoney, monthlyCost } from "@/core/format"
import type { NodeInfo } from "@/core/model"
import { useTranslation } from "react-i18next"

export function useBilling() {
    const { t } = useTranslation()
    const loggedIn = useStore((s) => s.session.loggedIn)
    const actualCosts = useStore((s) => s.actualCosts)
    const rates = useStore((s) => s.exchangeRates)
    const { currency, period } = useMoney()
    const cycle = (days: number) => {
        if (days <= 0) return days === -1 ? ` ${t("unit.oneTime")}` : ""
        if (days >= 28 && days <= 31) return t("unit.perMonth")
        if (days >= 360 && days <= 366) return t("unit.perYear")
        return t("unit.perDays", { count: days })
    }
    const price = (n: NodeInfo) => {
        if (n.price === -2) return t("metric.payAsYouGo")
        if (n.price === -1) return t("metric.free")
        if (!(n.price > 0)) return ""
        return money(n.price, n.currency, n.billingCycle)
    }
    const money = (amount: number, source: string, days: number) => {
        // a recurring bill is restated per month or year; one-time and unset cycles stay as they are
        const value = days > 0 ? monthlyCost(amount, days) * (period === "year" ? 12 : 1) : amount
        const suffix =
            days > 0 ? t(period === "year" ? "unit.perYear" : "unit.perMonth") : cycle(days)
        const converted = convertAmount(value, source, currency, rates?.rates)
        return converted === null ? "—" : `${formatMoney(converted, currency)}${suffix}`
    }
    return {
        price,
        actualPrice(n: NodeInfo) {
            if (!loggedIn || actualCosts === null) return ""
            const actual = actualCosts[n.id]
            return actual
                ? money(actual.amount, actual.currency, actual.cycle ?? n.billingCycle)
                : price(n)
        },
        quota(n: NodeInfo) {
            if (n.trafficLimit < 0) return t("metric.unknown")
            if (n.trafficLimit === 0) return t("metric.unlimited")
            return `${formatBytes(n.trafficLimit)}${cycle(n.trafficLimitPeriod ?? 0)}`
        },
        expiry(n: NodeInfo): { text: string; at: number | null; level?: "warn" | "danger" } | null {
            const e = resolveExpiry(n)
            if (!e) return null
            switch (e.kind) {
                case "longTerm":
                    return { text: t("expiry.longTerm"), at: e.at }
                case "expired":
                    return { text: t("expiry.expired"), at: e.at, level: "danger" }
                case "expiring":
                    return {
                        text:
                            e.days === 0
                                ? t("expiry.today")
                                : t("expiry.inDays", { count: e.days }),
                        at: e.at,
                        level: e.level,
                    }
            }
        },
    }
}
