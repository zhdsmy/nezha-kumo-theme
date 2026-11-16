// Adapted from zool-theme/src/app/prefs.ts (MIT, luoleiorg).
import type { Appearance } from "@/core/settings"
import { readStorage, writeStorage } from "@/core/storage"
import { useSyncExternalStore } from "react"

const KEYS = { appearance: "nkt:appearance", shave: "nkt:ping-shave" } as const

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
}

/* ---------- appearance ---------- */

const media = window.matchMedia("(prefers-color-scheme: dark)")
let defaultAppearance: Appearance = "system"

const storedAppearance = (): Appearance | null => {
    const v = readStorage(KEYS.appearance)
    return v === "light" || v === "dark" || v === "system" ? v : null
}

const getAppearance = (): Appearance => storedAppearance() ?? defaultAppearance

export function applyAppearance() {
    const mode = getAppearance()
    const dark = mode === "dark" || (mode === "system" && media.matches)
    const root = document.documentElement
    root.dataset.mode = dark ? "dark" : "light"
    root.style.colorScheme = dark ? "dark" : "light"
}

export function setAppearance(mode: Appearance) {
    writeStorage(KEYS.appearance, mode)
    applyAppearance()
    emit()
}

export function setDefaultAppearance(mode: Appearance) {
    defaultAppearance = mode
    applyAppearance()
    emit()
}

media.addEventListener("change", () => {
    applyAppearance()
    emit()
})

export const useAppearance = () => useSyncExternalStore(subscribe, getAppearance, getAppearance)

/* ---------- latency spike shaving ---------- */

const getShave = () => readStorage(KEYS.shave) === "1"

export function setShave(on: boolean) {
    writeStorage(KEYS.shave, on ? "1" : "0")
    emit()
}

export const useShave = () => useSyncExternalStore(subscribe, getShave, getShave)
