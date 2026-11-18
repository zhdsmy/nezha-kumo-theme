import { createInstance } from "i18next"
import { initReactI18next } from "react-i18next"
import { beforeAll, describe, expect, it } from "vitest"

import { EXPIRY_DANGER_DAYS, EXPIRY_WARN_DAYS, resolveExpiry } from "../src/core/expiry"
import { needsAttention, nodeIssues } from "../src/core/fleet"
import type { NodeInfo } from "../src/core/model"
import en from "../src/i18n/locales/en.json"
import ja from "../src/i18n/locales/ja.json"
import zhCN from "../src/i18n/locales/zh-CN.json"
import zhTW from "../src/i18n/locales/zh-TW.json"
import { emptySnapshot } from "./snapshot"

const i18n = createInstance()
beforeAll(async () => {
    await i18n.use(initReactI18next).init({
        resources: {
            en: { translation: en },
            "zh-CN": { translation: zhCN },
            "zh-TW": { translation: zhTW },
            ja: { translation: ja },
        },
        lng: "en",
        interpolation: { escapeValue: false },
    })
})

const makeNode = (overrides: Partial<NodeInfo> = {}): NodeInfo => ({
    id: "n1",
    name: "Node 1",
    groups: [],
    region: "JP",
    os: "Debian",
    arch: "amd64",
    cpuName: "EPYC",
    cpuCores: 2,
    virtualization: "kvm",
    gpuName: "",
    memTotal: 100,
    swapTotal: 0,
    diskTotal: 100,
    weight: 0,
    price: 10,
    currency: "$",
    billingCycle: 30,
    autoRenewal: false,
    expiredAt: null,
    trafficLimit: 0,
    trafficLimitType: "max",
    note: "",
    ...overrides,
})

const localAt = (y: number, m: number, d: number, h = 12, min = 0, s = 0) =>
    new Date(y, m - 1, d, h, min, s).getTime()

describe("7-day expiry attention threshold", () => {
    const now = localAt(2026, 11, 18, 10, 0, 0)
    const onlineSnap = { ...emptySnapshot(true), at: now, memTotal: 100, diskTotal: 100 }

    it("shares the 7-day danger threshold between resolveExpiry and nodeIssues", () => {
        expect(EXPIRY_DANGER_DAYS).toBe(7)
        expect(EXPIRY_WARN_DAYS).toBe(30)

        // Today (day 0, later today)
        const todayNode = makeNode({ expiredAt: localAt(2026, 11, 18, 23, 59, 59) })
        expect(resolveExpiry(todayNode, now)).toEqual({
            kind: "expiring",
            at: todayNode.expiredAt,
            days: 0,
            level: "danger",
        })
        expect(needsAttention(todayNode, onlineSnap, true, now)).toBe(true)
        expect(nodeIssues(todayNode, onlineSnap, true, now)).toEqual([
            { kind: "expiring", days: 0 },
        ])

        // Day 7 (inclusive boundary)
        const day7Node = makeNode({ expiredAt: localAt(2026, 11, 25, 23, 59, 59) })
        expect(resolveExpiry(day7Node, now)).toEqual({
            kind: "expiring",
            at: day7Node.expiredAt,
            days: 7,
            level: "danger",
        })
        expect(needsAttention(day7Node, onlineSnap, true, now)).toBe(true)
        expect(nodeIssues(day7Node, onlineSnap, true, now)).toEqual([{ kind: "expiring", days: 7 }])

        // Day 8 (outside 7-day danger window -> warn in list, NOT needing attention)
        const day8Node = makeNode({ expiredAt: localAt(2026, 11, 26, 10, 0, 0) })
        expect(resolveExpiry(day8Node, now)).toEqual({
            kind: "expiring",
            at: day8Node.expiredAt,
            days: 8,
            level: "warn",
        })
        expect(needsAttention(day8Node, onlineSnap, true, now)).toBe(false)
        expect(nodeIssues(day8Node, onlineSnap, true, now)).toEqual([])

        // Already expired -> still counts as expired attention
        const expiredNode = makeNode({ expiredAt: now - 1_000 })
        expect(resolveExpiry(expiredNode, now)).toEqual({
            kind: "expired",
            at: expiredNode.expiredAt,
        })
        expect(needsAttention(expiredNode, onlineSnap, true, now)).toBe(true)
        expect(nodeIssues(expiredNode, onlineSnap, true, now)).toEqual([{ kind: "expired" }])

        // Auto-renewal enabled within 7 days -> excluded from expiring attention
        const autoRenewNode = makeNode({
            expiredAt: localAt(2026, 11, 20, 12, 0, 0),
            autoRenewal: true,
        })
        expect(needsAttention(autoRenewNode, onlineSnap, true, now)).toBe(false)
        expect(nodeIssues(autoRenewNode, onlineSnap, true, now)).toEqual([])
    })

    it.each([
        ["en", "Expires today", "Expires in 1 day", "Expires in 7 days"],
        ["zh-CN", "今天到期", "1 天后到期", "7 天后到期"],
        ["zh-TW", "今天到期", "1 天後到期", "7 天後到期"],
        ["ja", "今日が期限", "1 日後に期限", "7 日後に期限"],
    ] as const)("translates dropdown expiry reasons in %s", async (lng, today, one, seven) => {
        await i18n.changeLanguage(lng)
        expect(i18n.t("status.expiringToday")).toBe(today)
        expect(i18n.t("status.expiringInDays", { count: 1 })).toBe(one)
        expect(i18n.t("status.expiringInDays", { count: 7 })).toBe(seven)
    })
})
