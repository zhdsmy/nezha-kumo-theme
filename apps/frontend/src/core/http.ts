// Adapted from zool-theme/src/core/http.ts (MIT, luoleiorg).
class HttpError extends Error {
    constructor(
        public status: number,
        public body: unknown,
    ) {
        super(`HTTP ${status}`)
    }
}

// All HTTP work shares one queue; hidden tabs never start queued refreshes.
const MAX_REQUESTS = 4
let running = 0
const queue: (() => void)[] = []
const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden"
function pump() {
    while (running < MAX_REQUESTS && queue.length && visible()) queue.shift()!()
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", pump)

let unloading = false
if (typeof window !== "undefined") {
    for (const ev of ["beforeunload", "pagehide"])
        window.addEventListener?.(ev, () => {
            unloading = true
        })
    window.addEventListener?.("pageshow", () => {
        unloading = false
    })
}

export const abortError = (signal?: AbortSignal) =>
    signal?.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError")

export function isCanceledError(error: unknown, signal?: AbortSignal, sameOrigin = false) {
    if (signal?.aborted || unloading) return true
    if (!(error instanceof Error)) return false
    if (error.name === "AbortError") return true
    return sameOrigin && error.name === "TypeError" && /access control checks/i.test(error.message)
}

export function request<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
    const ext = init.signal ?? undefined
    if (ext?.aborted) return Promise.reject(abortError(ext))
    return new Promise((resolve, reject) => {
        const start = () => {
            ext?.removeEventListener("abort", onQueueAbort)
            if (ext?.aborted) {
                reject(abortError(ext))
                return
            }
            running++
            void fetchRequest<T>(url, init, timeoutMs)
                .then(resolve, reject)
                .finally(() => {
                    running--
                    pump()
                })
        }
        const onQueueAbort = () => {
            const idx = queue.indexOf(start)
            if (idx >= 0) queue.splice(idx, 1)
            reject(abortError(ext))
        }
        ext?.addEventListener("abort", onQueueAbort, { once: true })
        queue.push(start)
        pump()
    })
}

/** Poll only while visible, without overlapping slow requests or accumulating hidden work. */
export function pollVisible(load: () => Promise<unknown>, interval: number) {
    let stopped = false,
        busy = false,
        due = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
        clearTimeout(timer)
        if (stopped || busy || !visible()) return
        if (Date.now() < due) {
            timer = setTimeout(() => void tick(), due - Date.now())
            return
        }
        busy = true
        try {
            await load()
        } catch (err) {
            if (!isCanceledError(err)) console.error("[nezha-kumo] poll failed", err)
        } finally {
            busy = false
            due = Date.now() + interval
            if (!stopped && visible()) timer = setTimeout(() => void tick(), interval)
        }
    }
    document.addEventListener("visibilitychange", tick)
    void tick()
    return () => {
        stopped = true
        clearTimeout(timer)
        document.removeEventListener("visibilitychange", tick)
    }
}

async function fetchRequest<T>(
    url: string,
    init: RequestInit = {},
    timeoutMs = 15_000,
): Promise<T> {
    const ctrl = new AbortController()
    let timedOut = false
    const ext = init.signal ?? undefined
    const onAbort = () => ctrl.abort(ext?.reason)
    ext?.addEventListener("abort", onAbort, { once: true })
    const timer = setTimeout(() => {
        timedOut = true
        ctrl.abort()
    }, timeoutMs)
    try {
        const res = await fetch(url, {
            credentials: "same-origin",
            ...init,
            headers: {
                accept: "application/json",
                ...(init.body ? { "content-type": "application/json" } : {}),
                ...init.headers,
            },
            signal: ctrl.signal,
        })
        const text = await res.text()
        let body: unknown = text
        try {
            body = text ? JSON.parse(text) : null
        } catch {
            /* keep text */
        }
        if (!res.ok) throw new HttpError(res.status, body)
        return body as T
    } catch (err) {
        if (timedOut) throw new Error("Request timeout")
        if (isCanceledError(err, ext, url.startsWith("/"))) throw abortError(ext)
        throw err
    } finally {
        clearTimeout(timer)
        ext?.removeEventListener("abort", onAbort)
    }
}

export const wsUrl = (path: string) => {
    const { protocol, host } = window.location
    return `${protocol === "https:" ? "wss" : "ws"}://${host}${path}`
}

/** A WebSocket that reconnects with capped backoff. */
export function resilientSocket(opts: {
    url: () => string
    onOpen?: (ws: WebSocket) => void
    onMessage: (data: string) => void
    onStatus?: (status: "connecting" | "open" | "closed") => void
    onGiveUp?: () => void
    maxFailures?: number
}) {
    let ws: WebSocket | null = null
    let stopped = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
        if (stopped) return
        opts.onStatus?.("connecting")
        let socket: WebSocket
        try {
            socket = new WebSocket(opts.url())
        } catch {
            // e.g. blocked by CSP or mixed content; keep the retry chain alive.
            failures++
            timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** Math.min(failures, 4)))
            return
        }
        ws = socket
        let opened = false
        socket.onopen = () => {
            opened = true
            failures = 0
            opts.onStatus?.("open")
            opts.onOpen?.(socket)
        }
        socket.onmessage = (e) => {
            if (typeof e.data === "string") opts.onMessage(e.data)
        }
        socket.onclose = () => {
            if (ws !== socket) return
            ws = null
            opts.onStatus?.("closed")
            if (stopped) return
            // Count drops after a successful open too, so a flapping server backs off.
            failures++
            if (!opened && opts.maxFailures && failures >= opts.maxFailures) {
                opts.onGiveUp?.()
                return
            }
            const delay = Math.min(15_000, 1000 * 2 ** Math.min(failures, 4))
            timer = setTimeout(connect, delay)
        }
    }

    connect()
    return {
        get socket() {
            return ws
        },
        close() {
            stopped = true
            clearTimeout(timer)
            ws?.close()
            ws = null
        },
    }
}
