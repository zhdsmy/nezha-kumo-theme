import { parseDecimal } from "@/lib/number"
import { Input, Radio } from "@cloudflare/kumo"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export interface NoteControlProps {
    value?: string
    onChange: (value: string | undefined) => void
    label: string
}
export function UnknownValue({ value, hint }: { value?: string; hint?: string }) {
    const { t } = useTranslation()
    return (
        <div className="space-y-1">
            <p className="break-all rounded-md border px-3 py-2 text-sm">{value}</p>
            <p className="text-xs text-muted-foreground">{hint || t("PublicNote.Unrecognized")}</p>
        </div>
    )
}
export function Choices({
    label,
    value,
    options,
    onChange,
    disabledValues = [],
}: {
    label: string
    value?: string
    options: readonly (readonly [string, string])[]
    disabledValues?: string[]
    onChange: (value: string) => void
}) {
    return (
        <Radio.Group
            appearance="segmented"
            orientation="horizontal"
            className="nkt-note-choices"
            value={value ?? ""}
            onValueChange={(next) => {
                if (next !== (value ?? "")) onChange(next)
            }}
        >
            <Radio.Legend className="sr-only">{label}</Radio.Legend>
            {options.map(([key, text]) => (
                <Radio.Item
                    key={key}
                    disabled={disabledValues.includes(key)}
                    value={key}
                    label={text}
                />
            ))}
        </Radio.Group>
    )
}
export function NumberInput({
    value,
    onChange,
    label,
    min = 0,
    placeholder,
    required,
    invalid,
}: {
    value?: number
    onChange: (value: number | undefined) => void
    label: string
    min?: number
    placeholder?: string
    required?: boolean
    invalid?: boolean
}) {
    const [draft, setDraft] = useState(value === undefined ? "" : String(value))
    useEffect(() => {
        setDraft((previous) => (parseDecimal(previous) === value ? previous : String(value ?? "")))
    }, [value])
    return (
        <Input
            type="text"
            required={required}
            aria-invalid={invalid || undefined}
            inputMode="decimal"
            aria-label={label}
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft === "" && value === undefined) return
                const number = parseDecimal(draft)
                if (number !== undefined && number === value) return
                if (draft === "") onChange(undefined)
                else if (number !== undefined && number >= min) onChange(number)
                else setDraft(value === undefined ? "" : String(value))
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault()
                    const input = event.currentTarget
                    input.blur()
                    setTimeout(() => input.form?.requestSubmit(), 0)
                }
            }}
        />
    )
}
