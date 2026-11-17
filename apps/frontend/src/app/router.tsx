// Adapted from zool-theme/src/app/router.tsx (MIT, luoleiorg).
import { getShellScroller } from "@nezha-kumo/ui/scroller"
import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from "react"

const EVENT = "nkt:navigate"
export const RESET_EVENT = "nkt:reset"
const scrollPositions = new Map<string, number>()

const pageKey = (u: Pick<Location | URL, "pathname" | "search">) => u.pathname + u.search
let currentKey = typeof window !== "undefined" ? pageKey(window.location) : "/"
let lastListHref =
    typeof window !== "undefined" && window.location.pathname === "/" ? currentKey : "/"

if (typeof history !== "undefined" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual"
}

const syncLastList = () => {
    if (window.location.pathname === "/") lastListHref = pageKey(window.location)
}

const restoreScroll = (y: number) => {
    const scroller = getShellScroller()
    if (scroller) scroller.scrollTop = y
    if (y > 0) {
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const next = getShellScroller()
                if (next) next.scrollTop = y
            }),
        )
    }
}

const subscribe = (l: () => void) => {
    window.addEventListener("popstate", l)
    window.addEventListener("hashchange", l)
    window.addEventListener(EVENT, l)
    return () => {
        window.removeEventListener("popstate", l)
        window.removeEventListener("hashchange", l)
        window.removeEventListener(EVENT, l)
    }
}

export const usePathname = () =>
    useSyncExternalStore(
        subscribe,
        () => window.location.pathname + window.location.search + window.location.hash,
        () => "/",
    )

export const useLastListHref = () =>
    useSyncExternalStore(
        subscribe,
        () => lastListHref,
        () => "/",
    )

export interface NavigateOptions {
    replace?: boolean
    reset?: boolean
}

export function navigate(to: string, opts: NavigateOptions = {}) {
    const currentFull = window.location.pathname + window.location.search + window.location.hash
    if (opts.reset) window.dispatchEvent(new Event(RESET_EVENT))
    if (to === currentFull) {
        if (opts.reset) restoreScroll(0)
        return
    }
    const fromPath = window.location.pathname
    const fromKey = pageKey(window.location)
    const target = new URL(to, window.location.origin)
    const toKey = pageKey(target)
    const inPage =
        opts.replace ?? (!opts.reset && toKey === fromKey && target.hash !== window.location.hash)
    if (inPage) {
        history.replaceState(null, "", to)
        currentKey = toKey
        syncLastList()
        window.dispatchEvent(new Event(EVENT))
        return
    }
    const returningToList = !opts.reset && fromPath !== "/" && toKey === lastListHref
    scrollPositions.set(fromKey, getShellScroller()?.scrollTop ?? 0)
    history.pushState(null, "", to)
    currentKey = toKey
    syncLastList()
    window.dispatchEvent(new Event(EVENT))
    restoreScroll(returningToList ? (scrollPositions.get(toKey) ?? 0) : 0)
}

if (typeof window !== "undefined") {
    window.addEventListener("popstate", () => {
        const nextKey = pageKey(window.location)
        if (nextKey !== currentKey) {
            scrollPositions.set(currentKey, getShellScroller()?.scrollTop ?? 0)
            currentKey = nextKey
        }
        syncLastList()
        restoreScroll(scrollPositions.get(nextKey) ?? 0)
    })
}

export function Link({
    href,
    replace,
    reset,
    onClick,
    ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    replace?: boolean
    reset?: boolean
}) {
    const handle = (e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        if (
            e.defaultPrevented ||
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
        )
            return
        if (rest.target && rest.target !== "_self") return
        e.preventDefault()
        navigate(href, { replace, reset })
    }
    return <a href={href} onClick={handle} {...rest} />
}
