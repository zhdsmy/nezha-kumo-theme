// Adapted from zool-theme/tests/oauth.test.ts (MIT, luoleiorg); Nezha API cases.
import { afterEach, describe, expect, it, vi } from "vitest"

import { nezha } from "../src/adapters/nezha"
import type { SiteInfo } from "../src/core/model"

const site = { oauth: true, oauthProviders: ["GitHub", "My SSO/Team"] } as SiteInfo
const respond = (data: unknown, status = 200) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status }))
    vi.stubGlobal("fetch", fetch)
    return fetch
}
afterEach(() => vi.unstubAllGlobals())
describe("OAuth redirect validation", () => {
    it("encodes configured providers and rejects unconfigured ones", async () => {
        const fetch = respond({
            success: true,
            data: { redirect: "https://auth.example.test/authorize" },
        })
        expect(await nezha.oauthUrl(site, "My SSO/Team")).toBe(
            "https://auth.example.test/authorize",
        )
        expect(fetch.mock.calls[0][0]).toBe("/api/v1/oauth2/My%20SSO%2FTeam?type=1")
        expect(await nezha.oauthUrl(site, "unknown")).toBeNull()
        expect(fetch).toHaveBeenCalledTimes(1)
    })
    it.each(["javascript:alert(1)", "data:text/html,hello", "", undefined])(
        "rejects unsafe redirect %s",
        async (redirect) => {
            respond({ success: true, data: { redirect } })
            await expect(nezha.oauthUrl(site, "GitHub")).rejects.toThrow()
        },
    )
    it("propagates backend errors", async () => {
        respond({ success: false }, 503)
        await expect(nezha.oauthUrl(site, "GitHub")).rejects.toThrow("HTTP 503")
    })
})
