import { ButtonProps } from "@/components/ui/button"
import { useClipboard } from "@/hooks/useClipboard"
import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { IconButton } from "./xui/icon-button"

interface CopyButtonProps extends ButtonProps {
    text?: string
    showPreview?: boolean
}

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
    ({ showPreview, text, title, ...rest }, ref) => {
        const { t } = useTranslation()
        const { copied, copy: copyText } = useClipboard()

        const switchState = async (value?: string) => {
            if (!value) {
                toast.warning(t("Warning"), {
                    description: t("EmptyText"),
                })
                return
            }

            await copyText(value)
        }

        const button = (
            <IconButton
                {...rest}
                ref={ref}
                title={title ?? (text || t("EmptyText"))}
                aria-label={rest["aria-label"] ?? (copied ? t("Copied") : t("Copy"))}
                variant="outline"
                size="icon"
                icon={copied ? "check" : "clipboard"}
                onClick={() => switchState(text)}
            />
        )

        if (!showPreview) {
            return button
        }

        return (
            <span className="inline-flex min-w-0 items-center gap-2">
                {button}
                <span className="nkt-expanded-preview font-mono text-xs text-muted-foreground break-all">
                    {text || "—"}
                </span>
            </span>
        )
    },
)
CopyButton.displayName = "CopyButton"
