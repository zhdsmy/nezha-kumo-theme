// Adapted from zool-theme/tests/filter.test.ts (MIT, luoleiorg).
import { describe, expect, it } from "vitest"

import {
    groupCounts,
    matchGroups,
    parseFilterQuery,
    regionCounts,
    resolvePeerGroup,
    resolveRegion,
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
            groupCounts(
                [
                    makeNode({ id: "shared", groups: ["a", "b"], weight: 1 }),
                    makeNode({ id: "a", groups: ["a"], weight: 2 }),
                    makeNode({ id: "ungrouped-1", weight: 3 }),
                    makeNode({ id: "ungrouped-2", weight: 4 }),
                ],
                ["a", "b"],
            ),
        ).toEqual([
            ["a", 2],
            ["b", 1],
            ["", 2],
        ])
    })

    it("orders groups by groupOrder (server-group ID order) regardless of node weight", () => {
        const order = ["Tencent", "AWS", "Azure", "Akile", "BageVM", "OTHER", "HOME"]
        expect(
            groupCounts(
                [
                    makeNode({ id: "other", groups: ["OTHER"], weight: -100 }),
                    makeNode({ id: "home", groups: ["HOME"], weight: -50 }),
                    makeNode({ id: "aws-1", groups: ["AWS"], weight: 10 }),
                    makeNode({ id: "aws-2", groups: ["AWS", "Tencent"], weight: 20 }),
                    makeNode({ id: "ungrouped", weight: -200 }),
                ],
                order,
            ),
        ).toEqual([
            ["Tencent", 1],
            ["AWS", 2],
            ["OTHER", 1],
            ["HOME", 1],
            ["", 1],
        ])
    })

    it("places unknown groups after known groups sorted by name, and ungrouped last", () => {
        expect(
            groupCounts(
                [
                    makeNode({ id: "1", groups: ["Zeta"] }),
                    makeNode({ id: "2", groups: ["OTHER"] }),
                    makeNode({ id: "3", groups: ["Alpha"] }),
                    makeNode({ id: "4", groups: ["Tencent"] }),
                    makeNode({ id: "5" }),
                ],
                ["Tencent", "OTHER"],
            ),
        ).toEqual([
            ["Tencent", 1],
            ["OTHER", 1],
            ["Alpha", 1],
            ["Zeta", 1],
            ["", 1],
        ])

        // When groupOrder is empty (e.g. server-group endpoint failed), all named groups sort by name.
        expect(
            groupCounts([
                makeNode({ id: "1", groups: ["Zeta"], weight: 1 }),
                makeNode({ id: "2", weight: -100 }),
                makeNode({ id: "3", groups: ["Alpha"], weight: 50 }),
            ]),
        ).toEqual([
            ["Alpha", 1],
            ["Zeta", 1],
            ["", 1],
        ])
    })

    it("returns no counts for no nodes", () => {
        expect(groupCounts([])).toEqual([])
        expect(groupCounts([], ["Tencent", "AWS"])).toEqual([])
    })
})

describe("regionCounts and resolveRegion", () => {
    it("counts non-empty regions and sorts by count descending then code ascending", () => {
        const counts = regionCounts([
            makeNode({ id: "1", region: "US" }),
            makeNode({ id: "2", region: "HK" }),
            makeNode({ id: "3", region: "CN" }),
            makeNode({ id: "4", region: "HK" }),
            makeNode({ id: "5", region: "CN" }),
            makeNode({ id: "6", region: "" }),
            makeNode({ id: "7", region: "JP" }),
        ])
        expect(counts).toEqual([
            ["CN", 2],
            ["HK", 2],
            ["JP", 1],
            ["US", 1],
        ])
    })

    it("falls back to null when switching to a group without the picked region or with fewer than two regions", () => {
        const fullFleet = regionCounts([
            makeNode({ id: "1", region: "HK", groups: ["asia"] }),
            makeNode({ id: "2", region: "JP", groups: ["asia"] }),
            makeNode({ id: "3", region: "US", groups: ["americas"] }),
            makeNode({ id: "4", region: "BR", groups: ["americas"] }),
        ])
        expect(resolveRegion("HK", fullFleet)).toBe("HK")

        // Switching to americas group: HK is absent -> falls back to All (null)
        const americasRegions = regionCounts([
            makeNode({ id: "3", region: "US", groups: ["americas"] }),
            makeNode({ id: "4", region: "BR", groups: ["americas"] }),
        ])
        expect(resolveRegion("HK", americasRegions)).toBeNull()
        expect(resolveRegion("US", americasRegions)).toBe("US")

        // Switching to single-region group: < 2 regions -> falls back to null
        const singleRegion = regionCounts([makeNode({ id: "3", region: "US" })])
        expect(resolveRegion("US", singleRegion)).toBeNull()

        // showRegions disabled -> falls back to null
        expect(resolveRegion("HK", fullFleet, false)).toBeNull()
    })
})

describe("resolvePeerGroup", () => {
    const groupOrder = ["Tencent", "AWS", "Missuo"]

    it("uses the group filter from lastListHref when the node belongs to it", () => {
        const dual = makeNode({ id: "31", groups: ["Tencent", "Missuo"] })
        expect(resolvePeerGroup(dual, "/?group=Missuo&region=US", groupOrder)).toBe("Missuo")
        expect(resolvePeerGroup(dual, "/?group=Other&group=Missuo", groupOrder)).toBe("Missuo")
    })

    it("falls back to the node's first group in groupOrder when lastListHref has no matching group", () => {
        const dual = makeNode({ id: "31", groups: ["Missuo", "AWS"] })
        expect(resolvePeerGroup(dual, "/", groupOrder)).toBe("AWS")
        expect(resolvePeerGroup(dual, "/?group=Tencent", groupOrder)).toBe("AWS")
        expect(resolvePeerGroup(dual, "/?group=", groupOrder)).toBe("AWS")
    })

    it("returns null for ungrouped nodes or undefined node (list all visible nodes)", () => {
        const ungrouped = makeNode({ id: "41", groups: [] })
        expect(resolvePeerGroup(ungrouped, "/?group=Tencent", groupOrder)).toBeNull()
        expect(resolvePeerGroup(ungrouped, "/", groupOrder)).toBeNull()
        expect(resolvePeerGroup(undefined, "/?group=Tencent", groupOrder)).toBeNull()
    })

    it("returns null when showGroups is false even if the node belongs to groups", () => {
        const dual = makeNode({ id: "31", groups: ["Tencent", "Missuo"] })
        expect(resolvePeerGroup(dual, "/?group=Missuo", groupOrder, false)).toBeNull()
    })
})
