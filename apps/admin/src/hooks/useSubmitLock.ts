import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

export function useSubmitLock() {
    const [submitting, setSubmitting] = useState(false)
    const lockRef = useRef(false)

    const runSubmit = useCallback(
        <Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) =>
            async (...args: Args) => {
                if (lockRef.current) return
                lockRef.current = true
                setSubmitting(true)
                toast.dismiss?.()
                try {
                    await fn(...args)
                } finally {
                    lockRef.current = false
                    setSubmitting(false)
                }
            },
        [],
    )

    return { submitting, runSubmit }
}
