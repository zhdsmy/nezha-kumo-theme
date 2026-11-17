import i18n from "@/lib/i18n"
import { nezhaLang } from "@/types/settings"
import { expect, test } from "vitest"

test("only four locales are shipped and offered in both language menus", () => {
    expect(
        Object.keys(import.meta.glob("../locales/*/translation.json"))
            .map((path) => path.split("/")[2])
            .sort(),
    ).toEqual(["en", "ja", "zh-CN", "zh-TW"])
    expect(Object.keys(nezhaLang).sort()).toEqual(["en", "ja", "zh-CN", "zh-TW"])
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
