import { afterEach, expect, it, vi } from "vitest"

import { resilientSocket } from "../src/core/http"

class Socket {
    static instances: Socket[] = []
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    close = vi.fn(() => this.onclose?.())
    constructor() {
        Socket.instances.push(this)
    }
}

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Socket.instances = []
})

it("reconnects a silent open socket, ignores invalid frames, and cancels its timers on stop", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("WebSocket", Socket)
    const status = vi.fn()
    const connection = resilientSocket({
        url: () => "ws://test",
        onMessage: (data) => data === "valid",
        onStatus: status,
    })
    const first = Socket.instances[0]
    first.onopen?.()
    first.onmessage?.({ data: "valid" })
    expect(status).toHaveBeenLastCalledWith("open")
    await vi.advanceTimersByTimeAsync(20_000)
    first.onmessage?.({ data: "invalid" })
    await vi.advanceTimersByTimeAsync(10_001)
    expect(first.close).toHaveBeenCalledOnce()
    expect(status).toHaveBeenLastCalledWith("closed")
    await vi.advanceTimersByTimeAsync(2000)
    expect(Socket.instances).toHaveLength(2)
    Socket.instances[1].onopen?.()
    expect(status).toHaveBeenLastCalledWith("connecting")
    connection.close()
    expect(vi.getTimerCount()).toBe(0)
})
