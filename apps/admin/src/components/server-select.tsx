import { swrFetcher } from "@/api/api"
import { MultiSelect } from "@/components/xui/multi-select"
import type { ServerIdentifierType } from "@/types"
import { type ComponentPropsWithoutRef, forwardRef } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"

export const ServerSelect = forwardRef<
    HTMLButtonElement,
    Omit<ComponentPropsWithoutRef<typeof MultiSelect>, "options">
>(function ServerSelect(props, ref) {
    const { t } = useTranslation()
    const { data, error } = useSWR<ServerIdentifierType[]>("/api/v1/server", swrFetcher)
    return (
        <>
            <MultiSelect
                {...props}
                ref={ref}
                options={(data ?? []).map(({ id, name }) => ({ value: String(id), label: name }))}
            />
            {error && (
                <span role="alert" className="text-sm text-destructive">
                    {t("Results.ErrorFetchingResource", { error: error.message })}
                </span>
            )}
        </>
    )
})
