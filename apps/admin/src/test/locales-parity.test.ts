import { SCOPE_OPTIONS } from "@/api/api-tokens"
import en from "@/locales/en/translation.json"
import ja from "@/locales/ja/translation.json"
import zhCN from "@/locales/zh-CN/translation.json"
import zhTW from "@/locales/zh-TW/translation.json"
import { triggerModes } from "@/types/alert-rule"
import { cronCoverageTypes, cronTypes } from "@/types/cron"
import { serviceCoverageTypes } from "@/types/service"
import {
    settingCoverageTypes,
    wafBlockIdentifiers,
    wafBlockReasons,
} from "@/types/settings"
import { describe, expect, test } from "vitest"

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k
        if (v && typeof v === "object" && !Array.isArray(v)) {
            Object.assign(out, flatten(v as Record<string, unknown>, key))
        } else {
            out[key] = String(v)
        }
    }
    return out
}

function interpolationVars(text: string): string[] {
    return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
}

describe("admin locale parity", () => {
    const flatEn = flatten(en)
    const flatZhCN = flatten(zhCN)
    const flatZhTW = flatten(zhTW)
    const flatJa = flatten(ja)
    const enKeys = Object.keys(flatEn).sort()

    test("en, zh-CN, zh-TW, and ja have identical non-empty key sets", () => {
        expect(Object.keys(flatZhCN).sort()).toEqual(enKeys)
        expect(Object.keys(flatZhTW).sort()).toEqual(enKeys)
        expect(Object.keys(flatJa).sort()).toEqual(enKeys)

        for (const [locale, dict] of [
            ["en", flatEn],
            ["zh-CN", flatZhCN],
            ["zh-TW", flatZhTW],
            ["ja", flatJa],
        ] as const) {
            for (const key of enKeys) {
                expect(dict[key].trim().length, `${locale}:${key} must not be empty`).toBeGreaterThan(
                    0,
                )
            }
        }
    })

    test("interpolation placeholders match across en, zh-CN, zh-TW, and ja", () => {
        for (const key of enKeys) {
            const expected = interpolationVars(flatEn[key])
            expect(interpolationVars(flatZhCN[key]), `zh-CN:${key}`).toEqual(expected)
            expect(interpolationVars(flatZhTW[key]), `zh-TW:${key}`).toEqual(expected)
            expect(interpolationVars(flatJa[key]), `ja:${key}`).toEqual(expected)
        }
    })

    test("dynamic option maps and API token scope descriptions resolve to valid locale keys", () => {
        const dynamicKeys = [
            ...Object.values(triggerModes),
            ...Object.values(cronTypes),
            ...Object.values(cronCoverageTypes),
            ...Object.values(serviceCoverageTypes),
            ...Object.values(settingCoverageTypes),
            ...Object.values(wafBlockReasons),
            ...Object.values(wafBlockIdentifiers),
            ...SCOPE_OPTIONS.map((s) => s.descKey),
        ]
        for (const key of dynamicKeys) {
            expect(flatEn[key], `missing dynamic key: ${key}`).toBeDefined()
            expect(flatZhCN[key], `missing zh-CN dynamic key: ${key}`).toBeDefined()
            expect(flatJa[key], `missing ja dynamic key: ${key}`).toBeDefined()
        }
    })
})
