import { ButtonProps } from "@/components/ui/button"
import { useClipboard } from "@/hooks/useClipboard"
import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { IconButton } from "./xui/icon-button"

interface CopyButtonProps extends ButtonProps {
    text?: string
}

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>((props, ref) => {
    const { t } = useTranslation()
    const { copied, copy: copyText } = useClipboard()

    const switchState = async (text?: string) => {
        if (!text) {
            toast.warning(t("Warning"), {
                description: t("EmptyText"),
            })
            return
        }

        await copyText(text)
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
