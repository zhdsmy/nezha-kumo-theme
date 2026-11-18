import type * as React from "react"
import { useTranslation } from "react-i18next"
import { Toaster as Sonner } from "sonner"

import { DEFAULT_THEME, useTheme } from "@/components/theme-provider"

type ToasterProps = React.ComponentProps<typeof Sonner>

export const KUMO_SONNER_STYLE = {
    "--normal-bg": "var(--color-kumo-base)",
    "--normal-border": "var(--color-kumo-line)",
    "--normal-text": "var(--text-color-kumo-default)",
    "--error-bg": "color-mix(in oklch, var(--color-kumo-danger) 14%, var(--color-kumo-base))",
    "--error-border": "color-mix(in oklch, var(--color-kumo-danger) 55%, var(--color-kumo-line))",
    "--error-text":
        "color-mix(in oklch, var(--text-color-kumo-danger) 85%, var(--text-color-kumo-strong))",
    "--success-bg": "color-mix(in oklch, var(--color-kumo-success) 14%, var(--color-kumo-base))",
    "--success-border":
        "color-mix(in oklch, var(--color-kumo-success) 55%, var(--color-kumo-line))",
    "--success-text":
        "color-mix(in oklch, var(--text-color-kumo-success) 85%, var(--text-color-kumo-strong))",
    "--warning-bg": "color-mix(in oklch, var(--color-kumo-warning) 16%, var(--color-kumo-base))",
    "--warning-border":
        "color-mix(in oklch, var(--color-kumo-warning) 60%, var(--color-kumo-line))",
    "--warning-text":
        "color-mix(in oklch, var(--text-color-kumo-warning) 80%, var(--text-color-kumo-strong))",
    "--info-bg": "color-mix(in oklch, var(--color-kumo-info) 14%, var(--color-kumo-base))",
    "--info-border": "color-mix(in oklch, var(--color-kumo-info) 55%, var(--color-kumo-line))",
    "--info-text":
        "color-mix(in oklch, var(--text-color-kumo-info) 85%, var(--text-color-kumo-strong))",
} as React.CSSProperties

const Toaster = ({
    style,
    toastOptions,
    offset = { bottom: "5.5rem", right: "1rem" },
    mobileOffset = { bottom: "5.5rem", left: "1rem", right: "1rem" },
    closeButton = true,
    ...props
}: ToasterProps) => {
    const { t } = useTranslation()
    const { theme = DEFAULT_THEME } = useTheme()

    return (
        <Sonner
            richColors
            closeButton={closeButton}
            offset={offset}
            mobileOffset={mobileOffset}
            containerAriaLabel={t("Notification")}
            theme={theme as ToasterProps["theme"]}
            className="toaster group !font-sans"
            style={{ ...KUMO_SONNER_STYLE, ...style }}
            toastOptions={{
                closeButtonAriaLabel: t("Close"),
                ...toastOptions,
                classNames: {
                    toast: "group toast shadow-lg",
                    description: "!opacity-90",
                    actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                    ...toastOptions?.classNames,
                },
            }}
            {...props}
        />
    )
}

export { Toaster }

