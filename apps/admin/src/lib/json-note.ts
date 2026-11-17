export const isNoteObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

export function parseJsonNote(raw = ""): unknown {
    try {
        return JSON.parse(raw.trim() ? raw : "{}")
    } catch {
        return undefined
    }
}

export type JsonPath = readonly (string | number)[]
interface Member {
    key: string | number
    start: number
    keyEnd: number
    valueStart: number
    end: number
}

/** JSON.parse validates first; token spans preserve the bytes outside an edited path. */
function members(raw: string): { fields: Member[]; end: number; array: boolean } {
    const tokens = [...raw.matchAll(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^{}[\],:\s]+/g)]
    const array = tokens[0][0] === "["
    const fields: Member[] = []
    let index = 1
    while (tokens[index][0] !== (array ? "]" : "}")) {
        const key = tokens[index]
        if (!array) index += 2
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
            key: array ? fields.length : JSON.parse(key[0]),
            start: key.index,
            keyEnd: key.index + key[0].length,
            valueStart: start.index,
            end: last.index + last[0].length,
        })
        if (tokens[index][0] === ",") index++
    }
    return { fields, end: tokens[index].index, array }
}

const container = (value: unknown) => isNoteObject(value) || Array.isArray(value)
const memberIndex = (fields: Member[], key: string | number) =>
    typeof key === "number" ? key : fields.map((field) => field.key).lastIndexOf(key)

export function jsonEntries(raw: string) {
    if (!container(parseJsonNote(raw))) return []
    return members(raw.trim() ? raw : "{}").fields.map((field) => ({
        key: field.key,
        raw: raw.slice(field.valueStart, field.end),
    }))
}

export function rawJsonAt(raw: string, path: JsonPath): string | undefined {
    if (!path.length) return raw.trim() ? raw : "{}"
    if (!container(parseJsonNote(raw))) return
    const fields = members(raw.trim() ? raw : "{}").fields
    const field = fields[memberIndex(fields, path[0])]
    return field ? rawJsonAt(raw.slice(field.valueStart, field.end), path.slice(1)) : undefined
}

function patchMember(raw: string, key: string | number, value: string | undefined): string {
    const { fields, array } = members(raw)
    const index = memberIndex(fields, key)
    const field = fields[index]
    if (field) {
        if (value !== undefined)
            return raw.slice(0, field.valueStart) + value + raw.slice(field.end)
        const from = index === fields.length - 1 && index > 0 ? fields[index - 1].end : field.start
        const to = fields[index + 1]?.start ?? field.end
        const removed = raw.slice(0, from) + raw.slice(to)
        // Removing a named duplicate must not reveal an earlier shadowed value.
        return typeof key === "string" ? patchMember(removed, key, undefined) : removed
    }
    if (value === undefined || (typeof key === "number" && (!array || key !== fields.length)))
        return raw
    if (array && typeof key !== "number") return raw
    return insertMember(raw, key, value)
}

function insertMember(raw: string, key: string | number, value: string): string {
    const { fields, end, array } = members(raw)
    const position = fields.at(-1)?.end ?? end
    const gap = fields.length ? raw.slice(raw.search(/[[{]/) + 1, fields[0].start) : ""
    const colon = fields.length ? raw.slice(fields[0].keyEnd, fields[0].valueStart) : ":"
    return (
        raw.slice(0, position) +
        (fields.length ? "," : "") +
        gap +
        (array ? "" : JSON.stringify(key) + colon) +
        value +
        raw.slice(position)
    )
}

function patchRaw(raw: string, path: JsonPath, value: string | undefined): string {
    if (!path.length) return value ?? ""
    const source = raw.trim() ? raw : "{}"
    if (!container(parseJsonNote(source))) return raw
    const [key, ...rest] = path
    const previous = rawJsonAt(source, [key])
    if (rest.length && previous === undefined && value === undefined) return raw
    const next = rest.length ? patchRaw(previous ?? "{}", rest, value) : value
    if (previous === next) return raw
    return patchMember(source, key, next)
}

export function patchJsonNote(raw: string, path: JsonPath, value: unknown): string {
    return patchRaw(raw, path, value === undefined ? undefined : JSON.stringify(value))
}

export function renameJsonKey(raw: string, path: JsonPath, key: string): string {
    const parent = path.slice(0, -1)
    const source = rawJsonAt(raw, parent)
    if (!source || !isNoteObject(parseJsonNote(source))) return raw
    const fields = members(source).fields
    const field = fields[memberIndex(fields, path.at(-1)!)]
    if (!field || field.key === key) return raw
    return patchRaw(
        raw,
        parent,
        source.slice(0, field.start) + JSON.stringify(key) + source.slice(field.keyEnd),
    )
}

export function moveJsonItem(raw: string, path: JsonPath, from: number, to: number): string {
    const source = rawJsonAt(raw, path)
    if (!source || !Array.isArray(parseJsonNote(source))) return raw
    const { fields } = members(source)
    if (from === to || !fields[from] || !fields[to]) return raw
    const item = fields[from]
    const next = fields[from + 1]
    const separator = next
        ? source.slice(item.end, next.start)
        : source.slice(fields[from - 1].end, item.start)
    const remaining = next
        ? source.slice(0, item.start) + source.slice(next.start)
        : source.slice(0, fields[from - 1].end) + source.slice(item.end)
    const rest = members(remaining).fields
    const position = rest[to]?.start ?? rest.at(-1)!.end
    const value = source.slice(item.valueStart, item.end)
    const insertion = rest[to] ? value + separator : separator + value
    return patchRaw(raw, path, remaining.slice(0, position) + insertion + remaining.slice(position))
}

export function appendJsonEntry(raw: string, path: JsonPath, key: string, value: unknown): string {
    const source = rawJsonAt(raw, path)
    if (!source || !container(parseJsonNote(source))) return raw
    return patchRaw(raw, path, insertMember(source, key, JSON.stringify(value)))
}
