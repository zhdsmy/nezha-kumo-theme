export const interfaceLanguages = {
    en: "English",
    "zh-CN": "简体中文",
    "zh-HK": "繁體中文（香港）",
    "zh-TW": "繁體中文（台灣）",
    ja: "日本語",
}

export type Locale = keyof typeof interfaceLanguages

/** An unsupported preference lets the caller try its next language source. */
export function matchLocale(value?: string | null): Locale | null {
    if (!value) return null
    try {
        const { language, region, script } = new Intl.Locale(value.replaceAll("_", "-"))
        if (language === "en" || language === "ja") return language
        if (language !== "zh") return null
        if (region === "HK" || region === "MO") return "zh-HK"
        if (region === "TW" || (!region && script === "Hant")) return "zh-TW"
        return "zh-CN"
    } catch {
        return null
    }
}
