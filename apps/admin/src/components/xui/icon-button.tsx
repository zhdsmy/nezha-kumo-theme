import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    BanIcon,
    Check,
    CircleArrowUp,
    Clipboard,
    CogIcon,
    Download,
    Edit2,
    Expand,
    FolderClosed,
    Menu,
    Minus,
    MoreHorizontal,
    Play,
    Plus,
    Terminal,
    Trash2,
    Upload,
    UserPen,
} from "lucide-react"
import { forwardRef } from "react"
import { useTranslation } from "react-i18next"

export interface IconButtonProps extends ButtonProps {
    icon:
        | "clipboard"
        | "check"
        | "edit"
        | "trash"
        | "plus"
        | "terminal"
        | "update"
        | "folder-closed"
        | "play"
        | "download"
        | "upload"
        | "menu"
        | "ban"
        | "expand"
        | "cog"
        | "minus"
        | "user-pen"
        | "more"
}

const iconLabels: Record<IconButtonProps["icon"], string> = {
    clipboard: "Copy",
    check: "Confirm",
    edit: "Edit",
    trash: "Delete",
    plus: "Create",
    terminal: "Terminal",
    update: "ForceUpdate",
    "folder-closed": "FileManager",
    play: "Run",
    download: "Download",
    upload: "Upload",
    menu: "Menu",
    ban: "Block",
    expand: "Expand",
    cog: "Settings",
    minus: "Remove",
    "user-pen": "ChangeOwner",
    more: "More",
}

// Confirmed destructive actions use the filled danger variant in their dialog.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ variant, className, ...props }, ref) => {
        const { t } = useTranslation()
        const filled = props.icon === "plus" && (!variant || variant === "default")
        return (
            <Button
                {...props}
                aria-label={props["aria-label"] || props.title || t(iconLabels[props.icon])}
                variant={filled ? "default" : variant === "ghost" ? "ghost" : "outline"}
                className={cn(
                    "rounded-lg",
                    !filled && variant !== "ghost" && "bg-card",
                    variant === "destructive" &&
                        "hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive",
                    className,
                )}
                ref={ref}
                size="icon"
            >
                {(() => {
                    switch (props.icon) {
                        case "clipboard": {
                            return <Clipboard />
                        }
                        case "check": {
                            return <Check />
                        }
                        case "edit": {
                            return <Edit2 />
                        }
                        case "trash": {
                            return <Trash2 />
                        }
                        case "plus": {
                            return <Plus />
                        }
                        case "terminal": {
                            return <Terminal />
                        }
                        case "update": {
                            return <CircleArrowUp />
                        }
                        case "folder-closed": {
                            return <FolderClosed />
                        }
                        case "play": {
                            return <Play />
                        }
                        case "download": {
                            return <Download />
                        }
                        case "upload": {
                            return <Upload />
                        }
                        case "menu": {
                            return <Menu />
                        }
                        case "ban": {
                            return <BanIcon />
                        }
                        case "expand": {
                            return <Expand />
                        }
                        case "cog": {
                            return <CogIcon />
                        }
                        case "minus": {
                            return <Minus />
                        }
                        case "user-pen": {
                            return <UserPen />
                        }
                        case "more": {
                            return <MoreHorizontal />
                        }
                    }
                })()}
            </Button>
        )
    },
)
