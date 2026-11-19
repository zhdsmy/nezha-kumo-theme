import { useTheme } from "@/components/theme-provider"
import { loadVpsIcons } from "@/lib/group-icons"
import { Combobox } from "@cloudflare/kumo"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"

import { vpsIconUrl } from "../../../../packages/shared/group-icons"

type Icon = Awaited<ReturnType<typeof loadVpsIcons>>[number]

export function VpsIconPicker({
    slug,
    onChange,
}: {
    slug?: string
    onChange: (value: string) => void
}) {
    const { t, i18n } = useTranslation()
    const { resolvedTheme } = useTheme()
    const { data: icons = [], error, isLoading } = useSWR("vps-icons", loadVpsIcons)
    const container = useRef<HTMLDivElement>(null)
    const label = t("GroupIconChoose")
    return (
        <div ref={container} className="nkt-vps-icon-picker">
            <Combobox
                items={icons}
                value={icons.find((icon) => icon.slug === slug) ?? null}
                itemToStringLabel={(icon) => icon.name}
                filter={(icon, query) =>
                    [icon.slug, icon.name, ...Object.values(icon.names), ...icon.aliases].some(
                        (term) => term?.toLowerCase().includes(query.trim().toLowerCase()),
                    )
                }
                onValueChange={(icon) => {
                    if (icon) onChange(`vps:${icon.slug}`)
                }}
            >
                <Combobox.TriggerValue aria-label={label} className="min-h-11 w-full">
                    {() => label}
                </Combobox.TriggerValue>
                <Combobox.Content container={container} className="w-80 max-w-[calc(100vw-2rem)]">
                    <Combobox.Input
                        aria-label={t("GroupIconSearch")}
                        placeholder={t("GroupIconSearch")}
                        className="min-h-11"
                    />
                    <Combobox.List>
                        {(icon: Icon) => (
                            <Combobox.Item key={icon.slug} value={icon} className="min-h-11">
                                <span className="flex min-w-0 items-center gap-2">
                                    <img
                                        className="shrink-0"
                                        src={vpsIconUrl(
                                            import.meta.env.BASE_URL,
                                            icon.slug,
                                            resolvedTheme,
                                        )}
                                        alt=""
                                        width={16}
                                        height={16}
                                        loading="lazy"
                                    />
                                    <span>
                                        {(i18n.language.startsWith("zh") && icon.names["zh-CN"]) ||
                                            icon.name}
                                    </span>
                                </span>
                            </Combobox.Item>
                        )}
                    </Combobox.List>
                    <Combobox.Empty>
                        {t(error ? "GroupIconLoadError" : isLoading ? "Loading" : "NoResults")}
                    </Combobox.Empty>
                </Combobox.Content>
            </Combobox>
        </div>
    )
}
