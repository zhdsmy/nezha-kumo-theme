import { type NoteMode, detectNoteMode } from "@/lib/json-note"
import { KumoPortalProvider, Textarea } from "@cloudflare/kumo"
import { type ReactNode, useRef } from "react"
import { useTranslation } from "react-i18next"

import { Choices } from "./public-note/controls"

export function NoteEditor({
    kind,
    value,
    mode,
    onChange,
    onModeChange,
    children,
}: {
    kind: "private" | "public"
    value: string
    mode: NoteMode
    onChange: (value: string, mode?: NoteMode) => void
    onModeChange: (mode: NoteMode) => void
    children: ReactNode
}) {
    const { t } = useTranslation()
    const portal = useRef<HTMLElement>(null)
    const prefix = kind === "private" ? "PrivateNote" : "PublicNote"
    const structured = detectNoteMode(value) === "structured"
    return (
        <section
            ref={portal}
            className="nkt-note-editor space-y-2"
            aria-label={t(`${prefix}.Label`)}
            {...{ [`data-${kind}-note-editor`]: true }}
        >
            <KumoPortalProvider container={portal}>
                <div className="nkt-note-heading">
                    <h3 className="text-sm font-semibold">{t(`${prefix}.Label`)}</h3>
                    <Choices
                        label={t(`${prefix}.Label`)}
                        value={mode}
                        disabledValues={structured ? [] : ["structured"]}
                        options={[
                            ["structured", t("PublicNote.CustomFields")],
                            ["raw", t("PublicNote.RawText")],
                        ]}
                        onChange={(next) => {
                            onModeChange(next as NoteMode)
                            onChange(value, next as NoteMode)
                        }}
                    />
                </div>
                {!structured && (
                    <p role="status" className="text-sm text-kumo-subtle">
                        {t("NoteEditor.RawReason")}
                    </p>
                )}
                {mode === "raw" ? (
                    <Textarea
                        aria-label={t(`${prefix}.RawText`)}
                        value={value}
                        rows={4}
                        onChange={(event) => onChange(event.target.value, "raw")}
                    />
                ) : (
                    children
                )}
            </KumoPortalProvider>
        </section>
    )
}
