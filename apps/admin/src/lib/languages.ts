import { matchLocale } from "../../../../packages/shared/languages"

export { interfaceLanguages } from "../../../../packages/shared/languages"

export function resolveInterfaceLanguage(value?: string) {
    return matchLocale(value) ?? "en"
}
