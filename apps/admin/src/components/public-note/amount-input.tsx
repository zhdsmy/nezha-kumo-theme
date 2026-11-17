import { Combobox } from "@cloudflare/kumo"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { currencies, parseAmount, writeAmount } from "../../../../../packages/shared/public-note"
import { Choices, type NoteControlProps, NumberInput, UnknownValue } from "./controls"

export function AmountInput({
    value,
    onChange,
    label,
    paidOnly = false,
    invalid,
}: NoteControlProps & { paidOnly?: boolean; invalid?: boolean }) {
    const { t, i18n } = useTranslation()
    const parsed = parseAmount(value)
    const amount =
        paidOnly && (!parsed?.currency || !parsed.symbol || parsed.amount < 0) ? undefined : parsed
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
    const write = (number: number, currency: string) =>
        paidOnly ? `${currency} ${number.toFixed(2)}` : writeAmount(number, currency)
    const options = useMemo(() => {
        const names = new Intl.DisplayNames([i18n.language], { type: "currency" })
        return currencies().map((value) => ({
            value,
            label: `${value} · ${names.of(value) || value}`,
        }))
    }, [i18n.language])
    return (
        <div className="space-y-2">
            {!paidOnly && (
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
            )}
            {mode === "unknown" && <UnknownValue value={value} />}
            {(paidOnly || mode === "paid") && (
                <div className="grid grid-cols-2 gap-2">
                    <Combobox
                        items={options}
                        value={options.find((item) => item.value === code)}
                        onValueChange={(next) => {
                            if (!next) return
                            setCurrency(next.value)
                            if (amount)
                                onChange(
                                    write(amount.amount, next.value) +
                                        (amount.cycle || (paidOnly && value?.includes("/"))
                                            ? `/${value!.split("/")[1]}`
                                            : ""),
                                )
                        }}
                    >
                        <Combobox.TriggerValue
                            aria-label={`${t("PublicNote.Currency")} · ${options.find((item) => item.value === code)?.label || code}`}
                            className="min-w-0 w-full"
                        >
                            {() => code}
                        </Combobox.TriggerValue>
                        <Combobox.Content className="w-72 max-w-[calc(100vw-2rem)]">
                            <Combobox.Input
                                aria-label={t("PublicNote.Currency")}
                                placeholder={t("PublicNote.Currency")}
                            />
                            <Combobox.List>
                                {(item: { value: string; label: string }) => (
                                    <Combobox.Item key={item.value} value={item}>
                                        {item.label}
                                    </Combobox.Item>
                                )}
                            </Combobox.List>
                        </Combobox.Content>
                    </Combobox>
                    <NumberInput
                        invalid={invalid}
                        label={label}
                        value={amount?.amount}
                        placeholder="45.00"
                        onChange={(number) => {
                            setEditingPaid(true)
                            setCurrency(code)
                            onChange(
                                number === undefined
                                    ? undefined
                                    : write(number, code) +
                                          (amount?.cycle || (paidOnly && value?.includes("/"))
                                              ? `/${value!.split("/")[1]}`
                                              : ""),
                            )
                        }}
                    />
                </div>
            )}
        </div>
    )
}
