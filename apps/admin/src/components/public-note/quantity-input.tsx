import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
    BANDWIDTH_UNITS,
    TRAFFIC_UNITS,
    parseBandwidth,
    parseCycle,
    parseTraffic,
    writeBandwidth,
    writeCycle,
    writeTraffic,
} from "../../../../../packages/shared/public-note"
import { type NoteControlProps, NumberInput, UnknownValue } from "./controls"
import { CyclePicker } from "./cycle-picker"

function UnitSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: readonly string[]
    onChange: (value: string) => void
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger aria-label={`${label} · ${value}`}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                        {unit}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
export function QuantityInput({
    value,
    onChange,
    label,
    traffic = false,
}: NoteControlProps & { traffic?: boolean }) {
    const { t } = useTranslation()
    const parsed = traffic ? parseTraffic(value) : parseBandwidth(value)
    const prefix = traffic && !parsed && value ? parseTraffic(value.split("/")[0]) : undefined
    const quantity =
        parsed && parsed !== "unlimited"
            ? parsed
            : prefix && prefix !== "unlimited"
              ? prefix
              : undefined
    const [selectedUnit, setUnit] = useState(traffic ? "TB" : "Mbps")
    const [selectedCycle, setCycle] = useState<string | undefined>("Month")
    const unit = quantity?.unit || selectedUnit
    const rawPeriod =
        traffic && value?.includes("/") ? value.slice(value.indexOf("/") + 1) : undefined
    const period = rawPeriod ?? (quantity || value ? undefined : selectedCycle)
    const write = (amount: number | undefined, nextUnit: string, nextCycle: string | undefined) => {
        if (amount === undefined) return onChange(undefined)
        onChange(
            traffic
                ? writeTraffic({ amount, unit: nextUnit }) +
                      (nextCycle
                          ? `/${parseCycle(nextCycle) ? writeCycle(parseCycle(nextCycle)!) : nextCycle}`
                          : "")
                : writeBandwidth({ amount, unit: nextUnit as "Mbps" | "Gbps" }),
        )
    }
    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
                <Switch
                    aria-label={`${label} · ${t("PublicNote.Unlimited")}`}
                    checked={parsed === "unlimited"}
                    onCheckedChange={(checked) => onChange(checked ? "Unlimited" : undefined)}
                />
                {t("PublicNote.Unlimited")}
            </label>
            {value && !parsed && <UnknownValue value={value} />}
            {parsed !== "unlimited" && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <NumberInput
                            label={label}
                            min={0.000001}
                            placeholder={traffic ? "1" : "30"}
                            value={quantity?.amount}
                            onChange={(amount) => write(amount, unit, period)}
                        />
                        <UnitSelect
                            label={`${label} · ${t("PublicNote.RepeatUnit")}`}
                            value={unit}
                            options={[
                                ...new Set([...(traffic ? TRAFFIC_UNITS : BANDWIDTH_UNITS), unit]),
                            ]}
                            onChange={(next) => {
                                setUnit(next)
                                if (quantity) write(quantity.amount, next, period)
                            }}
                        />
                    </div>
                    {traffic && (
                        <CyclePicker
                            label={t("PublicNote.TrafficCycle")}
                            value={period}
                            onChange={(next) => {
                                setCycle(next)
                                if (quantity) write(quantity.amount, unit, next)
                            }}
                        />
                    )}
                </>
            )}
        </div>
    )
}
