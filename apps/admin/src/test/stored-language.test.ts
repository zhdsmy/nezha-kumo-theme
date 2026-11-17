import { afterEach, expect, test, vi } from "vitest"

afterEach(() => localStorage.clear())

test.each([
    ["en-US", "en"],
    ["en_US", "en"],
    ["ja-JP", "ja"],
    ["ja_JP", "ja"],
    ["ru-RU", "en"],
    ["ru_RU", "en"],
])("initializes the interface from stored %s as %s", async (saved, expected) => {
    vi.resetModules()
    localStorage.setItem("language", saved)
    const { default: i18n } = await import("@/lib/i18n")
    expect(i18n.language).toBe(expected)
    expect(i18n.resolvedLanguage).toBe(expected)
})
