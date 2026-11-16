// Adapted from zool-theme/tests/filter.test.ts (MIT, luoleiorg).
import { describe, expect, it } from "vitest"

import {
    groupCounts,
    matchGroups,
    parseFilterQuery,
    serializeFilterQuery,
} from "../src/core/filter"
import type { NodeInfo } from "../src/core/model"

const makeNode = (partial: Partial<NodeInfo> = {}): NodeInfo => ({
    id: "node-1",
    name: "Test node",
    groups: [],
    region: "US",
    os: "Linux",
    arch: "amd64",
    cpuName: "Test CPU",
    cpuCores: 2,
    virtualization: "kvm",
    gpuName: "",
    memTotal: 2 * 1024 ** 3,
    swapTotal: 0,
    diskTotal: 20 * 1024 ** 3,
    weight: 0,
    price: 0,
    currency: "USD",
    billingCycle: 0,
    autoRenewal: false,
    expiredAt: null,
    trafficLimit: 0,
    trafficLimitType: "sum",
    note: "",
    ...partial,
})

describe("filter query", () => {
    it("round-trips free-text group names as separate repeated parameters", () => {
        const filter = {
            groups: ["a&b", "a,b", "a;b", "two words", "中文分组", "🌏🚀", "中文 & , ; 🚀"],
            region: "JP",
        }
        const search = serializeFilterQuery("", filter)

        expect(new URLSearchParams(search).getAll("group")).toEqual(filter.groups)
        expect(parseFilterQuery(search)).toEqual(filter)
    })

    it("replaces old filter keys while preserving unrelated and repeated parameters", () => {
        const search = serializeFilterQuery("?lang=ja&tag=one&group=old&tag=two&region=US&empty=", {
            groups: ["中文 & 🚀"],
            region: "JP",
        })
        const query = new URLSearchParams(search)

        expect(parseFilterQuery(search)).toEqual({ groups: ["中文 & 🚀"], region: "JP" })
        expect(query.get("lang")).toBe("ja")
        expect(query.getAll("tag")).toEqual(["one", "two"])
        expect(query.get("empty")).toBe("")
        query.delete("group")
        query.delete("region")
        expect([...query]).toEqual([
            ["lang", "ja"],
            ["tag", "one"],
            ["tag", "two"],
            ["empty", ""],
        ])
    })

    it("serializes an empty selection to an empty string after removing old filter keys", () => {
        expect(serializeFilterQuery("", { groups: [], region: null })).toBe("")
        expect(
            serializeFilterQuery("?group=old&group=&region=JP", { groups: [], region: null }),
        ).toBe("")
    })

    it("keeps unrelated parameters when clearing the selection", () => {
        expect(
            serializeFilterQuery("?lang=ja&group=old&region=JP", { groups: [], region: null }),
        ).toBe("?lang=ja")
    })

    it("round-trips an explicitly selected ungrouped group", () => {
        const parsed = parseFilterQuery("?group=")
        expect(parsed).toEqual({ groups: [""] })
        const search = serializeFilterQuery("", { groups: parsed.groups ?? [], region: null })
        expect(search).toBe("?group=")
        expect(parseFilterQuery(search)).toEqual(parsed)
    })

    it("returns undefined for missing keys rather than treating them as explicit empty values", () => {
        const absent = parseFilterQuery("?lang=ja")
        expect(absent).toStrictEqual({})
        expect(absent.groups).toBeUndefined()
        expect(absent.region).toBeUndefined()
        expect(parseFilterQuery("")).toStrictEqual({})
        expect(parseFilterQuery("?group=")).toStrictEqual({ groups: [""] })
        expect(parseFilterQuery("?region=")).toStrictEqual({ region: null })
        expect(parseFilterQuery("?group=&region=")).toStrictEqual({ groups: [""], region: null })
    })
})

describe("matchGroups", () => {
    it("matches both grouped and ungrouped nodes when nothing is selected", () => {
        expect(matchGroups(makeNode({ groups: ["a"] }), [])).toBe(true)
        expect(matchGroups(makeNode(), [])).toBe(true)
    })

    it("matches any selected membership and rejects disjoint selections", () => {
        const node = makeNode({ groups: ["a", "b"] })
        expect(matchGroups(node, ["missing", "b"])).toBe(true)
        expect(matchGroups(node, ["a"])).toBe(true)
        expect(matchGroups(node, ["missing"])).toBe(false)
        expect(matchGroups(node, [""])).toBe(false)
    })

    it("matches ungrouped nodes only through the empty group when a selection exists", () => {
        const node = makeNode()
        expect(matchGroups(node, [""])).toBe(true)
        expect(matchGroups(node, ["a", ""])).toBe(true)
        expect(matchGroups(node, ["a", "b"])).toBe(false)
    })
})

describe("groupCounts", () => {
    it("counts each membership of multi-group nodes and counts ungrouped nodes under the empty name", () => {
        expect(
            groupCounts([
                makeNode({ id: "shared", groups: ["a", "b"], weight: 1 }),
                makeNode({ id: "a", groups: ["a"], weight: 2 }),
                makeNode({ id: "ungrouped-1", weight: 3 }),
                makeNode({ id: "ungrouped-2", weight: 4 }),
            ]),
        ).toEqual([
            ["a", 2],
            ["b", 1],
            ["", 2],
        ])
    })

    it("orders groups by their minimum node weight rather than insertion order or count", () => {
        expect(
            groupCounts([
                makeNode({ id: "heavy-a", groups: ["a"], weight: 100 }),
                makeNode({ id: "b", groups: ["b"], weight: 20 }),
                makeNode({ id: "light-a", groups: ["a"], weight: 5 }),
                makeNode({ id: "ungrouped", weight: 10 }),
            ]),
        ).toEqual([
            ["a", 2],
            ["", 1],
            ["b", 1],
        ])
    })

    it("returns no counts for no nodes", () => {
        expect(groupCounts([])).toEqual([])
    })
})
