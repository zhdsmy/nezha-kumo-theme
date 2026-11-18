import { useNotification } from "@/hooks/useNotfication"
import { useServer } from "@/hooks/useServer"
import { useServerStore } from "@/hooks/useServerStore"
import type { ServerIdentifierType } from "@/types"
import useSWR from "swr"

export function entityNames(entities?: ServerIdentifierType[]) {
    const names = new Map(entities?.map(({ id, name }) => [id, name]))
    return (id: number | string) => names.get(Number(id)) || `#${id}`
}

export function useServerNames() {
    const { servers } = useServer()
    const stored = useServerStore((store) => store.server)
    const { data } = useSWR<ServerIdentifierType[]>("/api/v1/server", null)
    return entityNames(servers ?? data ?? stored)
}

export function useNotificationGroupNames() {
    return entityNames(useNotification().notifierGroup?.map(({ group }) => group))
}

export function useTaskNames() {
    const { data } = useSWR<ServerIdentifierType[]>("/api/v1/cron", null)
    return entityNames(data)
}
