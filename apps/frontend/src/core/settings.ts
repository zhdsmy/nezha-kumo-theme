// Adapted from zool-theme/src/core/settings.ts (MIT, luoleiorg).
import { type Locale, interfaceLanguages } from "../../../../packages/shared/languages"

export type Appearance = "system" | "light" | "dark"
type LanguagePreference = "auto" | Locale

/** Optional site-owner settings from panel JSON and config.js. Layout follows the shared responsive contract. */
export interface ThemeSettings {
    defaultAppearance: Appearance
    defaultLanguage: LanguagePreference
    siteTitle: string
    showOverview: boolean
    showCost: boolean
    showRegions: boolean
    /** Offer the group filter on the home page (false hides the control and never sections by group) */
    showGroups: boolean
    showBilling: boolean
    showOffline: boolean
    hiddenNodes: string[]
    hideAdminEntry: boolean
    footerNote: string
}

export const DEFAULT_SETTINGS: ThemeSettings = {
    defaultAppearance: "system",
    defaultLanguage: "auto",
    siteTitle: "",
    showOverview: true,
    showCost: true,
    showRegions: true,
    showGroups: true,
    showBilling: true,
    showOffline: true,
    hiddenNodes: [],
    hideAdminEntry: false,
    footerNote: "",
}

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback

const bool = (v: unknown, fallback: boolean) => {
    if (typeof v === "boolean") return v
    if (v === "true") return true
    if (v === "false") return false
    return fallback
}

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback)

function list(v: unknown): string[] {
    if (Array.isArray(v)) return v.map(String).filter(Boolean)
    if (typeof v === "string")
        return v
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
    return []
}

/** Accepts anything the backend hands over and returns a complete, typed settings object. */
export function normalizeSettings(raw: unknown): ThemeSettings {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    const d = DEFAULT_SETTINGS
    return {
        defaultAppearance: oneOf(
            r.defaultAppearance,
            ["system", "light", "dark"],
            d.defaultAppearance,
        ),
        defaultLanguage:
            typeof r.defaultLanguage === "string" &&
            Object.hasOwn(interfaceLanguages, r.defaultLanguage)
                ? (r.defaultLanguage as Locale)
                : d.defaultLanguage,
        siteTitle: str(r.siteTitle, d.siteTitle).trim(),
        showOverview: bool(r.showOverview, d.showOverview),
        showCost: bool(r.showCost, d.showCost),
        showRegions: bool(r.showRegions, d.showRegions),
        showGroups: bool(r.showGroups, d.showGroups),
        showBilling: bool(r.showBilling, d.showBilling),
        showOffline: bool(r.showOffline, d.showOffline),
        hiddenNodes: list(r.hiddenNodes),
        hideAdminEntry: bool(r.hideAdminEntry, d.hideAdminEntry),
        footerNote: str(r.footerNote, d.footerNote).trim(),
    }
}

/** Parse custom code as data only; never insert or execute panel scripts. */
export function readThemeConfig(customCode: string | undefined, config: unknown): unknown {
    const block = customCode?.match(
        /<script\b[^>]*\bid=["']nezha-kumo-config["'][^>]*>([\s\S]*?)<\/script>/i,
    )
    let panel: unknown
    if (block) {
        try {
            panel = JSON.parse(block[1])
        } catch {
            console.warn("Invalid nezha-kumo-config JSON; ignoring block")
        }
    }
    return {
        ...(panel && typeof panel === "object" && !Array.isArray(panel) ? panel : {}),
        ...(config && typeof config === "object" && !Array.isArray(config) ? config : {}),
    }
}
