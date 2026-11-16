export const SECTIONS = ["overview", "load", "latency", "history"] as const
export type Section = (typeof SECTIONS)[number]
