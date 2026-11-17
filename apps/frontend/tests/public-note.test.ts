import { describe, expect, it } from "vitest"

import { parseActualCost, parsePublicNote } from "../src/adapters/nezha"

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
