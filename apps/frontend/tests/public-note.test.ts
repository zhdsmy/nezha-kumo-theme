import { describe, expect, it } from "vitest"

import { parseActualCost, parsePublicNote } from "../src/adapters/nezha"
import { trafficUsed } from "../src/core/format"
import legacyNotes from "./fixtures/public-notes-legacy.json"
import syntheticNotes from "./fixtures/public-notes-synthetic.json"

describe("shared public-note compatibility", () => {
    it.each([
        ["Day", 1],
        ["Week", 7],
        ["Quarter", 90],
        ["HalfYear", 182],
        ["2 年", 730],
        ["3Month", 90],
    ])("reads %s consistently", (cycle, days) => {
        expect(parsePublicNote(JSON.stringify({ billingDataMod: { cycle } })).billingCycle).toBe(
            days,
        )
    })
    it("reads the generator amount suffix and space-separated date", () => {
        expect(
            parsePublicNote(
                JSON.stringify({
                    billingDataMod: {
                        cycle: "",
                        amount: "$3.99/2年",
                        endDate: "2027-02-11 23:59:59+08:00",
                    },
                    planDataMod: { trafficVol: "1TB/月" },
                }),
            ),
        ).toMatchObject({
            price: 3.99,
            currency: "$",
            billingCycle: 730,
            expiredAt: Date.parse("2027-02-11T23:59:59+08:00"),
            trafficLimit: 1024 ** 4,
            trafficLimitPeriod: 30,
        })
    })
    it.each([
        ["￥9.99", "CNY", 9.99],
        ["9.99CNY", "CNY", 9.99],
        ["C$9.99", "CAD", 9.99],
    ])("shares amount rules with private actual costs: %s", (actualAmount, currency, amount) => {
        expect(parseActualCost(JSON.stringify({ billingDataMod: { actualAmount } }))).toEqual({
            currency,
            amount,
        })
    })
})

it.each([
    ["1", 10, "out"],
    ["2", 110, "sum"],
    [" 2 ", 110, "sum"],
    [" 1 ", 10, "out"],
    ["3", 100, "max"],
    [undefined, 100, "max"],
])("trafficType %s bills the correct direction", (trafficType, expected, mode) => {
    const parsed = parsePublicNote(JSON.stringify({ planDataMod: { trafficType } }))
    expect(parsed.trafficLimitType).toBe(mode)
    expect(trafficUsed(parsed.trafficLimitType, 10, 100)).toBe(expected)
})

it("preserves all 21 synthetic public-note format cases", () => {
    expect(syntheticNotes).toHaveLength(21)
    for (const { public_note, expected } of syntheticNotes) {
        let outbound = false
        let trafficLimitTypeExplicit = false
        try {
            outbound = JSON.parse(public_note).planDataMod?.trafficType === "1"
            trafficLimitTypeExplicit = !!JSON.parse(public_note).planDataMod?.trafficType?.trim()
        } catch {
            /* The free-form note is also a regression fixture. */
        }
        expect(parsePublicNote(public_note)).toEqual({
            ...expected,
            trafficLimitTypeExplicit,
            trafficLimitType: outbound ? "out" : expected.trafficLimitType,
        })
    }
})

it.each([
    ["免费节点", -1, "$"],
    ["45元", 45, "元"],
    ["¥ 1,200", 1200, "¥"],
    ["0.00", 0, "$"],
    ["9.99C", 9.99, "C"],
])("keeps legacy amount display for %s", (amount, price, currency) => {
    expect(parsePublicNote(JSON.stringify({ billingDataMod: { amount } }))).toMatchObject({
        price,
        currency,
    })
})

it.each([undefined, "", "  ", "4"])("keeps implicit traffic mode hidden for %s", (trafficType) => {
    expect(parsePublicNote(JSON.stringify({ planDataMod: { trafficType } }))).toMatchObject({
        trafficLimitType: "max",
        trafficLimitTypeExplicit: false,
    })
})

it("matches a17fb3d for legacy formats with explicit thousands-separator correction", () => {
    for (const { public_note, expected } of legacyNotes) {
        const source = JSON.parse(public_note)
        const grouped = source.billingDataMod?.amount === "¥ 1,200"
        expect(parsePublicNote(public_note)).toEqual({
            ...expected,
            ...(grouped ? { price: 1200, currency: "¥" } : {}),
            trafficLimitTypeExplicit: !!source.planDataMod?.trafficType?.trim(),
        })
    }
})
