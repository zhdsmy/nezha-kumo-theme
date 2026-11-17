// Adapted from zool-theme/tests/actual-cost.test.ts (MIT, luoleiorg).
import { afterEach, describe, expect, it, vi } from "vitest"

import { nezha, parseActualCost, parsePublicNote } from "../src/adapters/nezha"

afterEach(() => vi.unstubAllGlobals())

describe("private actual expenses", () => {
    it("parses ISO amounts and preserves a real zero", () => {
        expect(parseActualCost('{"billingDataMod":{"actualAmount":"CNY 0.00"}}')).toEqual({
            amount: 0,
            currency: "CNY",
        })
        expect(parseActualCost('{"billingDataMod":{"actualAmount":"usd 12.50"}}')).toEqual({
            amount: 12.5,
            currency: "USD",
        })
    })

    it.each([
        undefined,
        "",
        "plain private note",
        "null",
        "[]",
        "{",
        '{"billingDataMod":null}',
        ...["", "CNY -1", "0", "USD Infinity", "USD 1e500", "USD 1 extra"].map((actualAmount) =>
            JSON.stringify({ billingDataMod: { actualAmount } }),
        ),
        JSON.stringify({ billingDataMod: { actualAmount: 0 } }),
        JSON.stringify({ billingDataMod: { actualAmount: `USD ${"9".repeat(400)}` } }),
    ])("inherits the displayed price for absent or invalid private amounts: %s", (note) => {
        expect(parseActualCost(note)).toBeUndefined()
    })

    it("never reads actual expenses from public metadata", () => {
        const mapped = parsePublicNote(
            '{"billingDataMod":{"amount":"USD 10.00","actualAmount":"CNY 14.00","cycle":"Month"}}',
        )
        expect(mapped.price).toBe(10)
        expect(mapped).not.toHaveProperty("actualAmount")
        expect(mapped).not.toHaveProperty("actualCost")
    })

    it("reads only valid overrides from the existing protected endpoint without caching", async () => {
        const fetch = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    success: true,
                    data: [
                        { id: 1, note: '{"billingDataMod":{"actualAmount":"CNY 0.00"}}' },
                        { id: 2, note: '{"billingDataMod":{"actualAmount":""}}' },
                    ],
                }),
            ),
        )
        vi.stubGlobal("fetch", fetch)
        expect(await nezha.loadActualCosts!()).toEqual({ "1": { amount: 0, currency: "CNY" } })
        expect(fetch.mock.calls[0][0]).toBe("/api/v1/server")
        expect(fetch.mock.calls[0][1]).toMatchObject({
            cache: "no-store",
            credentials: "same-origin",
        })
    })

    it("rejects a private API failure instead of silently substituting displayed expenses", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response('{"success":false,"error":"denied"}')),
        )
        await expect(nezha.loadActualCosts!()).rejects.toThrow("Private billing unavailable")
    })
})

describe("private billing period compatibility", () => {
    it.each(["CNY 60.00", "USD 12.50", "EUR 9.99", "HKD 300.00"])(
        "keeps the existing currency-plus-number format without inventing a period: %s",
        (actualAmount) => {
            const [currency, amount] = actualAmount.split(" ")
            expect(parseActualCost(JSON.stringify({ billingDataMod: { actualAmount } }))).toEqual({
                currency,
                amount: Number(amount),
            })
        },
    )
    it("returns an explicit actual-cost period without changing the no-period result", () => {
        expect(parseActualCost('{"billingDataMod":{"actualAmount":"CNY 300.00/Year"}}')).toEqual({
            amount: 300,
            currency: "CNY",
            cycle: 365,
        })
    })
})
