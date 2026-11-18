import { createInstance } from "i18next"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider, initReactI18next } from "react-i18next"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { parsePublicNote } from "../src/adapters/nezha"
import { useBilling } from "../src/components/billing"
import { nodeCondition } from "../src/core/condition"
import { EXPIRY_DANGER_DAYS, EXPIRY_WARN_DAYS, addCycles, resolveExpiry } from "../src/core/expiry"
import { needsAttention, nodeIssues, sortNodes } from "../src/core/fleet"
import type { NodeInfo } from "../src/core/model"
import en from "../src/i18n/locales/en.json"
import ja from "../src/i18n/locales/ja.json"
import zhCN from "../src/i18n/locales/zh-CN.json"
import zhTW from "../src/i18n/locales/zh-TW.json"
import { emptySnapshot } from "./snapshot"

vi.mock("../src/app/store", () => ({
    useStore: (select: (state: unknown) => unknown) =>
        select({
            session: { loggedIn: false },
            actualCosts: null,
            exchangeRates: null,
        }),
}))

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

const makeNoteNode = (id: string, billingDataMod: Record<string, string>) =>
    makeNode({
        id,
        ...parsePublicNote(JSON.stringify({ billingDataMod })),
    })

const localAt = (y: number, m: number, d: number, h = 12, min = 0, s = 0) =>
    new Date(y, m - 1, d, h, min, s).getTime()

function renderBillingExpiry(node: NodeInfo) {
    function Probe() {
        const b = useBilling()
        const e = b.expiry(node)
        return createElement(
            "span",
            { "data-level": e?.level },
            e ? `${e.at ?? "none"}|${e.text}` : "null",
        )
    }
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(Probe)))
}

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
            level: "danger",
        })
        expect(needsAttention(expiredNode, onlineSnap, true, now)).toBe(true)
        expect(nodeIssues(expiredNode, onlineSnap, true, now)).toEqual([{ kind: "expired" }])

        // Auto-renewal enabled within 7 days -> excluded from expiring attention
        const autoRenewNode = makeNode({
            expiredAt: localAt(2026, 11, 20, 12, 0, 0),
            autoRenewal: true,
            cycle: { count: 1, unit: "Month" },
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

describe("auto-renewal calendar cycle advancement", () => {
    const onlineSnap = {
        ...emptySnapshot(true),
        at: Date.parse("2026-11-18T10:00:00+08:00"),
        memTotal: 100,
        diskTotal: 100,
    }

    it("advances past dates by natural month, year, and quarter while keeping NodeInfo.expiredAt untouched", () => {
        const now = Date.parse("2026-11-18T10:00:00+08:00")

        const monthly = makeNoteNode("m", {
            endDate: "2026-08-15T06:07:08+08:00",
            autoRenewal: "1",
            cycle: "Month",
        })
        expect(monthly.expiredAt).toBe(Date.parse("2026-08-15T06:07:08+08:00"))
        expect(resolveExpiry(monthly, now)).toEqual({
            kind: "renews",
            at: Date.parse("2026-12-15T06:07:08+08:00"),
            days: 27,
        })
        expect(nodeCondition(monthly, onlineSnap, now, true).expired).toBe(false)
        expect(needsAttention(monthly, onlineSnap, true, now)).toBe(false)

        const yearly = makeNoteNode("y", {
            endDate: "2024-02-29T06:07:08+08:00",
            autoRenewal: "1",
            cycle: "Year",
        })
        expect(resolveExpiry(yearly, now)).toEqual({
            kind: "renews",
            at: Date.parse("2027-02-28T06:07:08+08:00"),
            days: 102,
        })
        // 4th annual cycle from 2024-02-29 lands back on leap day 2028-02-29
        expect(resolveExpiry(yearly, Date.parse("2027-03-01T00:00:00+08:00"))?.at).toBe(
            Date.parse("2028-02-29T06:07:08+08:00"),
        )

        const quarterly = makeNoteNode("q", {
            endDate: "2026-01-20T09:30:00+08:00",
            autoRenewal: "1",
            cycle: "Quarter",
        })
        // Jan 20 -> Apr 20 -> Jul 20 -> Oct 20 -> Jan 20, 2027 (first > Nov 18, 2026)
        expect(resolveExpiry(quarterly, now)).toEqual({
            kind: "renews",
            at: Date.parse("2027-01-20T09:30:00+08:00"),
            days: 63,
        })
    })

    it("steps Jan 31 monthly to Feb 28/29 then Mar 31 without cumulative drift, preserving time and timezone", () => {
        const jan31NonLeap = makeNoteNode("jan26", {
            endDate: "2026-01-31T06:07:08-05:00",
            autoRenewal: "1",
            cycle: "Month",
        })
        // Step 1: after Jan 31 -> Feb 28 at 06:07:08-05:00
        expect(resolveExpiry(jan31NonLeap, Date.parse("2026-02-01T00:00:00-05:00"))?.at).toBe(
            Date.parse("2026-02-28T06:07:08-05:00"),
        )
        // Step 2: after Feb 28 -> Mar 31 (NOT Mar 28!) at 06:07:08-05:00
        expect(resolveExpiry(jan31NonLeap, Date.parse("2026-02-28T06:07:08-05:00"))?.at).toBe(
            Date.parse("2026-03-31T06:07:08-05:00"),
        )

        // Leap year 2028: Jan 31 -> Feb 29 -> Mar 31
        const jan31Leap = makeNoteNode("jan28", {
            endDate: "2028-01-31T23:59:59+08:00",
            autoRenewal: "1",
            cycle: "Month",
        })
        expect(resolveExpiry(jan31Leap, Date.parse("2028-02-01T00:00:00+08:00"))?.at).toBe(
            Date.parse("2028-02-29T23:59:59+08:00"),
        )
        expect(resolveExpiry(jan31Leap, Date.parse("2028-03-01T00:00:00+08:00"))?.at).toBe(
            Date.parse("2028-03-31T23:59:59+08:00"),
        )

        // Direct addCycles check for Day/Week with offset
        expect(
            addCycles(Date.parse("2026-01-01T08:00:00Z"), { count: 2, unit: "Week" }, 3, 0),
        ).toBe(Date.parse("2026-02-12T08:00:00Z"))
    })

    it("never marks auto-renew within 7 days or past original expiry as attention or danger", async () => {
        const now = Date.now()
        const snap = { ...onlineSnap, at: now }
        const soonRenew = makeNode({
            expiredAt: now - 5 * 86_400_000,
            autoRenewal: true,
            cycle: { count: 1, unit: "Week" },
        })
        const state = resolveExpiry(soonRenew, now)
        expect(state?.kind).toBe("renews")
        expect(needsAttention(soonRenew, snap, true, now)).toBe(false)
        expect(nodeIssues(soonRenew, snap, true, now)).toEqual([])

        await i18n.changeLanguage("zh-CN")
        const html = renderBillingExpiry(soonRenew)
        expect(html).toContain("天后续费")
        expect(html).not.toContain("data-level=")
    })

    it("handles unrecognized cycle auto-renewal and preserves long-term display", async () => {
        const now = Date.now()
        const snap = { ...onlineSnap, at: now }
        const unknownCycle = makeNoteNode("unk", {
            endDate: "2025-01-01T00:00:00+08:00",
            autoRenewal: "1",
            cycle: "Fortnight",
        })
        expect(resolveExpiry(unknownCycle, now)).toEqual({ kind: "autoRenew", at: null })
        expect(nodeCondition(unknownCycle, snap, now, true).expired).toBe(false)
        expect(needsAttention(unknownCycle, snap, true, now)).toBe(false)

        await i18n.changeLanguage("zh-CN")
        expect(renderBillingExpiry(unknownCycle)).toBe("<span>none|自动续费</span>")

        // Permanent (expiredAt === 0) stays longTerm even when autoRenewal is enabled
        const perm = makeNoteNode("perm", {
            endDate: "0000-00-00T23:59:59+08:00",
            autoRenewal: "1",
            cycle: "Month",
        })
        expect(resolveExpiry(perm, now)).toEqual({ kind: "longTerm", at: null })
        expect(renderBillingExpiry(perm)).toBe("<span>none|长期</span>")

        // Over 3650 days stays longTerm
        const farFuture = makeNoteNode("far", {
            endDate: "2040-01-01T00:00:00+08:00",
            autoRenewal: "1",
            cycle: "Year",
        })
        expect(resolveExpiry(farFuture, now)).toEqual({
            kind: "longTerm",
            at: Date.parse("2040-01-01T00:00:00+08:00"),
        })
        expect(renderBillingExpiry(farFuture)).toContain("|长期</span>")
    })

    it("sorts by next renewal date and places dateless nodes after dated nodes in both directions", () => {
        const now = Date.parse("2026-11-18T10:00:00+08:00")
        const expiredNormal = makeNoteNode("a-expired", {
            endDate: "2026-11-01T00:00:00+08:00",
            autoRenewal: "0",
            cycle: "Month",
        })
        const normalSoon = makeNoteNode("b-soon", {
            endDate: "2026-11-25T00:00:00+08:00",
            autoRenewal: "0",
            cycle: "Month",
        })
        // Original date was Oct 10 (before Nov 1!), but auto-renews monthly -> Dec 10, 2026!
        const rolledAuto = makeNoteNode("c-rolled", {
            endDate: "2026-10-10T00:00:00+08:00",
            autoRenewal: "1",
            cycle: "Month",
        })
        const unknownAuto = makeNoteNode("d-unk-auto", {
            endDate: "2025-01-01T00:00:00+08:00",
            autoRenewal: "1",
            cycle: "Unknown",
        })
        const permanent = makeNoteNode("e-perm", {
            endDate: "0000-00-00T23:59:59+08:00",
            autoRenewal: "0",
        })
        const unset = makeNode({ id: "f-unset", expiredAt: null })

        const fleet = [unset, unknownAuto, rolledAuto, permanent, normalSoon, expiredNormal]
        expect(sortNodes(fleet, {}, "expiry", false, now).map((n) => n.id)).toEqual([
            "a-expired",
            "b-soon",
            "c-rolled",
            "d-unk-auto",
            "e-perm",
            "f-unset",
        ])
        expect(sortNodes(fleet, {}, "expiry", true, now).map((n) => n.id)).toEqual([
            "c-rolled",
            "b-soon",
            "a-expired",
            "d-unk-auto",
            "e-perm",
            "f-unset",
        ])
    })

    it.each([
        ["en", "renews today", "renews in 1 day", "renews in 5 days", "auto-renew"],
        ["zh-CN", "今天续费", "1 天后续费", "5 天后续费", "自动续费"],
        ["zh-TW", "今天續約", "1 天後續約", "5 天後續約", "自動續約"],
        ["ja", "今日更新", "1 日後に更新", "5 日後に更新", "自動更新"],
    ] as const)("translates auto-renewal labels in %s", async (lng, today, one, five, auto) => {
        await i18n.changeLanguage(lng)
        expect(i18n.t("expiry.renewToday")).toBe(today)
        expect(i18n.t("expiry.renewInDays", { count: 1 })).toBe(one)
        expect(i18n.t("expiry.renewInDays", { count: 5 })).toBe(five)
        const unknownCycle = makeNoteNode("unk", { autoRenewal: "1", cycle: "Unknown" })
        expect(renderBillingExpiry(unknownCycle)).toBe(`<span>none|${auto}</span>`)
    })
})
