import { Combobox } from "@/components/ui/combobox"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { currencies, parseAmount, writeAmount } from "../../../../../packages/shared/public-note"
import { Choices, type NoteControlProps, NumberInput, UnknownValue } from "./controls"

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
