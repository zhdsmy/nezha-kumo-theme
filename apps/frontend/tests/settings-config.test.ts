import { afterEach, describe, expect, it, vi } from "vitest"

import { nezha } from "../src/adapters/nezha"
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/core/settings"

const block = (value: unknown) =>
    `<script type="application/json" id="nezha-kumo-config">${JSON.stringify(value)}</script>`

async function settings(customCode?: string, config?: unknown) {
    vi.stubGlobal("window", { NezhaKumoConfig: config })
    vi.stubGlobal(
        "fetch",
        async () =>
            new Response(
                JSON.stringify({ success: true, data: { config: { custom_code: customCode } } }),
            ),
    )
    return normalizeSettings((await nezha.loadSite()).settings)
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("site-owner configuration", () => {
    it("reads the panel JSON block", async () => {
        expect(
            await settings(block({ siteTitle: "Synthetic site", showCost: false })),
        ).toMatchObject({
            siteTitle: "Synthetic site",
            showCost: false,
        })
    })
    it("keeps manual config.js support", async () => {
        expect(
            await settings(undefined, { showOffline: false, defaultLanguage: "zh-HK" }),
        ).toMatchObject({
            defaultLanguage: "zh-HK",
            showOffline: false,
        })
    })
    it("merges keys with config.js taking precedence", async () => {
        expect(
            await settings(block({ siteTitle: "Panel", showCost: false }), { siteTitle: "File" }),
        ).toMatchObject({ siteTitle: "File", showCost: false })
    })
    it("uses defaults when neither source exists", async () => {
        expect(await settings()).toEqual(DEFAULT_SETTINGS)
    })
    it("ignores damaged JSON and warns once without exposing its content", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        expect(
            await settings(
                '<script type="application/json" id="nezha-kumo-config">{invalid</script>',
                { showCost: false },
            ),
        ).toMatchObject({ showCost: false })
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls.flat().join(" ")).not.toContain("{invalid")
    })
    it("does not execute other scripts and ignores non-object JSON", async () => {
        expect(
            await settings('<script>throw new Error("must not execute")</script>' + block(null)),
        ).toEqual(DEFAULT_SETTINGS)
        expect(await settings(block(["invalid"]))).toEqual(DEFAULT_SETTINGS)
    })
})
