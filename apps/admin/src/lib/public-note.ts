import { isNoteObject, parseJsonNote, patchJsonNote } from "./json-note"

export { isNoteObject } from "./json-note"
export const parsePublicNote = parseJsonNote
export const detectPublicNoteMode = (raw?: string): "structured" | "raw" =>
    parsePublicNote(raw) === undefined ? "raw" : "structured"

export function patchPublicNote(
    raw: string,
    section: string,
    key: string,
    value: string | undefined,
): string {
    return patchJsonNote(raw, [section, key], value)
}

export function preparePublicNote(raw: string, mode: "structured" | "raw"): string {
    if (mode === "raw") return raw.trim()
    const parsed = parsePublicNote(raw)
    if (!isNoteObject(parsed)) return raw
    let result = raw
    for (const key of ["billingDataMod", "planDataMod"])
        if (isNoteObject(parsed[key]) && !Object.keys(parsed[key]).length)
            result = patchJsonNote(result, [key], undefined)
    return Object.keys(parsePublicNote(result) as object).length ? result : ""
}
