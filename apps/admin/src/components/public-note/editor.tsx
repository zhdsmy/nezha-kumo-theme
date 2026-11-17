import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    detectPublicNoteMode,
    isNoteObject,
    parsePublicNote,
    patchPublicNote,
} from "@/lib/public-note"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { TRAFFIC_TYPES, parseAmount, writeCycle } from "../../../../../packages/shared/public-note"
import { AmountInput, Choices } from "./amount-input"
import { CyclePicker, UnknownValue } from "./cycle-picker"
import { DateInput } from "./date-input"
import { QuantityInput } from "./quantity-input"
import { TagInput } from "./tag-input"

export function PublicNoteEditor({
    value,
    onChange,
    routes = [],
}: {
    value: string
    onChange: (value: string) => void
    routes?: string[]
}) {
    const { t } = useTranslation()
    const [mode, setMode] = useState(() => detectPublicNoteMode(value))
    const parsed = parsePublicNote(value)
    const object = isNoteObject(parsed) ? parsed : {}
    const get = (section: string, key: string): string | undefined => {
        const group = object[section]
        if (!isNoteObject(group) || !Object.hasOwn(group, key)) return
        return typeof group[key] === "string" ? group[key] : JSON.stringify(group[key])
    }
    const patch = (section: string, key: string, next: string | undefined) =>
        onChange(patchPublicNote(value, section, key, next))
    const field = (
        section: string,
        key: string,
        label: string,
        control: (
            current: string | undefined,
            change: (value: string | undefined) => void,
        ) => ReactNode,
    ) => {
        const current = get(section, key)
        return (
            <div className="min-w-0 space-y-2" data-note-field={key}>
                <div className="flex min-h-9 items-center justify-between gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    {current !== undefined && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`${t("PublicNote.Clear")} · ${label}`}
                            onClick={() => patch(section, key, undefined)}
                        >
                            {t("PublicNote.Clear")}
                        </Button>
                    )}
                </div>
                {control(current, (next) => patch(section, key, next))}
            </div>
        )
    }
    const billing = "billingDataMod",
        plan = "planDataMod"
    const cycle =
        get(billing, "cycle") ||
        (parseAmount(get(billing, "amount"))?.cycle
            ? writeCycle(parseAmount(get(billing, "amount"))!.cycle!)
            : undefined)
    const section = (key: string, title: string, children: ReactNode) => (
        <fieldset
            className="min-w-0 rounded-lg border p-3"
            disabled={!isNoteObject(parsed) || (key in object && !isNoteObject(object[key]))}
        >
            <legend className="px-1 text-sm font-semibold">{title}</legend>
            {key in object && !isNoteObject(object[key]) ? (
                <UnknownValue value={JSON.stringify(object[key])} />
            ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
            )}
        </fieldset>
    )
    return (
        <section className="space-y-4" aria-label={t("PublicNote.Label")} data-public-note-editor>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("PublicNote.Label")}</h3>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant={mode === "structured" ? "secondary" : "ghost"}
                        aria-pressed={mode === "structured"}
                        disabled={parsed === undefined}
                        onClick={() => setMode("structured")}
                    >
                        {t("PublicNote.CustomFields")}
                    </Button>
                    <Button
                        type="button"
                        variant={mode === "raw" ? "secondary" : "ghost"}
                        aria-pressed={mode === "raw"}
                        onClick={() => setMode("raw")}
                    >
                        {t("PublicNote.RawText")}
                    </Button>
                </div>
            </div>
            {parsed === undefined && (
                <p role="status" className="text-sm text-muted-foreground">
                    {t("PublicNote.InvalidJSONHint")}
                </p>
            )}
            {parsed !== undefined && !isNoteObject(parsed) && <UnknownValue value={value} />}
            {mode === "raw" ? (
                <Textarea
                    aria-label={t("PublicNote.RawText")}
                    rows={8}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
            ) : (
                <>
                    {section(
                        billing,
                        t("PublicNote.Billing"),
                        <>
                            {field(
                                billing,
                                "startDate",
                                t("PublicNote.StartDate"),
                                (value, onChange) => (
                                    <DateInput
                                        label={t("PublicNote.StartDate")}
                                        value={value}
                                        onChange={onChange}
                                    />
                                ),
                            )}
                            {field(
                                billing,
                                "endDate",
                                t("PublicNote.EndDate"),
                                (value, onChange) => (
                                    <DateInput
                                        end
                                        label={t("PublicNote.EndDate")}
                                        value={value}
                                        onChange={onChange}
                                        start={get(billing, "startDate")}
                                        cycle={cycle}
                                    />
                                ),
                            )}
                            {field(
                                billing,
                                "autoRenewal",
                                t("PublicNote.AutoRenewal"),
                                (value, onChange) => (
                                    <>
                                        <Switch
                                            aria-label={t("PublicNote.AutoRenewal")}
                                            checked={value === "1"}
                                            onCheckedChange={(checked) =>
                                                onChange(checked ? "1" : "0")
                                            }
                                        />
                                        {value !== undefined && !/^[01]$/.test(value) && (
                                            <UnknownValue value={value} />
                                        )}
                                    </>
                                ),
                            )}
                            {field(billing, "cycle", t("PublicNote.Cycle"), (value, onChange) => (
                                <CyclePicker
                                    label={t("PublicNote.Cycle")}
                                    value={value || cycle}
                                    onChange={onChange}
                                />
                            ))}
                            {field(billing, "amount", t("PublicNote.Amount"), (value, onChange) => (
                                <AmountInput
                                    label={t("PublicNote.Amount")}
                                    value={value}
                                    onChange={onChange}
                                />
                            ))}
                        </>,
                    )}
                    {section(
                        plan,
                        t("PublicNote.Plan"),
                        <>
                            {field(
                                plan,
                                "bandwidth",
                                t("PublicNote.Bandwidth"),
                                (value, onChange) => (
                                    <QuantityInput
                                        label={t("PublicNote.Bandwidth")}
                                        value={value}
                                        onChange={onChange}
                                    />
                                ),
                            )}
                            {field(
                                plan,
                                "trafficVol",
                                t("PublicNote.TrafficVolume"),
                                (value, onChange) => (
                                    <QuantityInput
                                        traffic
                                        label={t("PublicNote.TrafficVolume")}
                                        value={value}
                                        onChange={onChange}
                                    />
                                ),
                            )}
                            {field(
                                plan,
                                "trafficType",
                                t("PublicNote.TrafficType"),
                                (value, onChange) => (
                                    <>
                                        <Choices
                                            label={t("PublicNote.TrafficType")}
                                            value={value}
                                            options={TRAFFIC_TYPES.map(
                                                ({ value, mode }) =>
                                                    [
                                                        value,
                                                        t(`PublicNote.TrafficModes.${mode}`),
                                                    ] as const,
                                            )}
                                            onChange={onChange}
                                        />
                                        {value !== undefined && !/^[123]$/.test(value) && (
                                            <UnknownValue value={value} />
                                        )}
                                    </>
                                ),
                            )}
                            {(["IPv4", "IPv6"] as const).map((key) => (
                                <div key={key}>
                                    {field(plan, key, key, (value, onChange) => (
                                        <>
                                            <Choices
                                                label={key}
                                                value={value}
                                                options={[
                                                    ["", t("PublicNote.Unset")],
                                                    ["1", t("PublicNote.Has")],
                                                    ["0", t("PublicNote.None")],
                                                ]}
                                                onChange={(next) => onChange(next || undefined)}
                                            />
                                            {value !== undefined && !/^[01]$/.test(value) && (
                                                <UnknownValue value={value} />
                                            )}
                                        </>
                                    ))}
                                </div>
                            ))}
                            {field(
                                plan,
                                "networkRoute",
                                t("PublicNote.NetworkRoute"),
                                (value, onChange) => (
                                    <TagInput
                                        label={t("PublicNote.NetworkRoute")}
                                        value={value}
                                        onChange={onChange}
                                        suggestions={routes}
                                    />
                                ),
                            )}
                            {field(plan, "extra", t("PublicNote.Extra"), (value, onChange) => (
                                <TagInput
                                    label={t("PublicNote.Extra")}
                                    value={value}
                                    onChange={onChange}
                                />
                            ))}
                        </>,
                    )}
                </>
            )}
        </section>
    )
}
