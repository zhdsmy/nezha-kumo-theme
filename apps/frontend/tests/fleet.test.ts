import { describe, expect, it } from "vitest"

import { levelFor, needsAttention, nodeIssues, peerNodes, sortNodes } from "../src/core/fleet"
import { type NodeInfo } from "../src/core/model"
import { emptySnapshot } from "./snapshot"

const nodes = [
    {
        id: "b",
        name: "Beta",
        groups: ["HK"],
        weight: 1,
        memTotal: 100,
        diskTotal: 100,
        trafficLimit: -1,
        expiredAt: null,
    },
    {
        id: "a",
        name: "Alpha",
        groups: ["HK", "CN"],
        weight: 0,
        memTotal: 100,
        diskTotal: 100,
        trafficLimit: -1,
        expiredAt: null,
    },
] as NodeInfo[]
const snapshots = {
    a: {
        ...emptySnapshot(true),
        at: Date.now(),
        cpu: 10,
        memTotal: 100,
        memUsed: 20,
        diskTotal: 100,
        diskUsed: 80,
        netUp: 5,
    },
    b: {
        ...emptySnapshot(true),
        at: Date.now(),
        cpu: 70,
        memTotal: 100,
        memUsed: 80,
        diskTotal: 100,
        diskUsed: 50,
        netUp: 10,
    },
}
describe("fleet ordering and attention", () => {
    it("sorts without mutating node metadata", () => {
        expect(sortNodes(nodes, snapshots, "default", false).map((n) => n.id)).toEqual(["a", "b"])
        expect(sortNodes(nodes, snapshots, "cpu", true).map((n) => n.id)).toEqual(["b", "a"])
        expect(sortNodes(nodes, snapshots, "memory", false)[0].id).toBe("a")
        expect(sortNodes(nodes, snapshots, "name", false)[0].id).toBe("a")
        expect(nodes[0].id).toBe("b")
    })
    it("builds peerNodes in HomePage default sort order and respects group and showOffline", () => {
        const extra = [
            ...nodes,
            { ...nodes[0], id: "c", name: "Gamma", groups: ["HK"], weight: 0 },
            { ...nodes[0], id: "d", name: "Delta", groups: ["US"], weight: -5 },
        ] as NodeInfo[]
        // Same order as HomePage default sort (weight asc, then id asc)
        expect(peerNodes(extra, "HK", new Set(["b"]), true, true).map((n) => n.id)).toEqual(
            sortNodes(
                extra.filter((n) => n.groups.includes("HK")),
                {},
                "default",
                false,
            ).map((n) => n.id),
        )
        expect(peerNodes(extra, "HK", new Set(["b"]), true, true).map((n) => n.id)).toEqual([
            "a",
            "c",
            "b",
        ])
        // Hides offline peers when showOffline is false and live feed has arrived
        expect(peerNodes(extra, "HK", new Set(["b"]), true, false).map((n) => n.id)).toEqual([
            "a",
            "c",
        ])
        // Keeps all peers before initial feed arrives even if showOffline is false
        expect(peerNodes(extra, "HK", new Set(["b"]), false, false).map((n) => n.id)).toEqual([
            "a",
            "c",
            "b",
        ])
        // Null peerGroup lists all visible nodes in default order
        expect(peerNodes(extra, null, new Set(), true, true).map((n) => n.id)).toEqual([
            "d",
            "a",
            "c",
            "b",
        ])
    })
    it("flags the 80% disk and near-limit CPU consistently and returns structured reasons", () => {
        expect(needsAttention(nodes[1], snapshots.a, true)).toBe(true)
        expect(nodeIssues(nodes[1], snapshots.a, true)).toEqual([{ kind: "disk", percent: "80" }])
        expect(nodeIssues(nodes[0], snapshots.b, true)).toEqual([
            { kind: "cpu", percent: "70" },
            { kind: "memory", percent: "80" },
        ])
        expect(needsAttention(nodes[1], undefined, false)).toBe(false)
        expect(nodeIssues(nodes[1], undefined, false)).toEqual([])
        expect(nodeIssues(nodes[1], emptySnapshot(false), true)).toEqual([{ kind: "offline" }])
        expect(needsAttention(nodes[1], emptySnapshot(false), true)).toBe(false)
        const now = 1_000_000_000
        expect(
            nodeIssues(
                { ...nodes[1], expiredAt: now - 1, trafficLimit: 100, trafficLimitType: "sum" },
                { ...emptySnapshot(true), at: now - 6 * 60_000, totalUp: 60, totalDown: 50 },
                true,
                now,
            ),
        ).toEqual([{ kind: "stale" }, { kind: "expired" }, { kind: "quota" }])
        expect(levelFor("disk", 79.6)).toBe("warn")
        expect(levelFor("memory", 89.6)).toBe("danger")
    })
})
