import { copyToClipboard } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export function useClipboard() {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const pending = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])

    const copy = async (text: string) => {
        if (pending.current || timer.current) return
        pending.current = true
        try {
            await copyToClipboard(text)
            setCopied(true)
            timer.current = setTimeout(() => {
                setCopied(false)
                timer.current = undefined
            }, 2000)
        } catch {
            toast.error(t("Error"), { description: t("ClipboardWriteFailed") })
        } finally {
            pending.current = false
        }
    }
    return { copied, copy }
}
