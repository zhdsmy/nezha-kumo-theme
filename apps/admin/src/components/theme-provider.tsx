import { createContext, useContext, useEffect, useState } from "react"

// Canonical theme constants & markers. Keep the pre-paint inline script in
// apps/admin/index.html synchronized with THEME_STORAGE_KEY, THEME_VALUES,
// DEFAULT_THEME, resolveTheme, and applyResolvedTheme.
export const THEME_STORAGE_KEY = "vite-ui-theme"
export const THEME_VALUES = ["light", "dark", "system"] as const
export type Theme = (typeof THEME_VALUES)[number]
export type ResolvedTheme = Exclude<Theme, "system">
export const DEFAULT_THEME: Theme = "system"

export function normalizeTheme(
    stored: string | null | undefined,
    fallback: Theme = DEFAULT_THEME,
): Theme {
    return (THEME_VALUES as readonly string[]).includes(stored ?? "")
        ? (stored as Theme)
        : fallback
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
    if (theme === "system") {
        return prefersDark ? "dark" : "light"
    }
    return theme
}

export function applyResolvedTheme(root: HTMLElement, resolved: ResolvedTheme): void {
    root.classList.remove("light", "dark")
    root.classList.add(resolved)
    root.dataset.mode = resolved
    root.style.colorScheme = resolved
}

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
    try {
        return normalizeTheme(localStorage.getItem(storageKey), fallback)
    } catch {
        return fallback
    }
}

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    resolvedTheme: ResolvedTheme
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: DEFAULT_THEME,
    resolvedTheme: "light",
    setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = DEFAULT_THEME,
    storageKey = THEME_STORAGE_KEY,
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme))

    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
        resolveTheme(theme, window.matchMedia("(prefers-color-scheme: dark)").matches),
    )

    useEffect(() => {
        const root = window.document.documentElement
        const media = window.matchMedia("(prefers-color-scheme: dark)")

        const sync = () => {
            const resolved = resolveTheme(theme, media.matches)
            applyResolvedTheme(root, resolved)
            setResolvedTheme(resolved)
        }
        sync()

        if (theme !== "system" || typeof media.addEventListener !== "function") {
            return
        }
        media.addEventListener("change", sync)
        return () => media.removeEventListener("change", sync)
    }, [theme])

    const value = {
        theme,
        resolvedTheme,
        setTheme: (nextTheme: Theme) => {
            try {
                localStorage.setItem(storageKey, nextTheme)
            } catch {
                // Ignore storage write errors in private/restricted WebViews.
            }
            setTheme(nextTheme)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
