import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { enUS, ja, zhCN, zhTW } from "date-fns/locale"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
    NO_EXPIRY,
    addCycle,
    parseCycle,
    parseNoteDate,
} from "../../../../../packages/shared/public-note"
import { type NoteControlProps } from "./cycle-picker"

export function DateInput({
    value,
    onChange,
    label,
    end = false,
    start,
    cycle,
}: NoteControlProps & { end?: boolean; start?: string; cycle?: string }) {
    const { t, i18n } = useTranslation()
    const [open, setOpen] = useState(false)
    const time = parseNoteDate(value)
    const noExpiry = end && time === 0
    const selected = time ? new Date(time) : undefined
    const period = parseCycle(cycle)
    const estimated = start && period ? addCycle(start, period) : undefined
    const locale = i18n.language.startsWith("zh-CN")
        ? zhCN
        : i18n.language.startsWith("zh")
          ? zhTW
          : i18n.language.startsWith("ja")
            ? ja
            : enUS
    const display = noExpiry
        ? t("PublicNote.NoExpiry")
        : selected
          ? selected.toLocaleDateString(i18n.language)
          : value || t("PublicNote.Unset")
    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label={`${label} · ${display}`}
                        disabled={noExpiry}
                        className="w-full min-w-0 justify-start truncate"
                    >
                        {display}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                        mode="single"
                        locale={locale}
                        captionLayout="dropdown"
                        selected={selected}
                        defaultMonth={selected}
                        startMonth={new Date(2000, 0)}
                        endMonth={new Date(2100, 11)}
                        onSelect={(date) => {
                            if (!date) return
                            if (selected)
                                date.setHours(
                                    selected.getHours(),
                                    selected.getMinutes(),
                                    selected.getSeconds(),
                                    selected.getMilliseconds(),
                                )
                            onChange(date.toISOString())
                            setOpen(false)
                        }}
                    />
                </PopoverContent>
            </Popover>
            {value && time === undefined && (
                <p className="text-xs text-muted-foreground">{t("PublicNote.Unrecognized")}</p>
            )}
            {end && (
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <Switch
                            aria-label={t("PublicNote.NoExpiry")}
                            checked={noExpiry}
                            onCheckedChange={(checked) => onChange(checked ? NO_EXPIRY : undefined)}
                        />
                        {t("PublicNote.NoExpiry")}
                    </label>
                    {estimated && !noExpiry && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onChange(estimated)}
                        >
                            {t("PublicNote.EstimateExpiry")}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
