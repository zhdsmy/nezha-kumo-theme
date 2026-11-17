export function getShellScroller(): HTMLElement | null {
    return typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".nk-main")
}
