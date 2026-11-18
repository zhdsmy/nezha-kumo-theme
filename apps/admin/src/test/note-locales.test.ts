import i18n from "@/lib/i18n"
import { expect, test } from "vitest"

test.each(["en", "zh-CN", "zh-TW", "ja"])(
    "note form labels and errors resolve in %s",
    (language) => {
        for (const key of [
            "PublicNote.Time",
            "PublicNote.Count",
            "PrivateNote.Label",
            "PrivateNote.RawText",
            "PrivateNote.Key",
            "PrivateNote.Value",
            "PrivateNote.Type",
            "PrivateNote.AddRowIn",
            "PrivateNote.EmptyKey",
            "PrivateNote.DuplicateKey",
            "PrivateNote.NumberRequired",
            "PrivateNote.DepthLimit",
            "PrivateNote.FollowPublicCycle",
            "PrivateNote.ConfirmType",
            ...["string", "number", "boolean", "null", "object", "array"].map(
                (type) => `PrivateNote.Types.${type}`,
            ),
        ])
            expect(i18n.getResource(language, "translation", key), key).toBeTruthy()
    },
)

test("all 4 locales share the exact same leaf key set", () => {
    const flatten = (obj: Record<string, unknown>, prefix = ""): string[] =>
        Object.entries(obj)
            .flatMap(([k, v]) =>
                v && typeof v === "object" && !Array.isArray(v)
                    ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
                    : [`${prefix}${k}`],
            )
            .sort()
    const base = flatten(i18n.getResourceBundle("en", "translation") as Record<string, unknown>)
    for (const lang of ["zh-CN", "zh-TW", "ja"]) {
        const current = flatten(
            i18n.getResourceBundle(lang, "translation") as Record<string, unknown>,
        )
        expect(current, lang).toEqual(base)
    }
})

