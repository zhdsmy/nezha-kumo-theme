import { AmountInput } from "@/components/public-note/amount-input"
import { CyclePicker } from "@/components/public-note/cycle-picker"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { parseAmount, parseCycle } from "../../../../../packages/shared/public-note"

export function ActualAmountInput({
    value,
    onChange,
}: {
    value: string
    onChange: (value: string) => void
}) {
    const { t } = useTranslation()
    const read = (source: string) => ({
        source,
        amount: source.split("/")[0],
        cycle: source.includes("/") ? source.slice(source.indexOf("/") + 1) : undefined,
        edited: false,
    })
    const [draft, setDraft] = useState(() => read(value))
    if (draft.source !== value) setDraft(read(value))
    const price = parseAmount(draft.amount)
    const recognized =
        !!price?.currency &&
        !!price.symbol &&
        price.amount >= 0 &&
        (!draft.cycle || !!parseCycle(draft.cycle))
    const invalid = draft.edited && !recognized
    const update = (amount: string, cycle: string | undefined) => {
        const price = parseAmount(amount)
        const recognized =
            !!price?.currency &&
            !!price.symbol &&
            price.amount >= 0 &&
            (!cycle || !!parseCycle(cycle))
        const next = recognized ? amount + (cycle ? `/${cycle}` : "") : value
        setDraft({ source: next, amount, cycle, edited: true })
        if (recognized) onChange(next)
    }
    return (
        <div className="space-y-2">
            <p className="text-sm">{t("PrivateNote.ActualAmount")}</p>
            <AmountInput
                paidOnly
                invalid={invalid}
                label={t("PrivateNote.ActualAmount")}
                value={draft.amount}
                onChange={(amount) => update(amount ?? "", draft.cycle)}
            />
            <p className="text-sm">{t("PrivateNote.ActualCycle")}</p>
            <CyclePicker
                label={t("PrivateNote.ActualCycle")}
                value={draft.cycle}
                unsetLabel={t("PrivateNote.FollowPublicCycle")}
                onChange={(cycle) => update(draft.amount, cycle)}
            />
            {invalid && (
                <p role="alert" className="text-sm text-kumo-danger">
                    {t("PrivateNote.NumberRequired")}
                </p>
            )}
        </div>
    )
}
