import { loadCounters } from "@/adapters/nezha"
import type { HistoryPoint, NodeInfo } from "@/core/model"
import { useEffect, useState } from "react"

import { useStore } from "./store"

// Only counters are needed for the fleet tile; keep concurrency bounded to four servers.
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
        const queue = key.split(",").filter(Boolean)
        const points: Record<string, HistoryPoint[]> = {}
        const worker = async () => {
            for (let id = queue.shift(); id && active; id = queue.shift()) {
                points[id] = await loadCounters(id).catch(() => [])
            }
        }
        const load = async () => {
            await Promise.all(Array.from({ length: 4 }, worker))
            if (active) setResult({ key, points: { ...points } })
        }
        void load()
        const timer = window.setInterval(() => {
            queue.push(...key.split(",").filter(Boolean))
            void load()
        }, 300_000)
        return () => {
            active = false
            clearInterval(timer)
        }
    }, [key, hours])
    return hours && result.key === key ? result.points : null
}
