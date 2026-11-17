import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { currencies, parseAmount, writeAmount } from "../../../../../packages/shared/public-note"
import { type NoteControlProps, UnknownValue } from "./cycle-picker"
import { NumberInput } from "./quantity-input"

export function Choices({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value?: string
    options: readonly (readonly [string, string])[]
    onChange: (value: string) => void
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className="flex min-w-0 flex-wrap gap-1 rounded-md bg-muted p-1"
        >
            {options.map(([key, text]) => (
                <Button
                    type="button"
                    key={key}
                    variant={key === (value ?? "") ? "secondary" : "ghost"}
                    aria-pressed={key === (value ?? "")}
                    className="min-w-0 flex-1 px-2"
                    onClick={() => onChange(key)}
                >
                    {text}
                </Button>
            ))}
        </div>
    )
}
export function AmountInput({ value, onChange, label }: NoteControlProps) {
    const { t, i18n } = useTranslation()
    const amount = parseAmount(value)
    const mode =
        value && !amount ? "unknown" : value === "0" ? "free" : value === "-1" ? "usage" : "paid"
    const [currency, setCurrency] = useState("USD")
    const code = amount?.currency || currency
    const options = useMemo(() => {
        const names = new Intl.DisplayNames([i18n.language], { type: "currency" })
        return currencies().map((value) => ({
            value,
            label: `${value} · ${names.of(value) || value}`,
        }))
    }, [i18n.language])
    return (
        <div className="space-y-2">
            <Choices
                label={label}
                value={mode}
                options={[
                    ["paid", t("PublicNote.Paid")],
                    ["free", t("PublicNote.Free")],
                    ["usage", t("PublicNote.PayAsYouGo")],
                ]}
                onChange={(next) =>
                    onChange(next === "free" ? "0" : next === "usage" ? "-1" : undefined)
                }
            />
            {mode === "unknown" && <UnknownValue value={value} />}
            {mode === "paid" && (
                <div className="grid grid-cols-2 gap-2">
                    <Combobox
                        key={code}
                        aria-label={t("PublicNote.Currency")}
                        options={options}
                        defaultValue={code}
                        placeholder={t("PublicNote.Currency")}
                        onValueChange={(next) => {
                            if (!next) return
                            setCurrency(next)
                            if (amount)
                                onChange(
                                    writeAmount(amount.amount, next) +
                                        (amount.cycle ? `/${value!.split("/")[1]}` : ""),
                                )
                        }}
                    />
                    <NumberInput
                        label={label}
                        value={amount?.amount}
                        step="0.01"
                        placeholder="45.00"
                        onChange={(number) =>
                            onChange(
                                number === undefined
                                    ? undefined
                                    : writeAmount(number, code) +
                                          (amount?.cycle ? `/${value!.split("/")[1]}` : ""),
                            )
                        }
                    />
                </div>
            )}
        </div>
    )
}
