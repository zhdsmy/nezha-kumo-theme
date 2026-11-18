// Adapted from zool-theme/tests/region.test.ts (MIT, luoleiorg).
import i18next from "i18next"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { initReactI18next } from "react-i18next"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { RegionFlag } from "../src/components/RegionFlag"
import { FLAG_CODES } from "../src/core/flags.manifest"
import { regionFlagCode, regionName } from "../src/core/region"

const mockSession = vi.hoisted(() => ({ loggedIn: false }))

vi.mock("@/app/store", () => ({
    useStore: (selector: (s: { session: { loggedIn: boolean } }) => unknown) =>
        selector({ session: mockSession }),
}))

beforeAll(async () => {
    await i18next.use(initReactI18next).init({
        lng: "en",
        fallbackLng: "en",
        resources: { en: { translation: {} }, "zh-CN": { translation: {} } },
    })
})

it("uses Traditional Chinese region names in Hong Kong and Taiwan", () => {
    for (const locale of ["zh-HK", "zh-TW"]) {
        expect(regionName("TW", locale)).toBe("中國台灣")
        expect(regionName("DE", locale)).toBe("德國")
    }
})

describe("FLAG_CODES", () => {
    it("ships all 249 lowercase two-letter ISO flag codes including cn and tw", () => {
        expect(FLAG_CODES.size).toBe(249)
        expect(FLAG_CODES.has("cn")).toBe(true)
        expect(FLAG_CODES.has("tw")).toBe(true)
        for (const code of FLAG_CODES) {
            expect(code).toMatch(/^[a-z]{2}$/)
        }
    })
})

describe("regionFlagCode", () => {
    it("returns lowercase flag codes for normal regions regardless of case", () => {
        expect(regionFlagCode("us", false)).toBe("us")
        expect(regionFlagCode("US", false)).toBe("us")
        expect(regionFlagCode("Jp", true)).toBe("jp")
        expect(regionFlagCode("hK", false)).toBe("hk")
    })

    it("maps TW to cn when logged out and tw when logged in", () => {
        for (const code of ["TW", "tw", "Tw", "tW"]) {
            expect(regionFlagCode(code, false)).toBe("cn")
            expect(regionFlagCode(code, true)).toBe("tw")
        }
    })

    it("returns null for empty string, path traversal, wrong length, and non-ASCII letters", () => {
        for (const bad of [
            "",
            "../",
            "c/",
            "/c",
            "..",
            "usa",
            "USA",
            "u",
            "U1",
            " US",
            "US ",
            "éa",
            "ＵＳ",
            "\u212AS",
            "🇺🇸",
            "中国",
        ]) {
            expect(regionFlagCode(bad, false), bad).toBeNull()
            expect(regionFlagCode(bad, true), bad).toBeNull()
        }
    })

    it("returns null for two-letter ASCII codes absent from FLAG_CODES", () => {
        for (const unknown of ["XX", "xx", "ZZ", "QO", "EU", "UN"]) {
            expect(FLAG_CODES.has(unknown.toLowerCase())).toBe(false)
            expect(regionFlagCode(unknown, false)).toBeNull()
            expect(regionFlagCode(unknown, true)).toBeNull()
        }
    })
})

describe("RegionFlag", () => {
    it("renders nothing when code is empty", () => {
        mockSession.loggedIn = false
        expect(renderToStaticMarkup(createElement(RegionFlag, { code: "" }))).toBe("")
    })

    it("renders a 16x12 lazy flag image with localized alt text", async () => {
        mockSession.loggedIn = false
        await i18next.changeLanguage("en")
        const html = renderToStaticMarkup(
            createElement(RegionFlag, { code: "JP", className: "mr-2" }),
        )
        expect(html).toContain('class="region-flag mr-2"')
        expect(html).toContain('src="/flags/jp.svg"')
        expect(html).toContain(`alt="${regionName("JP", "en")}"`)
        expect(html).toContain('width="16"')
        expect(html).toContain('height="12"')
        expect(html).toContain('loading="lazy"')
        expect(html).toContain('decoding="async"')
    })

    it("switches TW flag between cn and tw based on store session.loggedIn", async () => {
        await i18next.changeLanguage("zh-CN")
        mockSession.loggedIn = false
        const loggedOut = renderToStaticMarkup(createElement(RegionFlag, { code: "TW" }))
        expect(loggedOut).toContain('src="/flags/cn.svg"')
        expect(loggedOut).toContain('alt="中国台湾"')

        mockSession.loggedIn = true
        const loggedIn = renderToStaticMarkup(createElement(RegionFlag, { code: "TW" }))
        expect(loggedIn).toContain('src="/flags/tw.svg"')
        expect(loggedIn).toContain('alt="中国台湾"')
    })

    it("renders a 16x12 neutral globe icon with aria-label when flag is unavailable", async () => {
        mockSession.loggedIn = false
        await i18next.changeLanguage("en")
        const html = renderToStaticMarkup(createElement(RegionFlag, { code: "EU" }))
        expect(html.startsWith("<svg")).toBe(true)
        expect(html).toContain('class="region-flag"')
        expect(html).toContain('width="16"')
        expect(html).toContain('height="12"')
        expect(html).toContain(`aria-label="${regionName("EU", "en")}"`)
    })
})
