import { parseDecimal } from "@/lib/number"
import { convertJsonType } from "@/lib/private-note"
import { expect, test } from "vitest"

test("decimal conversion accepts signed fractions and exponents only", () => {
    for (const raw of ["-12.5", "0", ".5", "1e+2", "-1E-2"])
        expect(convertJsonType(JSON.stringify(raw), "number")).toBe(parseDecimal(raw))
    expect(parseDecimal("-1E-2")).toBe(-0.01)
    for (const raw of ["0x10", "0b1", "0o7", " 1", "1 ", "", "1e", "Infinity"])
        expect(convertJsonType(JSON.stringify(raw), "number")).toBeNull()
})
