/** Browser storage can be disabled; preferences must still work for the current page. */
export function readStorage(key: string) {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}
export function writeStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value)
    } catch {
        /* private mode */
    }
}
