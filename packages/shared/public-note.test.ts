import assert from "node:assert/strict"
import { test } from "node:test"

import {
    addCycle,
    cycleDays,
    parseAmount,
    parseBandwidth,
    parseCycle,
    parseNoteDate,
    parseTraffic,
    splitTags,
    writeAmount,
    writeBandwidth,
    writeCycle,
    writeTraffic,
} from "./public-note.ts"

const dialects: [string, number, "Day" | "Week" | "Month" | "Year"][] = [
    ["d day days daily 天 日 日間 每天 每日", 1, "Day"],
    ["w wk week weeks weekly 周 週 週間 每周 每週", 1, "Week"],
    ["月 m mo month monthly months 个月 個月 か月 ヶ月 箇月 每月 毎月", 1, "Month"],
    ["q qr quarter quarterly 季 季度", 3, "Month"],
    ["h half halfyear half-year semi semiannual semiannually semi-annually 半 半年", 6, "Month"],
    ["年 y yr year yearly years annual annually 年間 每年 毎年", 1, "Year"],
    ["biennial 两年 兩年 二年 2y", 2, "Year"],
    ["triennial 三年 3y", 3, "Year"],
]
test("all documented dialects and case variants share one cycle definition", () => {
    for (const [words, count, unit] of dialects)
        for (const word of words.split(" ")) {
            for (const variant of [word, word.toUpperCase()])
                assert.deepEqual(parseCycle(variant), { count, unit }, variant)
        }
    for (const unit of ["Day", "Week", "Month", "Year"] as const)
        for (const count of [1, 2, 3, 6, 12, 999]) {
            assert.deepEqual(parseCycle(writeCycle({ count, unit })), { count, unit })
            assert.deepEqual(parseCycle(`${count} ${unit}`), { count, unit })
        }
    assert.deepEqual(parseCycle("2 年"), { count: 2, unit: "Year" })
    for (const invalid of [
        "两月付",
        "0Day",
        "-1Day",
        "1.5Month",
        null,
        Infinity,
        "999999999999999999999Year",
    ])
        assert.equal(parseCycle(invalid), undefined)
    assert.equal(cycleDays(parseCycle("HalfYear")), 182)
    assert.equal(cycleDays(parseCycle("Quarter")), 90)
    assert.equal(cycleDays(parseCycle("2Year")), 730)
})
test("generator currencies and amount-embedded periods", () => {
    for (const [text, currency] of [
        ["￥9.99", "CNY"],
        ["$9.99", "USD"],
        ["€9.99", "EUR"],
        ["C$9.99", "CAD"],
        ["£9.99", "GBP"],
        ["9.99CNY", "CNY"],
        ["9.99C", "CAD"],
        ["USD 9.99", "USD"],
        ["9.99AUD", "AUD"],
    ]) {
        assert.equal(parseAmount(text)?.currency, currency)
        assert.equal(parseAmount(text)?.amount, 9.99)
    }
    assert.deepEqual(parseAmount("$3.99/2年")?.cycle, { count: 2, unit: "Year" })
    assert.equal(parseAmount("200EUR")?.amount, 200)
    assert.equal(writeAmount(45, "USD"), "USD 45.00")
    assert.equal(writeAmount(0, "USD"), "0")
    assert.equal(writeAmount(-1, "USD"), "-1")
    for (const invalid of [
        "USD -1",
        "USD 1 extra",
        "USD 1e500",
        "USD Infinity",
        "$3.99/unknown",
        "USD 12USD",
    ])
        assert.equal(parseAmount(invalid), undefined)
})
test("plan units, explicit unlimited, dates and tags", () => {
    for (const unit of ["MB", "GB", "TB", "PB"]) {
        const parsed = parseTraffic(`1${unit}/月`)
        assert.ok(parsed && parsed !== "unlimited")
        assert.equal(writeTraffic(parsed), `1${unit}/Month`)
    }
    for (const text of ["30Mbps", "1Gbps"]) {
        const parsed = parseBandwidth(text)
        assert.ok(parsed && parsed !== "unlimited")
        assert.equal(writeBandwidth(parsed), text)
    }
    assert.equal(parseTraffic("Unlimited"), "unlimited")
    assert.equal(parseBandwidth("Unlimited"), "unlimited")
    for (const invalid of ["1GB/nope", "1GB/Month/Year", "0GB", {}, "1..5TB"])
        assert.equal(parseTraffic(invalid), undefined)
    assert.equal(
        parseNoteDate("2026-11-11 23:59:59+08:00"),
        Date.parse("2026-11-11T23:59:59+08:00"),
    )
    assert.equal(parseNoteDate("0000-00-00T23:59:59+08:00"), 0)
    assert.equal(
        addCycle("2026-01-31T12:00:00Z", { count: 1, unit: "Month" }),
        "2026-02-28T12:00:00.000Z",
    )
    assert.deepEqual(splitTags(" CN2，cn2、4837[联通];CMI "), ["CN2", "4837[联通]", "CMI"])
})
