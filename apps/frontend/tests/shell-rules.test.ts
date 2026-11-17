import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("FE02 shared shell never falls back to vh or svh height", () => {
    const css = readFileSync(
        new URL("../../../packages/ui/src/styles.css", import.meta.url),
        "utf8",
    )
    const shell = css.match(/\.nk-shell\s*\{([^}]+)\}/)?.[1]
    expect(shell).toBeDefined()
    expect(shell).not.toMatch(/\b\d*\.?\d+(?:vh|svh)\b/)
})
