import { Button, Input, Popover, Select } from "@cloudflare/kumo"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
    CYCLE_UNITS,
    type Cycle,
    type CycleUnit,
    parseCycle,
    writeCycle,
} from "../../../../../packages/shared/public-note"
import { type NoteControlProps } from "./controls"

export function CyclePicker({
    value,
    onChange,
    label,
    unsetLabel,
}: NoteControlProps & { unsetLabel?: string }) {
    const { t } = useTranslation()
    const hint = useId()
    const parsed = parseCycle(value)
    const [open, setOpen] = useState(false)
    const [custom, setCustom] = useState(false)
    const trigger = useRef<HTMLButtonElement>(null)
    const countRef = useRef<HTMLInputElement>(null)
    const customRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        ;(custom ? countRef.current : customRef.current)?.focus({ preventScroll: true })
    }, [custom])
    const [count, setCount] = useState("1")
    const [unit, setUnit] = useState<CycleUnit>("Month")
    const display = (cycle: Cycle) =>
        cycle.count === 1
            ? t(`PublicNote.Every${cycle.unit}`)
            : t(`PublicNote.Repeat${cycle.unit}`, { count: cycle.count })
    const choose = (cycle: Cycle) => {
        onChange(writeCycle(cycle))
        setOpen(false)
    }
    return (
        <div className="min-w-0 space-y-1">
            <Popover
                open={open}
                onOpenChange={(next) => {
                    setOpen(next)
                    if (next) {
                        setCustom(false)
                        setCount(String(parsed?.count ?? 1))
                        setUnit(parsed?.unit ?? "Month")
                    }
                }}
            >
                <Popover.Trigger asChild>
                    <Button
                        ref={trigger}
                        type="button"
                        variant="secondary"
                        aria-label={`${label} · ${parsed ? display(parsed) : value || unsetLabel || t("PublicNote.Unset")}`}
                        aria-describedby={value && !parsed ? hint : undefined}
                        className="w-full min-w-0 justify-between gap-2"
                    >
                        <span className="truncate">
                            {parsed
                                ? display(parsed)
                                : value || unsetLabel || t("PublicNote.Unset")}
                        </span>
                        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    </Button>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Positioner align="start">
                        <Popover.Popup finalFocus={trigger} className="w-64 space-y-2 p-3">
                            <Popover.Arrow />
                            {custom ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setCustom(false)}
                                    >
                                        <ChevronLeft aria-hidden="true" className="size-4" />
                                        {t("PublicNote.Back")}
                                    </Button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            ref={countRef}
                                            type="number"
                                            min={1}
                                            max={9999}
                                            step={1}
                                            aria-label={t("PublicNote.RepeatCount")}
                                            value={count}
                                            onChange={(event) => setCount(event.target.value)}
                                        />
                                        <Select
                                            value={unit}
                                            renderValue={(unit) => t(`PublicNote.${unit}`)}
                                            aria-label={`${t("PublicNote.RepeatUnit")} · ${t(`PublicNote.${unit}`)}`}
                                            onValueChange={(next) =>
                                                next && setUnit(next as CycleUnit)
                                            }
                                        >
                                            {CYCLE_UNITS.map((item) => (
                                                <Select.Option key={item} value={item}>
                                                    {t(`PublicNote.${item}`)}
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </div>
                                    <Button
                                        type="button"
                                        className="w-full"
                                        disabled={
                                            !Number.isInteger(Number(count)) ||
                                            Number(count) < 1 ||
                                            Number(count) > 9999
                                        }
                                        onClick={() => choose({ count: Number(count), unit })}
                                    >
                                        {t("PublicNote.Apply")}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {CYCLE_UNITS.map((item) => (
                                        <Button
                                            type="button"
                                            key={item}
                                            aria-pressed={
                                                parsed?.unit === item && parsed.count === 1
                                            }
                                            variant={
                                                parsed?.unit === item && parsed.count === 1
                                                    ? "secondary"
                                                    : "ghost"
                                            }
                                            className="w-full justify-start"
                                            onClick={() => choose({ count: 1, unit: item })}
                                        >
                                            {t(`PublicNote.Every${item}`)}
                                        </Button>
                                    ))}
                                    <Button
                                        type="button"
                                        variant={
                                            parsed && parsed.count !== 1 ? "secondary" : "ghost"
                                        }
                                        className="w-full justify-between"
                                        ref={customRef}
                                        aria-pressed={!!parsed && parsed.count !== 1}
                                        onClick={() => setCustom(true)}
                                    >
                                        {t("PublicNote.CustomCycle")}
                                        <ChevronRight aria-hidden="true" className="size-4" />
                                    </Button>
                                    {value && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="w-full justify-start"
                                            onClick={() => {
                                                onChange(undefined)
                                                setOpen(false)
                                            }}
                                        >
                                            {t("PublicNote.Clear")}
                                        </Button>
                                    )}
                                </>
                            )}
                        </Popover.Popup>
                    </Popover.Positioner>
                </Popover.Portal>
            </Popover>
            {value && !parsed && (
                <p id={hint} className="text-xs text-muted-foreground">
                    {t("PublicNote.Unrecognized")}
                </p>
            )}
        </div>
    )
}
