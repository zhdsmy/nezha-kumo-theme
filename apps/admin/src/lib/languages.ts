export const interfaceLanguages = {
    en: "English",
    "zh-CN": "简体中文（中国大陆）",
    "zh-TW": "正體中文（台灣）",
    ja: "日本語",
}

export function resolveInterfaceLanguage(value?: string): keyof typeof interfaceLanguages {
    const [language, region] = value?.replaceAll("_", "-").toLowerCase().split("-") ?? []
    if (language === "ja") return "ja"
    if (language === "zh") return ["tw", "hk", "mo", "hant"].includes(region) ? "zh-TW" : "zh-CN"
    return "en"
}
