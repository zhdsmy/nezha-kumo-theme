import i18n from "@/lib/i18n"
import { interfaceLanguages, resolveInterfaceLanguage } from "@/lib/languages"
import { expect, test } from "vitest"

test("only four locales are shipped and offered in the interface language menu", () => {
    expect(
        Object.keys(import.meta.glob("../locales/*/translation.json"))
            .map((path) => path.split("/")[2])
            .sort(),
    ).toEqual(["en", "ja", "zh-CN", "zh-TW"])
    expect(Object.keys(interfaceLanguages).sort()).toEqual(["en", "ja", "zh-CN", "zh-TW"])
    expect(Object.keys(i18n.options.resources ?? {}).sort()).toEqual(["en", "ja", "zh-CN", "zh-TW"])
})

test.each(["fr-FR", "ru-RU", "pt-BR", "xx"])(
    "unsupported language %s resolves to English",
    async (language) => {
        await i18n.changeLanguage(language)
        expect(i18n.resolvedLanguage).toBe("en")
        expect(i18n.t("Language")).toBe("Language")
    },
)

test.each([
    ["en-US", "en"],
    ["ja-JP", "ja"],
    ["zh-CN", "zh-CN"],
    ["zh-TW", "zh-TW"],
])("preserves existing language code %s as %s", async (input, expected) => {
    await i18n.changeLanguage(input)
    expect(i18n.resolvedLanguage).toBe(expected)
})

test.each([
    ["en-US", "en"],
    ["en_US", "en"],
    ["ja-JP", "ja"],
    ["ja_JP", "ja"],
    ["ru-RU", "en"],
    ["ru_RU", "en"],
    ["zh_CN", "zh-CN"],
    ["zh_TW", "zh-TW"],
])("normalizes backend or stored %s to interface %s", async (input, expected) => {
    await i18n.changeLanguage(resolveInterfaceLanguage(input))
    expect(i18n.language).toBe(expected)
    expect(i18n.resolvedLanguage).toBe(expected)
})
