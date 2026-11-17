import { type JsonPath, jsonEntries, parseJsonNote } from "./json-note"
import { parseDecimal } from "./number"

export const JSON_TYPES = ["string", "number", "boolean", "null", "object", "array"] as const
export type JsonType = (typeof JSON_TYPES)[number]
export const jsonType = (value: unknown): JsonType =>
    value === null ? "null" : Array.isArray(value) ? "array" : (typeof value as JsonType)
export function convertJsonType(raw: string, type: JsonType): unknown {
    const value = parseJsonNote(raw)
    if (jsonType(value) === type) return value
    if (type === "string") return typeof value === "number" ? String(value) : ""
    if (type === "number") {
        return typeof value === "string" ? (parseDecimal(value) ?? null) : null
    }
    return type === "object" ? {} : type === "array" ? [] : type === "boolean" ? false : null
}

export function privateNoteErrors(
    raw: string,
    path: JsonPath = [],
    depth = 1,
): { path: JsonPath; error: "EmptyKey" | "DuplicateKey" }[] {
    if (depth > 4) return []
    const entries = jsonEntries(raw)
    return entries.flatMap((entry, index) => {
        const next = [...path, index]
        const error =
            typeof entry.key === "string" && !entry.key.trim()
                ? "EmptyKey"
                : typeof entry.key === "string" &&
                    entries.some((other, i) => i !== index && other.key === entry.key)
                  ? "DuplicateKey"
                  : undefined
        return [
            ...(error ? [{ path: next, error }] : []),
            ...privateNoteErrors(entry.raw, next, depth + 1),
        ] as { path: JsonPath; error: "EmptyKey" | "DuplicateKey" }[]
    })
}
