import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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

export function CyclePicker({ value, onChange, label }: NoteControlProps) {
    const { t } = useTranslation()
    const hint = useId()
    const parsed = parseCycle(value)
    const [open, setOpen] = useState(false)
    const [custom, setCustom] = useState(false)
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
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label={`${label} · ${parsed ? display(parsed) : value || t("PublicNote.Unset")}`}
                        aria-describedby={value && !parsed ? hint : undefined}
                        className="w-full min-w-0 justify-between gap-2"
                    >
                        <span className="truncate">
                            {parsed ? display(parsed) : value || t("PublicNote.Unset")}
                        </span>
                        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="space-y-2 p-3" aria-label={label}>
                    {custom ? (
                        <>
                            <Button type="button" variant="ghost" onClick={() => setCustom(false)}>
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
                                    onValueChange={(next) => setUnit(next as CycleUnit)}
                                >
                                    <SelectTrigger
                                        aria-label={`${t("PublicNote.RepeatUnit")} · ${t(`PublicNote.${unit}`)}`}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CYCLE_UNITS.map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {t(`PublicNote.${item}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
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
                                    aria-pressed={parsed?.unit === item && parsed.count === 1}
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
                                variant={parsed && parsed.count !== 1 ? "secondary" : "ghost"}
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
                </PopoverContent>
            </Popover>
            {value && !parsed && (
                <p id={hint} className="text-xs text-muted-foreground">
                    {t("PublicNote.Unrecognized")}
                </p>
            )}
        </div>
    )
}
