class TestWorker implements Worker {
    onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null
    onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null
    onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null

    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
        return true
    }
    postMessage(): void {}
    terminate(): void {}
}

class TestResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

class TestIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin = ""
    readonly scrollMargin = ""
    readonly thresholds: ReadonlyArray<number> = []

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
        return []
    }
}

globalThis.Worker = TestWorker
globalThis.ResizeObserver = TestResizeObserver
globalThis.IntersectionObserver = TestIntersectionObserver

// jsdom has no viewport media queries; existing route tests use the desktop layout.
globalThis.matchMedia = (media: string) => ({
    media,
    matches: media.startsWith("(min-width:") && 1440 >= Number(media.match(/\d+/)?.[0]),
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
})

Element.prototype.getAnimations ??= () => []

