import { useCallback, useSyncExternalStore } from "react"

export function useMediaQuery(query: string) {
    const subscribe = useCallback(
        (callback: () => void) => {
            if (typeof matchMedia === "undefined") return () => {}
            const result = matchMedia(query)
            result.addEventListener("change", callback)
            return () => result.removeEventListener("change", callback)
        },
        [query],
    )

    const getSnapshot = useCallback(
        () => typeof matchMedia !== "undefined" && matchMedia(query).matches,
        [query],
    )

    return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
