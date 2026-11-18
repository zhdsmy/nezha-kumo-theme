import { NoteEditor } from "@/components/note-editor"
import { NumberInput, UnknownValue } from "@/components/public-note/controls"
import {
    type JsonPath,
    appendJsonEntry,
    detectNoteMode,
    isNoteObject,
    jsonEntries,
    moveJsonItem,
    parseJsonNote,
    patchJsonNote,
    rawJsonAt,
    renameJsonKey,
} from "@/lib/json-note"
import {
    JSON_TYPES,
    type JsonType,
    convertJsonType,
    jsonType,
    privateNoteErrors,
} from "@/lib/private-note"
import { Button, Input, Select, Switch } from "@cloudflare/kumo"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ActualAmountInput } from "./actual-amount"

interface RowIdentity {
    id: number
    children: RowIdentity[]
}

export function PrivateNoteEditor({
    value,
    onChange,
    onValidityChange,
}: {
    value: string
    onChange: (value: string, mode?: "structured" | "raw") => void
    onValidityChange: (valid: boolean) => void
}) {
    const { t } = useTranslation()
    const rowIds = useRef<RowIdentity[]>([])
    const sequence = useRef(0)
    const movedFocus = useRef<HTMLElement | null>(null)
    const focusActual = useRef(false)
    useLayoutEffect(() => {
        if (focusActual.current) {
            focusActual.current = false
            const card = document.querySelector<HTMLElement>("[data-actual-amount]")
            const input = card?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')
            if (card) {
                const container = card.closest<HTMLElement>("[data-json-path]") ?? card
                const dialog = container.closest<HTMLElement>(".nkt-dialog")
                if (dialog) {
                    const bounds = dialog.getBoundingClientRect()
                    const footer = dialog.querySelector<HTMLElement>(".nkt-dialog-footer")
                    const visibleBottom = footer
                        ? Math.min(bounds.bottom, footer.getBoundingClientRect().top) - 12
                        : bounds.bottom - 12
                    const rect = container.getBoundingClientRect()
                    if (rect.bottom > visibleBottom) dialog.scrollTop += rect.bottom - visibleBottom
                    else if (rect.top < bounds.top + 12)
                        dialog.scrollTop += rect.top - (bounds.top + 12)
                    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
                } else {
                    container.scrollIntoView?.({ block: "nearest" })
                }
            }
            input?.focus({ preventScroll: true })
        }
        const target = movedFocus.current
        const focus = target?.matches(":disabled")
            ? target
                  .closest(".nkt-json-row")
                  ?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)")
            : target
        focus?.focus({ preventScroll: true })
        movedFocus.current = null
    })
    const [mode, setMode] = useState(() => detectNoteMode(value))
    const [emptyNumbers, setEmptyNumbers] = useState<string[]>([])
    const parsed = parseJsonNote(value)
    const errors = privateNoteErrors(value)
    const [confirmation, setConfirmation] = useState<{ path: JsonPath; type: JsonType } | null>(
        null,
    )
    const valid = mode === "raw" || (!errors.length && !emptyNumbers.length)
    useEffect(() => onValidityChange(valid), [valid, onValidityChange])
    const patch = (path: JsonPath, next: unknown) => {
        setEmptyNumbers((items) =>
            items.filter((item) => {
                const current = JSON.parse(item) as JsonPath
                return !path.every((part, i) => current[i] === part)
            }),
        )
        onChange(patchJsonNote(value, path, next), "structured")
    }
    const changeType = (path: JsonPath, type: JsonType) => {
        const raw = rawJsonAt(value, path)!
        const next = convertJsonType(raw, type)
        patch(path, next)
        let identities = rowIds.current
        for (const index of path) identities = identities[index as number].children
        identities.length = 0
        if (type === "number" && next === null)
            setEmptyNumbers((items) => [...items, JSON.stringify(path)])
    }
    const reindex = (path: JsonPath, index: number, to?: number, button?: HTMLElement) => {
        let identities = rowIds.current
        for (const part of path) identities = identities[part as number].children
        const [moved] = identities.splice(index, 1)
        if (to !== undefined) {
            identities.splice(to, 0, moved)
            const active = document.activeElement as HTMLElement
            movedFocus.current = button?.closest(".nkt-json-row")?.contains(active)
                ? active
                : (button ?? null)
        }
        setConfirmation(null)
        setEmptyNumbers((items) =>
            items.flatMap((item) => {
                const current = JSON.parse(item) as number[]
                if (!path.every((part, i) => current[i] === part)) return [item]
                const at = current[path.length]
                if (to === undefined && at === index) return []
                if (to === undefined && at > index) current[path.length]--
                else if (to !== undefined) {
                    if (at === index) current[path.length] = to
                    else if (at >= Math.min(index, to) && at <= Math.max(index, to))
                        current[path.length] += index < to ? -1 : 1
                }
                return [JSON.stringify(current)]
            }),
        )
    }
    const rows = (
        raw: string,
        path: JsonPath = [],
        names: (string | number)[] = [],
        depth = 1,
        identities = rowIds.current,
    ) => {
        const entries = jsonEntries(raw)
        while (identities.length < entries.length)
            identities.push({ id: sequence.current++, children: [] })
        identities.length = entries.length
        const array = Array.isArray(parseJsonNote(raw))
        const parentName = !array && names.length > 0 ? String(names.at(-1)) : ""
        return (
            <div className="nkt-json-rows">
                {entries.map((entry, index) => {
                    const nextPath = [...path, index]
                    const id = JSON.stringify(nextPath)
                    const nextNames = [...names, array ? index + 1 : entry.key]
                    const current = parseJsonNote(entry.raw)
                    const type = emptyNumbers.includes(id) ? "number" : jsonType(current)
                    const nested = type === "object" || type === "array"
                    const readonly = nested && depth >= 4
                    const actual =
                        nextNames.length === 2 &&
                        nextNames[0] === "billingDataMod" &&
                        nextNames[1] === "actualAmount"
                    const error = errors.find((error) => JSON.stringify(error.path) === id)?.error
                    const label = nextNames.join(".")
                    const deleteRow = () => {
                        reindex(path, index)
                        onChange(patchJsonNote(value, nextPath, undefined), "structured")
                    }
                    const billing = depth === 1 && entry.key === "billingDataMod" && type === "object"
                    return (
                        <div
                            key={identities[index].id}
                            className="nkt-json-row"
                            data-json-path={id}
                        >
                            <div className="nkt-json-heading">
                                {(billing || (actual && type === "string")) && !error ? (
                                    <span className="self-center text-sm font-medium">
                                        {t(billing ? "PublicNote.Billing" : "PrivateNote.ActualAmount")}
                                    </span>
                                ) : array ? (
                                    <span className="self-center text-sm">{index + 1}</span>
                                ) : (
                                    <Input
                                        placeholder={t("PrivateNote.Key")}
                                        aria-labelledby=""
                                        aria-label={`${t("PrivateNote.Key")} · ${label}`}
                                        value={String(entry.key)}
                                        error={error ? t(`PrivateNote.${error}`) : undefined}
                                        aria-invalid={!!error || undefined}
                                        required
                                        onChange={(event) =>
                                            onChange(
                                                renameJsonKey(value, nextPath, event.target.value),
                                                "structured",
                                            )
                                        }
                                    />
                                )}
                                <Select
                                    aria-label={`${t("PrivateNote.Type")} · ${label} · ${t(`PrivateNote.Types.${type}`)}`}
                                    value={type}
                                    renderValue={(type) => t(`PrivateNote.Types.${type}`)}
                                    disabled={readonly}
                                    onValueChange={(next) => {
                                        if (!next || next === type) return
                                        const nonempty =
                                            current !== null &&
                                            current !== "" &&
                                            (!nested || jsonEntries(entry.raw).length > 0)
                                        if (
                                            nonempty &&
                                            (nested || next === "object" || next === "array")
                                        )
                                            setConfirmation({ path: nextPath, type: next })
                                        else changeType(nextPath, next)
                                    }}
                                >
                                    {JSON_TYPES.map((item) => (
                                        <Select.Option
                                            key={item}
                                            value={item}
                                            disabled={
                                                depth >= 4 &&
                                                (item === "object" || item === "array")
                                            }
                                        >
                                            {t(`PrivateNote.Types.${item}`)}
                                        </Select.Option>
                                    ))}
                                </Select>
                                <div className="flex items-end gap-1">
                                    {array && (
                                        <>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                shape="square"
                                                aria-label={`${t("PrivateNote.MoveUp")} · ${label}`}
                                                disabled={index === 0}
                                                onClick={(event) => {
                                                    reindex(
                                                        path,
                                                        index,
                                                        index - 1,
                                                        event.currentTarget,
                                                    )
                                                    onChange(
                                                        moveJsonItem(value, path, index, index - 1),
                                                        "structured",
                                                    )
                                                }}
                                            >
                                                <ArrowUp aria-hidden="true" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                shape="square"
                                                aria-label={`${t("PrivateNote.MoveDown")} · ${label}`}
                                                disabled={index === entries.length - 1}
                                                onClick={(event) => {
                                                    reindex(
                                                        path,
                                                        index,
                                                        index + 1,
                                                        event.currentTarget,
                                                    )
                                                    onChange(
                                                        moveJsonItem(value, path, index, index + 1),
                                                        "structured",
                                                    )
                                                }}
                                            >
                                                <ArrowDown aria-hidden="true" />
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        shape="square"
                                        aria-label={`${t("PrivateNote.Delete")} · ${label}`}
                                        onClick={deleteRow}
                                    >
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                            {confirmation && JSON.stringify(confirmation.path) === id && (
                                <div role="alert" className="space-y-2 rounded-md border p-2">
                                    <p className="text-sm">{t("PrivateNote.ConfirmType")}</p>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            changeType(nextPath, confirmation.type)
                                            setConfirmation(null)
                                        }}
                                    >
                                        {t("PrivateNote.Replace")}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setConfirmation(null)}
                                    >
                                        {t("Cancel")}
                                    </Button>
                                </div>
                            )}
                            {readonly ? (
                                <UnknownValue
                                    value={entry.raw}
                                    hint={t("PrivateNote.DepthLimit")}
                                />
                            ) : nested ? (
                                rows(
                                    entry.raw,
                                    nextPath,
                                    nextNames,
                                    depth + 1,
                                    identities[index].children,
                                )
                            ) : actual && type === "string" ? (
                                <ActualAmountInput
                                    value={current as string}
                                    onChange={(next) => patch(nextPath, next)}
                                />
                            ) : type === "string" ? (
                                <Input
                                    placeholder={t("PrivateNote.Value")}
                                    aria-labelledby=""
                                    aria-label={`${t("PrivateNote.Value")} · ${label}`}
                                    value={current as string}
                                    onChange={(event) => patch(nextPath, event.target.value)}
                                />
                            ) : type === "number" ? (
                                <div>
                                    <NumberInput
                                        invalid={emptyNumbers.includes(id)}
                                        label={`${t("PrivateNote.Value")} · ${label}`}
                                        value={typeof current === "number" ? current : undefined}
                                        min={-Infinity}
                                        required
                                        onChange={(next) => {
                                            patch(nextPath, next ?? null)
                                            if (next === undefined)
                                                setEmptyNumbers((items) => [...items, id])
                                        }}
                                    />
                                    {emptyNumbers.includes(id) && (
                                        <p role="alert" className="text-sm text-kumo-danger">
                                            {t("PrivateNote.NumberRequired")}
                                        </p>
                                    )}
                                </div>
                            ) : type === "boolean" ? (
                                <Switch
                                    aria-labelledby=""
                                    aria-label={`${t("PrivateNote.Value")} · ${label}`}
                                    checked={current as boolean}
                                    onCheckedChange={(next) => patch(nextPath, next)}
                                />
                            ) : (
                                <span className="text-sm text-kumo-subtle">null</span>
                            )}
                        </div>
                    )
                })}
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onChange(appendJsonEntry(value, path, "", ""), "structured")}
                >
                    <Plus className="size-4" aria-hidden="true" />
                    {array
                        ? t("PrivateNote.AddItem")
                        : parentName.trim()
                          ? t("PrivateNote.AddRowIn", {
                                name:
                                    parentName === "billingDataMod"
                                        ? t("PublicNote.Billing")
                                        : parentName,
                            })
                          : t("PrivateNote.AddRow")}
                </Button>
            </div>
        )
    }
    const billing = isNoteObject(parsed) ? parsed.billingDataMod : undefined
    const canAddActual =
        isNoteObject(parsed) &&
        (!Object.hasOwn(parsed, "billingDataMod") ||
            (isNoteObject(billing) && !Object.hasOwn(billing, "actualAmount")))
    return (
        <NoteEditor
            kind="private"
            value={value}
            mode={mode}
            onChange={onChange}
            onModeChange={(next) => {
                setMode(next)
                setEmptyNumbers([])
                rowIds.current = []
            }}
        >
            {canAddActual && (
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                        focusActual.current = true
                        onChange(
                            patchJsonNote(value, ["billingDataMod", "actualAmount"], ""),
                            "structured",
                        )
                    }}
                >
                    {t("PrivateNote.AddActualAmount")}
                </Button>
            )}
            {rows(value)}
        </NoteEditor>
    )
}
