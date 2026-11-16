import { describe, expect, it } from "vitest"

import { levelFor, needsAttention, sortNodes } from "../src/core/fleet"
import { type NodeInfo } from "../src/core/model"
import { emptySnapshot } from "./snapshot"

const nodes = [
    {
        id: "b",
        name: "Beta",
        weight: 1,
        memTotal: 100,
        diskTotal: 100,
        trafficLimit: -1,
        expiredAt: null,
    },
    {
        id: "a",
        name: "Alpha",
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
    it("flags the 80% disk and near-limit CPU consistently", () => {
        expect(needsAttention(nodes[1], snapshots.a, true)).toBe(true)
        expect(needsAttention(nodes[1], undefined, false)).toBe(false)
        expect(levelFor("disk", 79.6)).toBe("warn")
        expect(levelFor("memory", 89.6)).toBe("danger")
    })
})
