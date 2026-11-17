export const isNoteObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

export function parsePublicNote(raw = ""): unknown {
    try {
        return JSON.parse(raw.trim() ? raw : "{}")
    } catch {
        return undefined
    }
}
export const detectPublicNoteMode = (raw?: string): "structured" | "raw" =>
    parsePublicNote(raw) === undefined ? "raw" : "structured"

interface Member {
    key: string
    start: number
    valueStart: number
    end: number
}
/** JSON.parse validates first; token spans let untouched values keep their exact bytes. */
function members(raw: string): { fields: Member[]; end: number } {
    const tokens = [...raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^{}\[\],:\s]+/g)]
    const fields: Member[] = []
    let index = 1
    while (tokens[index][0] !== "}") {
        const key = tokens[index]
        index += 2
        const start = tokens[index]
        if (start[0] === "{" || start[0] === "[") {
            let depth = 0
            do {
                const token = tokens[index++][0]
                if (token === "{" || token === "[") depth++
                if (token === "}" || token === "]") depth--
            } while (depth)
        } else index++
        const last = tokens[index - 1]
        fields.push({
            key: JSON.parse(key[0]),
            start: key.index,
            valueStart: start.index,
            end: last.index + last[0].length,
        })
        if (tokens[index][0] === ",") index++
    }
    return { fields, end: tokens[index].index }
}
function patchObject(raw: string, key: string, value: string | undefined): string {
    const { fields, end } = members(raw)
    const index = fields.map((field) => field.key).lastIndexOf(key)
    const field = fields[index]
    if (field) {
        if (value !== undefined)
            return raw.slice(0, field.valueStart) + value + raw.slice(field.end)
        const from = index === fields.length - 1 && index > 0 ? fields[index - 1].end : field.start
        const to = fields[index + 1]?.start ?? field.end
        const removed = raw.slice(0, from) + raw.slice(to)
        // Deleting a duplicate key must not reveal an earlier, shadowed value.
        return patchObject(removed, key, undefined)
    }
    return value === undefined
        ? raw
        : raw.slice(0, end) +
              (fields.length ? "," : "") +
              JSON.stringify(key) +
              ":" +
              value +
              raw.slice(end)
}
export function patchPublicNote(
    raw: string,
    section: string,
    key: string,
    value: string | undefined,
): string {
    const source = raw.trim() ? raw : "{}"
    const parsed = parsePublicNote(source)
    if (!isNoteObject(parsed) || (section in parsed && !isNoteObject(parsed[section]))) return raw
    const group = members(source)
        .fields.filter((field) => field.key === section)
        .pop()
    const previous = group ? source.slice(group.valueStart, group.end) : "{}"
    const next = patchObject(previous, key, value === undefined ? undefined : JSON.stringify(value))
    if (next === previous) return raw
    return patchObject(source, section, next)
}
