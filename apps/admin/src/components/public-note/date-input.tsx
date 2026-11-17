import { Button, DatePicker, Input, Popover, Switch } from "@cloudflare/kumo"
import { enUS, ja, zhCN, zhTW } from "date-fns/locale"
import { useEffect, useRef, useState } from "react"
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
    const trigger = useRef<HTMLButtonElement>(null)
    const changeOpen = (next: boolean) => {
        const button = trigger.current
        const dialog = button?.closest<HTMLElement>(".nkt-dialog")
        if (next && button && dialog) {
            const anchor = button.getBoundingClientRect()
            const frame = dialog.getBoundingClientRect()
            // Make room inside the scrollable dialog when neither side fits the calendar.
            if (Math.max(anchor.top - frame.top, frame.bottom - anchor.bottom) < 440)
                dialog.scrollTop += anchor.top - frame.top - 16
        }
        setOpen(next)
    }
    const time = parseNoteDate(value)
    const noExpiry = end && time === 0
    const selected = time
        ? /^\d{4}-\d{2}-\d{2}/.test(value!)
            ? new Date(`${value!.slice(0, 10)}T12:00:00`)
            : new Date(time)
        : undefined
    const clock = /[T ](\d{2}:\d{2})/.exec(value || "")?.[1] || "00:00"
    const [clockDraft, setClockDraft] = useState(clock)
    useEffect(() => setClockDraft(clock), [clock])
    const commitTime = () => {
        if (!/^\d{2}:\d{2}$/.test(clockDraft)) return setClockDraft(clock)
        if (clockDraft !== clock)
            onChange(
                writeNoteDate(selected || new Date(), value).replace(
                    /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?/,
                    `T${clockDraft}:00`,
                ),
            )
    }
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
          ? `${selected.toLocaleDateString(i18n.language)} ${new Date(`2000-01-01T${clock}`).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`
          : value || t("PublicNote.Unset")
    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={changeOpen}>
                <Popover.Trigger asChild>
                    <Button
                        ref={trigger}
                        type="button"
                        variant="secondary"
                        aria-label={`${label} · ${display}`}
                        disabled={noExpiry}
                        className="w-full min-w-0 justify-start truncate"
                    >
                        {display}
                    </Button>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Positioner align="start" sideOffset={8} collisionPadding={8}>
                        <Popover.Popup
                            finalFocus={trigger}
                            className="w-auto max-h-[var(--available-height)] overflow-y-auto p-3"
                        >
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
                                    }}
                                />
                            </div>
                            <div className="mt-3 flex items-end gap-2">
                                <Input
                                    type="time"
                                    label={t("PublicNote.Time")}
                                    aria-label={`${label} · ${t("PublicNote.Time")}`}
                                    value={clockDraft}
                                    onChange={(event) => setClockDraft(event.target.value)}
                                    onBlur={commitTime}
                                />
                                <Button
                                    type="button"
                                    onClick={() => {
                                        commitTime()
                                        setOpen(false)
                                    }}
                                >
                                    {t("PublicNote.Apply")}
                                </Button>
                            </div>
                        </Popover.Popup>
                    </Popover.Positioner>
                </Popover.Portal>
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
