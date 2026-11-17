// API array fields can be null; preserve other malformed values for schema validation.
export function withArrayDefaults<T extends object>(data: T, fields: (keyof T)[]): T {
    return { ...data, ...Object.fromEntries(fields.map((field) => [field, data[field] ?? []])) }
}
