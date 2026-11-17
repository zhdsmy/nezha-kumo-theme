import { detectPublicNoteMode, parsePublicNote, patchPublicNote } from "@/lib/public-note"
import { expect, test } from "vitest"

const source =
    ' { "unknown" : [1e+2, {"escaped":"\\u4e2d"}], "billingDataMod" : { "cycle":"两月付", "amount" : "$3.99/2年", "startDate":"2026-11-11 00:00:00+08:00", "other": null }, "planDataMod": {"bandwidth":"30Mbps", "extra":"a，b"} } '
test("editing one field preserves every untouched JSON byte and unknown key", () => {
    expect(patchPublicNote(source, "planDataMod", "bandwidth", "50Mbps")).toBe(
        source.replace('"30Mbps"', '"50Mbps"'),
    )
    expect(detectPublicNoteMode(source)).toBe("structured")
    expect(parsePublicNote(source)).toMatchObject({ unknown: [100, { escaped: "中" }] })
})
test("only malformed JSON defaults to raw; odd valid structures survive unchanged", () => {
    expect(detectPublicNoteMode("plain text")).toBe("raw")
    for (const raw of ["null", "[]", '"note"', '{"billingDataMod":null}']) {
        expect(detectPublicNoteMode(raw)).toBe("structured")
        expect(patchPublicNote(raw, "billingDataMod", "amount", "0")).toBe(raw)
    }
})
test("clearing removes the key, including duplicates, and inserting retains other bytes", () => {
    for (const [raw, key, expected] of [
        ['{"a":"1","b":"2"}', "a", { b: "2" }],
        ['{"a":"1","b":"2"}', "b", { a: "1" }],
        ['{"a":"1"}', "a", {}],
        ['{"a":"1","a":"2"}', "a", {}],
    ] as const) {
        const next = patchPublicNote(`{"billingDataMod":${raw}}`, "billingDataMod", key, undefined)
        expect(JSON.parse(next).billingDataMod).toEqual(expected)
    }
    expect(patchPublicNote(' {"other":1e+2} ', "billingDataMod", "amount", "0")).toBe(
        ' {"other":1e+2,"billingDataMod":{"amount":"0"}} ',
    )
})
test("all plan inventory formats survive a no-op round trip exactly", () => {
    for (const raw of [
        '{"billingDataMod":{"amount":"CNY 45","cycle":"Quarter"}}',
        '{"billingDataMod":{"amount":"USD 12.00","cycle":"Year"}}',
        '{"planDataMod":{"trafficVol":"1TB/Month","bandwidth":"1Gbps"}}',
        source,
    ]) {
        expect(patchPublicNote(raw, "planDataMod", "unused", undefined)).toBe(raw)
    }
})
