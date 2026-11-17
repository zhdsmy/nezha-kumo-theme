export const settingCoverageTypes: Record<number, string> = {
    1: "Coverages.Excludes",
    2: "Coverages.Only",
}

export const nezhaLang: Record<string, string> = {
    "zh-CN": "简体中文（中国大陆）",
    "zh-TW": "正體中文（台灣）",
    "en-US": "English",
    "ru-RU": "Русский",
    "es-ES": "Español",
    "de-DE": "Deutsch",
    "ta-IN": "தமிழ்",
    "it-IT": "Italiano",
    "fr-FR": "Français",
    "id-ID": "Bahasa Indonesia",
    "ja-JP": "日本語",
    "ro-RO": "Română",
    "uk-UA": "Українська",
    "gl-ES": "Galego",
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
