import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { splitTags } from "../../../../../packages/shared/public-note"
import { type NoteControlProps, UnknownValue } from "./controls"

export function TagInput({
    value = "",
    onChange,
    label,
    suggestions = [],
}: Omit<NoteControlProps, "value"> & { value?: unknown; suggestions?: string[] }) {
    const { t } = useTranslation()
    const listId = useId()
    const [draft, setDraft] = useState("")
    const unknown = typeof value !== "string"
    const tags = unknown ? [] : splitTags(value)
    const save = (next: string[]) => onChange(next.length ? next.join(",") : undefined)
    const add = (text: string) => {
        const next = [...tags]
        for (const tag of splitTags(text.replace(/[;、\r\n]/g, ",")))
            if (!next.some((item) => item.toLowerCase() === tag.toLowerCase())) next.push(tag)
        if (next.join(",") !== tags.join(",")) save(next)
        setDraft("")
    }
    return (
        <div className="space-y-1">
            {unknown && <UnknownValue value={JSON.stringify(value)} />}
            <div
                className="flex flex-wrap items-center gap-1 rounded-md border p-2"
                role="group"
                aria-label={label}
            >
                {tags.map((tag, index) => (
                    <span
                        key={index}
                        className="inline-flex max-w-full items-center rounded-full bg-muted pl-3 text-sm"
                    >
                        <span className="break-all">{tag}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11 w-11 shrink-0 rounded-full p-0"
                            aria-label={t("PublicNote.RemoveTag", { tag })}
                            onClick={() => save(tags.filter((_, current) => current !== index))}
                        >
                            <X className="size-3" aria-hidden="true" />
                        </Button>
                    </span>
                ))}
                <Input
                    className="min-w-24 flex-1 border-0 shadow-none"
                    aria-label={label}
                    aria-describedby={`${listId}-hint`}
                    list={suggestions.length ? listId : undefined}
                    value={draft}
                    onChange={(event) => {
                        const next = event.target.value
                        if (/[,，、;]/.test(next) && !(event.nativeEvent as InputEvent).isComposing)
                            add(next)
                        else setDraft(next)
                    }}
                    onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return
                        if (event.key === "Enter" || /^(,|，|、|;)$/.test(event.key)) {
                            event.preventDefault()
                            add(draft)
                        } else if (event.key === "Backspace" && !draft && tags.length) {
                            event.preventDefault()
                            save(tags.slice(0, -1))
                        }
                    }}
                    onPaste={(event) => {
                        event.preventDefault()
                        const input = event.currentTarget
                        add(
                            draft.slice(0, input.selectionStart ?? draft.length) +
                                event.clipboardData.getData("text") +
                                draft.slice(input.selectionEnd ?? draft.length),
                        )
                    }}
                    onBlur={() => {
                        if (draft.trim()) add(draft)
                    }}
                />
            </div>
            <p id={`${listId}-hint`} className="text-xs text-muted-foreground">
                {t("PublicNote.TagsHint")}
            </p>
            {suggestions.length > 0 && (
                <datalist id={listId}>
                    {[...new Set(suggestions)]
                        .filter(
                            (item) => !tags.some((tag) => tag.toLowerCase() === item.toLowerCase()),
                        )
                        .map((item) => (
                            <option key={item} value={item} />
                        ))}
                </datalist>
            )}
        </div>
    )
}
