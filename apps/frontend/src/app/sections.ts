export const SECTIONS = ["overview", "latency", "billing", "history"] as const
export type Section = (typeof SECTIONS)[number]
