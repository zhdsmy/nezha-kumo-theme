import { Check, Minus } from "lucide-react"
import { useTranslation } from "react-i18next"

export const Flag = ({ on }: { on: boolean }) => {
    const { t } = useTranslation()
    return on ? (
        <Check className="size-4 text-good" aria-label={t("Yes")} />
    ) : (
        <Minus className="size-4 text-muted-foreground/60" aria-label={t("No")} />
    )
}

/** Column `cell` for boolean values, instead of raw "true"/"false". */
export const flagCell = ({ getValue }: { getValue: () => unknown }) => <Flag on={!!getValue()} />
