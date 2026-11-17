import { ButtonProps } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/utils"
import { forwardRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { IconButton } from "./xui/icon-button"

interface CopyButtonProps extends ButtonProps {
    text?: string
}

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>((props, ref) => {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    const switchState = async (text?: string) => {
        if (!text) {
            toast(t("Warning"), {
                description: t("EmptyText"),
            })
            return
        }

        if (!copied) {
            try {
                await copyToClipboard(text)
                setCopied(true)
                setTimeout(() => {
                    setCopied(false)
                }, 2 * 1000)
            } catch {
                toast(t("Error"), {
                    description: t("ClipboardWriteFailed"),
                })
            }
        }
    }

    return (
        <IconButton
            {...props}
            ref={ref}
            aria-label={props["aria-label"] ?? (copied ? t("Copied") : t("Copy"))}
            variant="outline"
            size="icon"
            icon={copied ? "check" : "clipboard"}
            onClick={() => switchState(props.text)}
        />
    )
})
CopyButton.displayName = "CopyButton"
