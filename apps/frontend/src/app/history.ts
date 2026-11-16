import { HISTORY_CACHE_MS, nezha } from "@/adapters/nezha"
import { pollVisible } from "@/core/http"
import type { HistoryPoint, NodeInfo } from "@/core/model"
import { useEffect, useState } from "react"

import { useStore } from "./store"

export function useDailyCounters(nodes: readonly NodeInfo[]) {
    const hours = useStore((s) => s.site?.recordHours ?? 0)
    const key = nodes.map((n) => n.id).join(",")
    const [result, setResult] = useState<{ key: string; points: Record<string, HistoryPoint[]> }>({
        key: "",
        points: {},
    })
    useEffect(() => {
        if (!hours) return
        let active = true
        const stop = pollVisible(async () => {
            const entries = await Promise.all(
                key
                    .split(",")
                    .filter(Boolean)
                    .map(
                        async (id) =>
                            [
                                id,
                                await nezha.loadHistory(id, 24, "counters").catch(() => []),
                            ] as const,
                    ),
            )
            if (active) setResult({ key, points: Object.fromEntries(entries) })
        }, HISTORY_CACHE_MS)
        return () => {
            active = false
            stop()
        }
    }, [key, hours])
    return hours && result.key === key ? result.points : null
}
