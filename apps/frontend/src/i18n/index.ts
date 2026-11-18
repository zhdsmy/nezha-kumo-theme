import { readStorage, writeStorage } from "@/core/storage"
// Adapted from zool-theme/src/i18n/index.ts (MIT, luoleiorg).
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { type Locale, matchLocale } from "../../../../packages/shared/languages"
import en from "./locales/en.json"
import ja from "./locales/ja.json"
import zhCN from "./locales/zh-CN.json"
import zhHK from "./locales/zh-HK.json"
import zhTW from "./locales/zh-TW.json"

const STORAGE_KEY = "nkt:language"

function storedLocale(): Locale | null {
    return matchLocale(readStorage(STORAGE_KEY))
}

/** Visitor choice → site default → browser → English. */
export function resolveLocale(siteDefault?: string | null): Locale {
    return (
        storedLocale() ??
        matchLocale(siteDefault && siteDefault !== "auto" ? siteDefault : null) ??
        navigator.languages.map(matchLocale).find(Boolean) ??
        "en"
    )
}

export function setLocale(locale: Locale, persist = true) {
    if (persist) writeStorage(STORAGE_KEY, locale)
    document.documentElement.lang = locale
    return i18n.changeLanguage(locale)
}

export const uiLabels = <T = Record<string, string>>(key: string) =>
    i18n.t(key, { returnObjects: true }) as T

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        "zh-CN": { translation: zhCN },
        "zh-HK": { translation: zhHK },
        "zh-TW": { translation: zhTW },
        ja: { translation: ja },
    },
    lng: resolveLocale(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
})

document.documentElement.lang = i18n.language

export default i18n
