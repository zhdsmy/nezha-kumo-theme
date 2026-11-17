import {
    jsonEntries,
    moveJsonItem,
    parseJsonNote,
    patchJsonNote,
    rawJsonAt,
    renameJsonKey,
} from "@/lib/json-note"
import { expect, test } from "vitest"

test("generic JSON patches preserve untouched bytes through objects and arrays", () => {
    const raw = ' {"a": [1e+2, {"x":"\\u4e2d", "v":"old"}], "other" : [null,true]} '
    expect(patchJsonNote(raw, ["a", 1, "v"], "new")).toBe(raw.replace('"old"', '"new"'))
    expect(renameJsonKey(raw, [0], "renamed")).toBe(raw.replace('"a"', '"renamed"'))
    expect(rawJsonAt(raw, [0, 0])).toBe("1e+2")
    expect(patchJsonNote(raw, ["__proto__", "safe"], "yes")).toContain('"__proto__":{"safe":"yes"}')
    expect(({} as Record<string, unknown>).safe).toBeUndefined()
})
test("JSON arrays append, remove, reorder and keep numeric and escaped spellings", () => {
    const raw = '{"a":[1e+2, "\\u4e2d", false],"x": 0}'
    expect(JSON.parse(patchJsonNote(raw, ["a", 3], null)).a).toEqual([100, "中", false, null])
    expect(JSON.parse(patchJsonNote(raw, ["a", 1], undefined)).a).toEqual([100, false])
    const moved = moveJsonItem(raw, ["a"], 0, 2)
    expect(JSON.parse(moved).a).toEqual(["中", false, 100])
    expect(moved).toContain("1e+2")
    expect(moved).toContain('"\\u4e2d"')
    expect(moved).toContain('"x": 0')
})
test("member indices keep duplicate keys editable without hiding earlier values", () => {
    const raw = '{"x":"one", "x":"two"}'
    expect(jsonEntries(raw).map((item) => item.key)).toEqual(["x", "x"])
    expect(renameJsonKey(raw, [0], "y")).toBe('{"y":"one", "x":"two"}')
    expect(parseJsonNote("plain text")).toBeUndefined()
})
