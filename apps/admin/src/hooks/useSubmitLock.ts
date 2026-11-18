import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

export function useErrorToast() {
    const toastId = useRef<ReturnType<typeof toast.error> | undefined>(undefined)
    const dismissError = useCallback(() => {
        if (toastId.current !== undefined) {
            toast.dismiss(toastId.current)
            toastId.current = undefined
        }
    }, [])
    const showError = useCallback((...args: Parameters<typeof toast.error>) => {
        dismissError()
        toastId.current = toast.error(...args)
    }, [dismissError])
    return { showError, dismissError }
}

export function useSubmitLock() {
    const { showError, dismissError } = useErrorToast()
    const [submitting, setSubmitting] = useState(false)
    const lockRef = useRef(false)

    const runSubmit = useCallback(
        <Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) =>
            async (...args: Args) => {
                if (lockRef.current) return
                lockRef.current = true
                setSubmitting(true)
                dismissError()
                try {
                    await fn(...args)
                } finally {
                    lockRef.current = false
                    setSubmitting(false)
                }
            },
        [dismissError],
    )

    return { submitting, runSubmit, showError, dismissError }
}
