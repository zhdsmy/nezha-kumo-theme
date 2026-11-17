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
                    className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal px-2 py-2 leading-snug"
                    onClick={() => {
                        if (key !== (value ?? "")) onChange(key)
                    }}
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
    const [editingPaid, setEditingPaid] = useState(false)
    const mode =
        value && !amount
            ? "unknown"
            : amount?.amount === 0 && !amount.currency && !editingPaid
              ? "free"
              : amount?.amount === -1
                ? "usage"
                : "paid"
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
                onChange={(next) => {
                    setEditingPaid(next === "paid")
                    setCurrency(code)
                    onChange(next === "free" ? "0" : next === "usage" ? "-1" : undefined)
                }}
            />
            {mode === "unknown" && <UnknownValue value={value} />}
            {mode === "paid" && (
                <div className="grid grid-cols-2 gap-2">
                    <Combobox
                        key={code}
                        allowDeselect={false}
                        aria-label={`${t("PublicNote.Currency")} · ${options.find((item) => item.value === code)?.label || code}`}
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
                        onChange={(number) => {
                            setEditingPaid(true)
                            setCurrency(code)
                            onChange(
                                number === undefined
                                    ? undefined
                                    : writeAmount(number, code) +
                                          (amount?.cycle ? `/${value!.split("/")[1]}` : ""),
                            )
                        }}
                    />
                </div>
            )}
        </div>
    )
}
