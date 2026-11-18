import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { z } from "zod"

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

const FIELD_LABEL_KEYS: Record<string, string> = {
    name: "Name",
    role: "Role",
    display_index: "Weight",
    type: "Type",
    trigger_mode: "TriggerMode",
    request_method: "RequestMethod",
    request_type: "RequestType",
    min_latency: "MinimumLatency",
    max_latency: "MaximumLatency",
    notification_group_id: "NotifierGroup",
    ip_change_notification_group_id: "NotifierGroup",
    username: "Username",
    password: "Password",
    original_password: "OriginalPassword",
    new_password: "NewPassword",
    new_username: "NewUsername",
    site_name: "SiteName",
    language: "Language",
    user_template: "CustomTemplate",
    duration: "Interval",
    max_retries: "MaximumRetryAttempts",
    online_stats_days: "OnlineStatsDays",
    target: "Target",
    domain: "Domains",
    domains: "Domains",
    cover: "Coverage",
    ip_report_period: "AgentConfig.ip_report_period",
    report_delay: "AgentConfig.report_delay",
}

function fieldLabelForPath(path: PropertyKey[] | undefined): string {
    const raw = String(path?.at(-1) ?? "")
    if (!raw) return ""
    if (raw === "url") return "URL"
    if (raw === "webhook_url") return "Webhook URL"
    if (raw === "webhook_method") return `Webhook ${i18n.t("RequestMethod")}`
    if (raw === "webhook_request_type") return `Webhook ${i18n.t("RequestType")}`
    if (raw === "server_id") return `${i18n.t("Server")} ID`
    return Object.hasOwn(FIELD_LABEL_KEYS, raw) ? i18n.t(FIELD_LABEL_KEYS[raw]!) : ""
}

function applyZodLocale(lng: string) {
    const resolved = resolveInterfaceLanguage(lng)
    const baseLocale =
        resolved === "zh-CN"
            ? z.locales.zhCN()
            : resolved === "zh-TW"
              ? z.locales.zhTW()
              : resolved === "ja"
                ? z.locales.ja()
                : z.locales.en()

    z.config({
        ...baseLocale,
        customError: (iss) => {
            const field = fieldLabelForPath(iss.path)
            if (iss.code === "too_small" && iss.origin === "string") {
                const min = Number(iss.minimum)
                if (min <= 1) {
                    return field
                        ? i18n.t("FieldValidation.Required", { field })
                        : i18n.t("FieldValidation.RequiredGeneric")
                }
                if (field) {
                    return i18n.t("FieldValidation.StringMin", { field, min })
                }
            }
            if (iss.code === "too_big" && iss.origin === "string" && field) {
                return i18n.t("FieldValidation.StringMax", {
                    field,
                    max: Number(iss.maximum),
                })
            }
            if (
                iss.code === "too_small" &&
                (iss.origin === "number" || iss.origin === "int") &&
                field
            ) {
                return i18n.t("FieldValidation.NumberMin", {
                    field,
                    min: Number(iss.minimum),
                })
            }
            if (
                iss.code === "too_big" &&
                (iss.origin === "number" || iss.origin === "int") &&
                field
            ) {
                return i18n.t("FieldValidation.NumberMax", {
                    field,
                    max: Number(iss.maximum),
                })
            }
            if (iss.code === "invalid_format" && iss.format === "url") {
                return i18n.t("FieldValidation.InvalidURL")
            }
            if (
                iss.code === "invalid_type" &&
                (iss.expected === "number" || iss.expected === "int") &&
                field
            ) {
                return i18n.t("FieldValidation.InvalidNumber", { field })
            }
            return undefined
        },
    })
}

const initialLanguage = resolveInterfaceLanguage(
    localStorage.getItem("language") || navigator.language,
)

i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    supportedLngs: Object.keys(resources),
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
})

function syncDocumentLanguage(lng: string) {
    const resolved = resolveInterfaceLanguage(lng)
    if (typeof document !== "undefined") {
        document.documentElement.lang = resolved
    }
    applyZodLocale(resolved)
}

syncDocumentLanguage(i18n.resolvedLanguage || initialLanguage)

i18n.on("languageChanged", (lng) => {
    localStorage.setItem("language", lng)
    syncDocumentLanguage(lng)
})

export default i18n
