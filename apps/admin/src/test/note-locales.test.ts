import i18n from "@/lib/i18n"
import { expect, test } from "vitest"

test.each(["en", "zh-CN", "zh-TW", "ja"])(
    "note form labels and errors resolve in %s",
    (language) => {
        for (const key of [
            "PublicNote.Time",
            "PrivateNote.Label",
            "PrivateNote.RawText",
            "PrivateNote.Key",
            "PrivateNote.Value",
            "PrivateNote.Type",
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
