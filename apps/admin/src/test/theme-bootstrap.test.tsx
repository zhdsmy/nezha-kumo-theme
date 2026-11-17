import {
    DEFAULT_THEME,
    THEME_STORAGE_KEY,
    THEME_VALUES,
    ThemeProvider,
    applyResolvedTheme,
    normalizeTheme,
    resolveTheme,
} from "@/components/theme-provider"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import indexHtml from "../../index.html?raw"

function extractPrePaintScript(html: string): string {
    const match = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>[\s\S]*?<\/head>/)
    if (!match) {
        throw new Error("Missing pre-paint inline <script> in apps/admin/index.html <head>")
    }
    return match[1]
}

afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.removeAttribute("data-mode")
    document.documentElement.style.colorScheme = ""
    document.documentElement.classList.remove("light", "dark")
    vi.restoreAllMocks()
})

describe("pre-paint theme bootstrap & ThemeProvider parity", () => {
    test("pure helpers normalize and resolve light, dark, and system themes", () => {
        expect(THEME_STORAGE_KEY).toBe("vite-ui-theme")
        expect(DEFAULT_THEME).toBe("system")
        expect(THEME_VALUES).toEqual(["light", "dark", "system"])

        expect(normalizeTheme("light")).toBe("light")
        expect(normalizeTheme("dark")).toBe("dark")
        expect(normalizeTheme("system")).toBe("system")
        expect(normalizeTheme(null)).toBe("system")
        expect(normalizeTheme("unexpected")).toBe("system")

        expect(resolveTheme("light", true)).toBe("light")
        expect(resolveTheme("dark", false)).toBe("dark")
        expect(resolveTheme("system", true)).toBe("dark")
        expect(resolveTheme("system", false)).toBe("light")
    })

    test("index.html inline script references canonical source and matches applyResolvedTheme for light, dark, and system", () => {
        const script = extractPrePaintScript(indexHtml)
        expect(script).toContain("src/components/theme-provider.tsx")
        expect(script).toContain(`"${THEME_STORAGE_KEY}"`)
        for (const value of THEME_VALUES) {
            expect(script).toContain(`"${value}"`)
        }

        const runInlineBootstrap = new Function(
            "document",
            "localStorage",
            "matchMedia",
            script,
        ) as (
            doc: Pick<Document, "documentElement">,
            storage: Pick<Storage, "getItem">,
            mm: ((query: string) => { matches: boolean }) | undefined,
        ) => void

        const cases: Array<{
            name: string
            stored: string | null | "throw"
            prefersDark: boolean
            expected: "light" | "dark"
        }> = [
            { name: "stored light", stored: "light", prefersDark: true, expected: "light" },
            { name: "stored dark", stored: "dark", prefersDark: false, expected: "dark" },
            {
                name: "stored system + prefers dark",
                stored: "system",
                prefersDark: true,
                expected: "dark",
            },
            {
                name: "stored system + prefers light",
                stored: "system",
                prefersDark: false,
                expected: "light",
            },
            {
                name: "missing key defaults to system (dark)",
                stored: null,
                prefersDark: true,
                expected: "dark",
            },
            {
                name: "invalid key defaults to system (light)",
                stored: "sepia",
                prefersDark: false,
                expected: "light",
            },
            {
                name: "throwing storage falls back to system (dark)",
                stored: "throw",
                prefersDark: true,
                expected: "dark",
            },
        ]

        for (const { name, stored, prefersDark, expected } of cases) {
            const inlineRoot = document.createElement("html")
            inlineRoot.classList.add(expected === "dark" ? "light" : "dark")
            const providerRoot = document.createElement("html")
            providerRoot.classList.add(expected === "dark" ? "light" : "dark")

            const mockStorage: Pick<Storage, "getItem"> = {
                getItem: (key: string) => {
                    expect(key).toBe(THEME_STORAGE_KEY)
                    if (stored === "throw") {
                        throw new Error("SecurityError")
                    }
                    return stored
                },
            }

            runInlineBootstrap(
                { documentElement: inlineRoot },
                mockStorage,
                () => ({ matches: prefersDark }),
            )

            const normalized = normalizeTheme(stored === "throw" ? null : stored)
            applyResolvedTheme(providerRoot, resolveTheme(normalized, prefersDark))

            expect(inlineRoot.dataset.mode, name).toBe(expected)
            expect(inlineRoot.style.colorScheme, name).toBe(expected)
            expect(inlineRoot.classList.contains(expected), name).toBe(true)
            expect(
                inlineRoot.classList.contains(expected === "dark" ? "light" : "dark"),
                name,
            ).toBe(false)

            expect(inlineRoot.outerHTML, name).toBe(providerRoot.outerHTML)
        }
    })

    test("ThemeProvider preserves resolved markers and tracks system color-scheme changes", () => {
        let prefersDark = true
        const listeners = new Set<() => void>()

        vi.spyOn(window, "matchMedia").mockImplementation(
            (query: string) =>
                ({
                    get matches() {
                        return query === "(prefers-color-scheme: dark)" ? prefersDark : false
                    },
                    media: query,
                    onchange: null,
                    addEventListener: (_event: string, cb: () => void) => {
                        listeners.add(cb)
                    },
                    removeEventListener: (_event: string, cb: () => void) => {
                        listeners.delete(cb)
                    },
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                }) as unknown as MediaQueryList,
        )

        localStorage.setItem(THEME_STORAGE_KEY, "system")
        render(
            <ThemeProvider>
                <div>child</div>
            </ThemeProvider>,
        )

        expect(document.documentElement.dataset.mode).toBe("dark")
        expect(document.documentElement.style.colorScheme).toBe("dark")
        expect(document.documentElement.classList.contains("dark")).toBe(true)

        act(() => {
            prefersDark = false
            for (const listener of listeners) {
                listener()
            }
        })

        expect(document.documentElement.dataset.mode).toBe("light")
        expect(document.documentElement.style.colorScheme).toBe("light")
        expect(document.documentElement.classList.contains("light")).toBe(true)
    })
})
