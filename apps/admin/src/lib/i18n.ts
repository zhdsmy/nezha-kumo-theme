import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import enTranslation from "../locales/en/translation.json"
import jaTranslation from "../locales/ja/translation.json"
import zhCNTranslation from "../locales/zh-CN/translation.json"
import zhTWTranslation from "../locales/zh-TW/translation.json"
import { resolveInterfaceLanguage } from "./languages"

const resources = {
    en: { translation: enTranslation },
    ja: { translation: jaTranslation },
    "zh-CN": { translation: zhCNTranslation },
    "zh-TW": { translation: zhTWTranslation },
}

i18n.use(initReactI18next).init({
    resources,
    lng: resolveInterfaceLanguage(localStorage.getItem("language") || navigator.language),
    supportedLngs: Object.keys(resources),
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
})

i18n.on("languageChanged", (lng) => {
    localStorage.setItem("language", lng)
})

export default i18n
