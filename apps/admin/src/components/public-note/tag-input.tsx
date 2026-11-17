import { TagInput as KumoTagInput } from "@cloudflare/kumo"
import { useId, useLayoutEffect, useRef, useState } from "react"
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
    const input = useRef<HTMLInputElement>(null)
    const [revision, resetDraft] = useState(0)
    const restoreFocus = useRef(false)
    useLayoutEffect(() => {
        if (restoreFocus.current) {
            input.current?.focus({ preventScroll: true })
            restoreFocus.current = false
        }
    }, [revision])
    const unknown = typeof value !== "string"
    const tags = unknown ? [] : splitTags(value)
    const save = (next: string[]) => {
        // Preserve existing duplicate labels; deduplicate only newly added values.
        const added = next.length >= tags.length && tags.every((tag, index) => next[index] === tag)
        const result = added ? [...tags] : next
        if (added)
            for (const tag of next.slice(tags.length))
                if (!result.some((item) => item.toLowerCase() === tag.toLowerCase()))
                    result.push(tag)
        if (result.length !== tags.length || result.some((tag, index) => tag !== tags[index]))
            onChange(result.length ? result.join(",") : undefined)
    }
    const commit = (text: string) => {
        save([...tags, ...splitTags(text.replace(/[;、\r\n]/g, ","))])
        restoreFocus.current = true
        resetDraft((revision) => revision + 1)
    }
    return (
        <div className="space-y-1">
            {unknown && <UnknownValue value={JSON.stringify(value)} />}
            <KumoTagInput
                key={revision}
                ref={input}
                value={tags}
                onValueChange={save}
                aria-label={label}
                list={suggestions.length ? listId : undefined}
                labels={{ removeValue: (tag) => t("PublicNote.RemoveTag", { tag }) }}
                onChange={(event) => {
                    if (
                        /[,，、;]/.test(event.target.value) &&
                        !(event.nativeEvent as InputEvent).isComposing
                    )
                        commit(event.target.value)
                }}
                onKeyDown={(event) => {
                    if (!event.nativeEvent.isComposing && /^[，、;]$/.test(event.key)) {
                        event.preventDefault()
                        commit(event.currentTarget.value)
                    }
                    if (event.key === "Enter" && !event.currentTarget.value) event.preventDefault()
                }}
                onCompositionEnd={(event) => {
                    if (/[,，、;]/.test(event.currentTarget.value))
                        commit(event.currentTarget.value)
                }}
                onPaste={(event) => {
                    const text = event.clipboardData.getData("text")
                    if (!/[，、;]/.test(text)) return
                    event.preventDefault()
                    const input = event.currentTarget
                    commit(
                        input.value.slice(0, input.selectionStart ?? input.value.length) +
                            text +
                            input.value.slice(input.selectionEnd ?? input.value.length),
                    )
                }}
            />
            <p className="text-xs text-muted-foreground">{t("PublicNote.TagsHint")}</p>
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
