import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import en from "../src/i18n/locales/en.json"
import ja from "../src/i18n/locales/ja.json"
import zhCN from "../src/i18n/locales/zh-CN.json"
import zhTW from "../src/i18n/locales/zh-TW.json"

type JsonRecord = Record<string, unknown>

function flatten(obj: JsonRecord, prefix = ""): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
        if (k === "_source") continue
        const key = prefix ? `${prefix}.${k}` : k
        if (v && typeof v === "object" && !Array.isArray(v)) {
            Object.assign(out, flatten(v as JsonRecord, key))
        } else {
            out[key] = String(v)
        }
    }
    return out
}

function walkSource(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) out.push(...walkSource(full))
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
}

function placeholders(text: string): string[] {
    return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
}

describe("i18n locale bundles", () => {
    const bundles = {
        en: flatten(en as JsonRecord),
        "zh-CN": flatten(zhCN as JsonRecord),
        "zh-TW": flatten(zhTW as JsonRecord),
        ja: flatten(ja as JsonRecord),
    } as const

    it("keeps canonical key sets and CLDR plural categories identical across all 4 locales", () => {
        const canonical = (keys: string[]) =>
            [...new Set(keys.map((k) => k.replace(/_(one|other)$/, "")))].sort()

        const baseEn = canonical(Object.keys(bundles.en))
        for (const [locale, flat] of Object.entries(bundles)) {
            expect(canonical(Object.keys(flat)), `${locale} canonical keys`).toEqual(baseEn)
            for (const [k, v] of Object.entries(flat)) {
                expect(v.trim().length, `${locale}:${k} should be non-empty`).toBeGreaterThan(0)
            }
        }

        // zh-CN, zh-TW, and ja share identical raw key sets ("other" plural rule)
        expect(Object.keys(bundles["zh-TW"]).sort()).toEqual(Object.keys(bundles["zh-CN"]).sort())
        expect(Object.keys(bundles.ja).sort()).toEqual(Object.keys(bundles["zh-CN"]).sort())

        // Every pluralized base key must provide all CLDR plural categories for each locale
        const pluralBases = baseEn.filter((k) => `${k}_other` in bundles.en)
        expect(pluralBases.length).toBeGreaterThan(0)
        for (const [locale, flat] of Object.entries(bundles)) {
            const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
            for (const base of pluralBases) {
                for (const cat of categories) {
                    expect(flat, `${locale} missing ${base}_${cat}`).toHaveProperty(
                        `${base}_${cat}`,
                    )
                }
            }
        }
    })

    it("preserves interpolation variables across all 4 locales and Japanese script in ja", () => {
        const acronym = /^(CPU|TCP|UDP|OS|GPU)$/
        const jpScript = /[\u3040-\u30ff\u4e00-\u9faf]/

        for (const [rawKey, enVal] of Object.entries(bundles.en)) {
            const baseKey = rawKey.replace(/_(one|other)$/, "")
            const expectedVars = placeholders(enVal)
            for (const [locale, flat] of Object.entries(bundles)) {
                const targetKey = rawKey in flat ? rawKey : `${baseKey}_other`
                expect(placeholders(flat[targetKey]), `${locale}:${targetKey} vars`).toEqual(
                    expectedVars,
                )
            }
            const jaKey = rawKey in bundles.ja ? rawKey : `${baseKey}_other`
            if (!acronym.test(bundles.ja[jaKey])) {
                expect(bundles.ja[jaKey], `ja:${jaKey} should be Japanese`).toMatch(jpScript)
            }
        }
    })

    it("has no unused translation keys in frontend or shared shell source", () => {
        const root = join(import.meta.dirname, "..")
        const files = [
            ...walkSource(join(root, "src")),
            ...walkSource(join(root, "../../packages/ui/src")),
        ]
        const combined = files.map((f) => readFileSync(f, "utf8")).join("\n")

        // Collect namespaces passed as whole objects via uiLabels("ns")
        const wholeNamespaces = new Set(
            [...combined.matchAll(/uiLabels\(\s*["'](\w+)["']\s*\)/g)].map((m) => m[1]),
        )
        // Collect namespaces referenced via dynamic template keys `ns.${...}`
        const dynamicNamespaces = new Set(
            [...combined.matchAll(/["'`](\w+)\.\$\{/g)].map((m) => m[1]),
        )

        const baseKeys = [
            ...new Set(Object.keys(bundles.en).map((k) => k.replace(/_(one|other)$/, ""))),
        ]
        for (const key of baseKeys) {
            const [ns, sub] = key.split(".")
            const direct =
                combined.includes(`"${key}"`) ||
                combined.includes(`'${key}'`) ||
                combined.includes(`\`${key}\``)
            if (direct || wholeNamespaces.has(ns)) continue
            const dynamicMatch =
                dynamicNamespaces.has(ns) &&
                (combined.includes(`"${sub}"`) ||
                    combined.includes(`'${sub}'`) ||
                    new RegExp(`\\b${sub}\\b`).test(combined))
            expect(dynamicMatch, `Unused i18n key: ${key}`).toBe(true)
        }
    })
})
