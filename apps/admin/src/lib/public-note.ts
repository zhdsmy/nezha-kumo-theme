import { isNoteObject, parseJsonNote, patchJsonNote, prepareJsonNote } from "./json-note"

export function patchPublicNote(
    raw: string,
    section: string,
    key: string,
    value: string | undefined,
): string {
    return patchJsonNote(raw, [section, key], value)
}

export function preparePublicNote(raw: string, mode: "structured" | "raw"): string {
    if (mode === "raw") return prepareJsonNote(raw, mode)
    const parsed = parseJsonNote(raw)
    if (!isNoteObject(parsed)) return raw
    let result = raw
    for (const key of ["billingDataMod", "planDataMod"])
        if (isNoteObject(parsed[key]) && !Object.keys(parsed[key]).length)
            result = patchJsonNote(result, [key], undefined)
    return prepareJsonNote(result, mode)
}
