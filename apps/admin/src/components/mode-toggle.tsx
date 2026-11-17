import { Theme, useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

export function ModeToggle() {
    const { t } = useTranslation()
    const { theme, setTheme } = useTheme()
    const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun

    const toggleTheme = (theme: Theme) => {
        setTheme(theme)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={t("Theme")} aria-label={t("Theme")}>
                    <Icon className="h-[1.2rem] w-[1.2rem]" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toggleTheme("light")}>
                    {t("theme.light")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleTheme("dark")}>
                    {t("theme.dark")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleTheme("system")}>
                    {t("theme.system")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
