import { Button, DatePicker, Popover, Switch } from "@cloudflare/kumo"
import { enUS, ja, zhCN, zhTW } from "date-fns/locale"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
    NO_EXPIRY,
    addCycle,
    parseCycle,
    parseNoteDate,
    writeNoteDate,
} from "../../../../../packages/shared/public-note"
import { type NoteControlProps } from "./controls"

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
    const selected = time
        ? /^\d{4}-\d{2}-\d{2}/.test(value!)
            ? new Date(`${value!.slice(0, 10)}T12:00:00`)
            : new Date(time)
        : undefined
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
                <Popover.Trigger asChild>
                    <Button
                        type="button"
                        variant="secondary"
                        aria-label={`${label} · ${display}`}
                        disabled={noExpiry}
                        className="w-full min-w-0 justify-start truncate"
                    >
                        {display}
                    </Button>
                </Popover.Trigger>
                <Popover.Content align="start" className="w-auto p-3">
                    <div data-note-calendar>
                        <DatePicker
                            navLayout="around"
                            className="[--cell-size:36px] [--cell-width:36px]"
                            mode="single"
                            locale={locale}
                            captionLayout="dropdown"
                            selected={selected}
                            defaultMonth={selected}
                            startMonth={new Date(2000, 0)}
                            endMonth={new Date(2100, 11)}
                            onChange={(date) => {
                                if (!date) return
                                onChange(writeNoteDate(date, value))
                                setOpen(false)
                            }}
                        />
                    </div>
                </Popover.Content>
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
