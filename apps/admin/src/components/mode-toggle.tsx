import { THEME_VALUES, normalizeTheme, useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

export function ModeToggle() {
    const { t } = useTranslation()
    const { theme, setTheme } = useTheme()
    const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={t("Theme")} aria-label={t("Theme")}>
                    <Icon className="h-[1.2rem] w-[1.2rem]" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(normalizeTheme(value))}>
                    {THEME_VALUES.map((value) => (
                        <DropdownMenuRadioItem key={value} value={value}>
                            {t(`theme.${value}`)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
