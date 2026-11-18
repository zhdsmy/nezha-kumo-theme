import { ButtonProps } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useClipboard } from "@/hooks/useClipboard"
import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { IconButton } from "./xui/icon-button"

interface NoteMenuProps extends ButtonProps {
    note: { private?: string; public?: string }
    showPreview?: boolean
}

export const NoteMenu = forwardRef<HTMLButtonElement, NoteMenuProps>(
    ({ note, showPreview, title, ...rest }, ref) => {
        const { t } = useTranslation()
        const { copied: copy, copy: copyText } = useClipboard()
        const previewValue = note.private || note.public || ""

        const switchState = async (text?: string) => {
            if (!text) {
                toast.warning(t("Warning"), {
                    description: t("EmptyNote"),
                })
                return
            }

            await copyText(text)
        }

        const menu = (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <IconButton
                        {...rest}
                        ref={ref}
                        title={title ?? (previewValue || t("EmptyNote"))}
                        variant="outline"
                        size="icon"
                        icon={copy ? "check" : "clipboard"}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {previewValue ? (
                        <div className="max-w-64 border-b px-2 py-1.5 text-xs text-muted-foreground break-all">
                            {previewValue}
                        </div>
                    ) : null}
                    <DropdownMenuItem
                        onClick={() => {
                            switchState(note.private)
                        }}
                    >
                        {t("Private")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            switchState(note.public)
                        }}
                    >
                        {t("Public")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )

        if (!showPreview) {
            return menu
        }

        return (
            <span className="inline-flex min-w-0 items-center gap-2">
                {menu}
                <span className="nkt-expanded-preview text-xs text-muted-foreground break-all">
                    {previewValue || "—"}
                </span>
            </span>
        )
    },
)
NoteMenu.displayName = "NoteMenu"
