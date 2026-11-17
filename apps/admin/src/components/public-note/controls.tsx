import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export interface NoteControlProps {
    value?: string
    onChange: (value: string | undefined) => void
    label: string
}
export function UnknownValue({ value }: { value?: string }) {
    const { t } = useTranslation()
    return (
        <div className="space-y-1">
            <p className="break-all rounded-md border px-3 py-2 text-sm">{value}</p>
            <p className="text-xs text-muted-foreground">{t("PublicNote.Unrecognized")}</p>
        </div>
    )
}
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
export function NumberInput({
    value,
    onChange,
    label,
    min = 0,
    placeholder,
}: {
    value?: number
    onChange: (value: number | undefined) => void
    label: string
    min?: number
    placeholder?: string
}) {
    const [draft, setDraft] = useState(value === undefined ? "" : String(value))
    useEffect(() => {
        setDraft((previous) =>
            (previous === "" ? undefined : Number(previous)) === value
                ? previous
                : String(value ?? ""),
        )
    }, [value])
    return (
        <Input
            type="text"
            inputMode="decimal"
            aria-label={label}
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                const number = Number(draft)
                if (draft.trim() && number === value) return
                if (!draft.trim()) onChange(undefined)
                else if (Number.isFinite(number) && number >= min) onChange(number)
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
