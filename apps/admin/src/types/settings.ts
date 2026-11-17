export const settingCoverageTypes: Record<number, string> = {
    1: "Coverages.Excludes",
    2: "Coverages.Only",
}

// Notification languages shipped by the Nezha backend, independent of UI locales.
export const nezhaLang: Record<string, string> = {
    "zh-CN": "简体中文（中国大陆）",
    "zh-TW": "正體中文（台灣）",
    "en-US": "English",
    "ja-JP": "日本語",
    "de-DE": "Deutsch",
    "es-ES": "Español",
    "fr-FR": "Français",
    "gl-ES": "Galego",
    "id-ID": "Bahasa Indonesia",
    "pt-BR": "Português (Brasil)",
    "ro-RO": "Română",
    "ru-RU": "Русский",
    "ta-IN": "தமிழ்",
    "uk-UA": "Українська",
    "vi-VN": "Tiếng Việt",
}

export function normalizeNotificationLanguage(value?: string): string {
    const code = value?.replaceAll("_", "-")
    if (code === "ja") return "ja-JP"
    return code && Object.hasOwn(nezhaLang, code) ? code : "en-US"
}

export const wafBlockReasons: Record<number, string> = {
    1: "LoginFailed",
    2: "BruteForceAttackingToken",
    3: "BruteForceAttackingAgentSecret",
    4: "BlockByUser",
    5: "WAFBlockReasonTypeBruteForceOauth2",
}

export const wafBlockIdentifiers: Record<number, string> = {
    "-127": "GrpcAuthFailed",
    "-126": "APITokenInvalid",
    "-125": "UserInvalid",
    "-124": "BlockByUser",
}
