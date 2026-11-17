export function parseDecimal(value: string): number | undefined {
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}
