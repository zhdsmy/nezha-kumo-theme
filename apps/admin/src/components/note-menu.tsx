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
}

export const NoteMenu = forwardRef<HTMLButtonElement, NoteMenuProps>((props, ref) => {
    const { t } = useTranslation()
    const { copied: copy, copy: copyText } = useClipboard()

    const switchState = async (text?: string) => {
        if (!text) {
            toast.warning(t("Warning"), {
                description: t("EmptyNote"),
            })
            return
        }

        await copyText(text)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton
                    {...props}
                    ref={ref}
                    variant="outline"
                    size="icon"
                    icon={copy ? "check" : "clipboard"}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    onClick={() => {
                        switchState(props.note.private)
                    }}
                >
                    {t("Private")}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        switchState(props.note.public)
                    }}
                >
                    {t("Public")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
})
