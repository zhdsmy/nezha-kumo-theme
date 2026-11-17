// API collections can be null; preserve other malformed values for schema validation.
export function withCollectionDefaults<T extends object>(
    data: T,
    arrays: (keyof T)[],
    maps: (keyof T)[] = [],
): T {
    return {
        ...data,
        ...Object.fromEntries(arrays.map((field) => [field, data[field] ?? []])),
        ...Object.fromEntries(maps.map((field) => [field, data[field] ?? {}])),
    }
}
